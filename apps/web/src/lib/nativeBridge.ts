import type { DiffDocument, NativeRendererMessage, ViewerSettings } from "../features/diff-workbench/types";

interface NativeMessageHandler {
  postMessage(message: NativeRendererMessage): void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        betweenTheLines?: NativeMessageHandler;
      };
    };
  }
}

export interface NativeBridgeHandlers {
  onRenderDiff(document: DiffDocument): void;
  onUpdateSettings(settings: Partial<ViewerSettings>): void;
  onExportRequested(format: "patch" | "json"): void;
}

export function installNativeBridge(handlers: NativeBridgeHandlers): () => void {
  const listener = (event: MessageEvent<NativeRendererMessage>) => {
    if (event.source !== window || !isAllowedBridgeOrigin(event.origin)) {
      return;
    }

    const message = event.data;

    if (!message || typeof message !== "object" || !("type" in message)) {
      return;
    }

    switch (message.type) {
      case "renderDiff":
        handlers.onRenderDiff(message.document);
        break;
      case "updateSettings":
        handlers.onUpdateSettings(message.settings);
        break;
      case "exportRequested":
        handlers.onExportRequested(message.format);
        break;
      default:
        break;
    }
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

function isAllowedBridgeOrigin(origin: string): boolean {
  if (window.location.protocol === "file:") {
    return origin === "null" || origin === "file://";
  }

  return origin === window.location.origin;
}

export function postNativeMessage(message: NativeRendererMessage): void {
  window.webkit?.messageHandlers?.betweenTheLines?.postMessage(message);
}
