import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialDocument } from "../features/diff-workbench/fixtures";
import type { NativeRendererMessage } from "../features/diff-workbench/types";
import { installNativeBridge, type NativeBridgeHandlers } from "./nativeBridge";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("installNativeBridge", () => {
  it("accepts same-window same-origin renderDiff messages", () => {
    const handlers = createHandlers();
    const diffDocument = createInitialDocument();
    const uninstall = installNativeBridge(handlers);

    dispatchBridgeMessage({
      type: "renderDiff",
      document: diffDocument
    });

    expect(handlers.onRenderDiff).toHaveBeenCalledWith(diffDocument);
    uninstall();
  });

  it("rejects renderDiff messages without a valid document", () => {
    const handlers = createHandlers();
    const uninstall = installNativeBridge(handlers);

    dispatchBridgeMessage({
      type: "renderDiff",
      document: {
        id: "document-1",
        source: {
          kind: "patch",
          patch: "+safe"
        }
      }
    });

    expect(handlers.onRenderDiff).not.toHaveBeenCalled();
    uninstall();
  });

  it("passes only recognised and correctly typed updateSettings values", () => {
    const handlers = createHandlers();
    const uninstall = installNativeBridge(handlers);

    dispatchBridgeMessage({
      type: "updateSettings",
      settings: {
        diffStyle: "unified",
        themeType: "dark",
        lineDiffType: "char",
        lineNumbers: false,
        collapsedContextThreshold: 4,
        telemetryOptIn: true,
        overflow: "sideways",
        patch: "+secret"
      }
    });

    expect(handlers.onUpdateSettings).toHaveBeenCalledWith({
      diffStyle: "unified",
      themeType: "dark",
      lineDiffType: "char",
      lineNumbers: false,
      collapsedContextThreshold: 4,
      telemetryOptIn: true
    });
    uninstall();
  });

  it("rejects updateSettings messages without recognised valid settings", () => {
    const handlers = createHandlers();
    const uninstall = installNativeBridge(handlers);

    dispatchBridgeMessage({
      type: "updateSettings",
      settings: {
        diffStyle: "side-by-side",
        themeType: "midnight",
        lineDiffType: "token",
        lineNumbers: "yes",
        collapsedContextThreshold: Number.NaN
      }
    });

    expect(handlers.onUpdateSettings).not.toHaveBeenCalled();
    uninstall();
  });

  it("rejects exportRequested messages without a valid format", () => {
    const handlers = createHandlers();
    const uninstall = installNativeBridge(handlers);

    dispatchBridgeMessage({
      type: "exportRequested",
      format: "zip"
    });

    expect(handlers.onExportRequested).not.toHaveBeenCalled();
    uninstall();
  });

  it("rejects same-window wrong-origin messages before reading data", () => {
    const handlers = createHandlers();
    const uninstall = installNativeBridge(handlers);
    const event = new MessageEvent("message", {
      origin: "https://example.invalid",
      source: window
    });

    Object.defineProperty(event, "data", {
      get() {
        throw new Error("Rejected bridge events must not read data");
      }
    });

    window.dispatchEvent(event);

    expect(handlers.onRenderDiff).not.toHaveBeenCalled();
    uninstall();
  });

  it("rejects same-origin messages from another source", () => {
    const handlers = createHandlers();
    const diffDocument = createInitialDocument();
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const iframeWindow = iframe.contentWindow;
    const uninstall = installNativeBridge(handlers);

    if (!iframeWindow) {
      throw new Error("Expected iframe contentWindow to be available");
    }

    dispatchBridgeMessage(
      {
        type: "renderDiff",
        document: diffDocument
      },
      {
        source: iframeWindow
      }
    );

    expect(handlers.onRenderDiff).not.toHaveBeenCalled();
    uninstall();
  });

  it("accepts null-origin messages from the same file-protocol window", () => {
    const bridgeTarget = createFileProtocolBridgeTarget();
    const handlers = createHandlers();
    const diffDocument = createInitialDocument();

    vi.stubGlobal("window", bridgeTarget.fileWindow);
    const uninstall = installNativeBridge(handlers);

    bridgeTarget.dispatch({
      type: "renderDiff",
      document: diffDocument
    });

    expect(handlers.onRenderDiff).toHaveBeenCalledWith(diffDocument);
    uninstall();
  });
});

function createHandlers(): NativeBridgeHandlers {
  return {
    onRenderDiff: vi.fn(),
    onUpdateSettings: vi.fn(),
    onExportRequested: vi.fn()
  };
}

function dispatchBridgeMessage(
  message: unknown,
  options: {
    origin?: string;
    source?: MessageEventSource | null;
  } = {}
): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: message,
      origin: options.origin ?? window.location.origin,
      source: options.source ?? window
    })
  );
}

function createFileProtocolBridgeTarget(): {
  fileWindow: Window & typeof globalThis;
  dispatch(message: NativeRendererMessage): void;
} {
  let messageListener: ((event: MessageEvent<NativeRendererMessage>) => void) | undefined;
  const fileWindow = {
    location: {
      protocol: "file:",
      origin: "null"
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "message" && typeof listener === "function") {
        messageListener = listener as (event: MessageEvent<NativeRendererMessage>) => void;
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "message" && listener === messageListener) {
        messageListener = undefined;
      }
    }
  } as unknown as Window & typeof globalThis;

  return {
    fileWindow,
    dispatch(message: NativeRendererMessage) {
      if (!messageListener) {
        throw new Error("Expected native bridge message listener to be installed");
      }

      messageListener({
        data: message,
        origin: "null",
        source: fileWindow
      } as unknown as MessageEvent<NativeRendererMessage>);
    }
  };
}
