import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./features/diff-workbench/fixtures";
import type { DiffDocument, NativeRendererMessage } from "./features/diff-workbench/types";
import type { NativeBridgeHandlers } from "./lib/nativeBridge";
import { NativeRendererApp } from "./native-renderer";

const nativeBridgeMock = vi.hoisted(() => ({
  handlers: undefined as NativeBridgeHandlers | undefined,
  postNativeMessage: vi.fn<(message: NativeRendererMessage) => void>()
}));

vi.mock("./lib/nativeBridge", () => ({
  installNativeBridge: vi.fn((handlers: NativeBridgeHandlers) => {
    nativeBridgeMock.handlers = handlers;
    return vi.fn();
  }),
  postNativeMessage: nativeBridgeMock.postNativeMessage
}));

vi.mock("./features/diff-workbench/DiffViewer", () => ({
  DiffViewer: () => null
}));

let frameCallbacks: FrameRequestCallback[] = [];
let now = 0;

describe("NativeRendererApp", () => {
  beforeEach(() => {
    frameCallbacks = [];
    now = 0;
    nativeBridgeMock.handlers = undefined;
    nativeBridgeMock.postNativeMessage.mockReset();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses separate duration starts for rapid render requests", async () => {
    render(<NativeRendererApp />);

    await waitFor(() => expect(nativeBridgeMock.handlers).toBeDefined());

    const handlers = nativeBridgeMock.handlers;

    if (!handlers) {
      throw new Error("Expected native bridge handlers to be installed.");
    }

    now = 100;
    act(() => {
      handlers.onRenderDiff(createDocument("first-render"));
    });

    now = 250;
    act(() => {
      handlers.onRenderDiff(createDocument("second-render"));
    });

    now = 400;
    act(() => {
      flushQueuedAnimationFrames();
    });

    expect(getRenderCompletedMessages()).toHaveLength(0);

    act(() => {
      flushQueuedAnimationFrames();
    });

    expect(getRenderCompletedMessages()).toEqual([
      expect.objectContaining({
        documentId: "first-render",
        durationMs: 300
      }),
      expect.objectContaining({
        documentId: "second-render",
        durationMs: 150
      })
    ]);
  });
});

function flushQueuedAnimationFrames(): void {
  const callbacks = frameCallbacks;
  frameCallbacks = [];
  callbacks.forEach((callback) => callback(now));
}

function getRenderCompletedMessages(): Extract<NativeRendererMessage, { type: "renderCompleted" }>[] {
  return nativeBridgeMock.postNativeMessage.mock.calls
    .map(([message]) => message)
    .filter(isRenderCompletedMessage);
}

function isRenderCompletedMessage(
  message: NativeRendererMessage
): message is Extract<NativeRendererMessage, { type: "renderCompleted" }> {
  return message.type === "renderCompleted";
}

function createDocument(id: string): DiffDocument {
  return {
    id,
    title: "Native render",
    source: {
      kind: "patch",
      patch: "@@ -1,1 +1,1 @@\n-old\n+new"
    },
    settings: defaultSettings,
    annotations: [],
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z"
  };
}
