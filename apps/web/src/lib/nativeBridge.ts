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
  const listener = (event: MessageEvent<unknown>) => {
    if (event.source !== window || !isAllowedBridgeOrigin(event.origin)) {
      return;
    }

    const message = event.data;

    if (!isRecord(message) || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case "renderDiff":
        if (isDiffDocument(message.document)) {
          handlers.onRenderDiff(message.document);
        }
        break;
      case "updateSettings":
        if (isRecord(message.settings)) {
          const settings = getSafeViewerSettings(message.settings);

          if (Object.keys(settings).length > 0) {
            handlers.onUpdateSettings(settings);
          }
        }
        break;
      case "exportRequested":
        if (message.format === "patch" || message.format === "json") {
          handlers.onExportRequested(message.format);
        }
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

function isDiffDocument(document: unknown): document is DiffDocument {
  if (!isRecord(document)) {
    return false;
  }

  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    isDiffSource(document.source) &&
    isRecord(document.settings) &&
    Array.isArray(document.annotations) &&
    typeof document.createdAt === "string" &&
    typeof document.updatedAt === "string"
  );
}

function isDiffSource(source: unknown): source is DiffDocument["source"] {
  if (!isRecord(source) || typeof source.kind !== "string") {
    return false;
  }

  if (source.kind === "patch") {
    return typeof source.patch === "string";
  }

  return source.kind === "file-pair" && isDiffFileVersion(source.oldFile) && isDiffFileVersion(source.newFile);
}

function isDiffFileVersion(file: unknown): boolean {
  return (
    isRecord(file) &&
    typeof file.name === "string" &&
    typeof file.contents === "string" &&
    typeof file.cacheKey === "string" &&
    (file.lang === undefined || typeof file.lang === "string")
  );
}

function getSafeViewerSettings(settings: Record<string, unknown>): Partial<ViewerSettings> {
  const safeSettings: Partial<ViewerSettings> = {};

  if (settings.diffStyle === "split" || settings.diffStyle === "unified") {
    safeSettings.diffStyle = settings.diffStyle;
  }

  if (settings.overflow === "scroll" || settings.overflow === "wrap") {
    safeSettings.overflow = settings.overflow;
  }

  if (isThemeType(settings.themeType)) {
    safeSettings.themeType = settings.themeType;
  }

  if (typeof settings.theme === "string") {
    safeSettings.theme = settings.theme as ViewerSettings["theme"];
  }

  if (isLineDiffType(settings.lineDiffType)) {
    safeSettings.lineDiffType = settings.lineDiffType;
  }

  if (typeof settings.lineNumbers === "boolean") {
    safeSettings.lineNumbers = settings.lineNumbers;
  }

  if (
    typeof settings.collapsedContextThreshold === "number" &&
    Number.isFinite(settings.collapsedContextThreshold) &&
    settings.collapsedContextThreshold >= 0
  ) {
    safeSettings.collapsedContextThreshold = settings.collapsedContextThreshold;
  }

  if (typeof settings.telemetryOptIn === "boolean") {
    safeSettings.telemetryOptIn = settings.telemetryOptIn;
  }

  return safeSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isThemeType(value: unknown): value is ViewerSettings["themeType"] {
  return value === "system" || value === "light" || value === "dark";
}

function isLineDiffType(value: unknown): value is ViewerSettings["lineDiffType"] {
  return value === "word-alt" || value === "word" || value === "char" || value === "none";
}

export function postNativeMessage(message: NativeRendererMessage): void {
  window.webkit?.messageHandlers?.betweenTheLines?.postMessage(message);
}
