import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DiffViewer } from "./features/diff-workbench/DiffViewer";
import { createInitialDocument, defaultSettings } from "./features/diff-workbench/fixtures";
import type { DiffDocument, DiffFileVersion, DiffSource, ViewerSettings } from "./features/diff-workbench/types";
import { getDocumentStats } from "./lib/diffStats";
import { installNativeBridge, postNativeMessage } from "./lib/nativeBridge";
import { getTelemetrySettingName } from "./lib/telemetry";
import "./styles.css";
import "./native-renderer.css";

type IncomingDiffFileVersion = Omit<DiffFileVersion, "cacheKey"> & {
  cacheKey?: string;
};

type IncomingDiffSource =
  | {
      kind: "file-pair";
      oldFile: IncomingDiffFileVersion;
      newFile: IncomingDiffFileVersion;
    }
  | {
      kind: "patch";
      patch: string;
    };

type IncomingDiffDocument = Omit<DiffDocument, "source" | "settings"> & {
  source: IncomingDiffSource;
  settings?: Partial<ViewerSettings>;
};

export function NativeRendererApp() {
  const [document, setDocument] = useState<DiffDocument>(() => createInitialDocument());

  const renderDocument = useCallback((incomingDocument: DiffDocument) => {
    const nextDocument = normaliseDocument(incomingDocument);
    const renderStartedAt = performance.now();
    postNativeMessage({ type: "renderStarted", documentId: nextDocument.id });
    setDocument(nextDocument);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        postNativeMessage({
          type: "renderCompleted",
          documentId: nextDocument.id,
          stats: getDocumentStats(nextDocument),
          durationMs: Math.round(performance.now() - renderStartedAt)
        });
      });
    });
  }, []);

  const updateSettings = useCallback((settings: Partial<ViewerSettings>) => {
    setDocument((currentDocument) => {
      const nextSettings = { ...currentDocument.settings, ...settings };
      const telemetrySetting = getTelemetrySettingName(settings);
      postNativeMessage({
        type: "updateSettings",
        settings: nextSettings,
        ...(telemetrySetting ? { setting: telemetrySetting } : {})
      });

      return {
        ...currentDocument,
        settings: nextSettings,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  useEffect(
    () =>
      installNativeBridge({
        onRenderDiff: renderDocument,
        onUpdateSettings: updateSettings,
        onExportRequested: (format) => {
          postNativeMessage({ type: "exportRequested", format });
        }
      }),
    [renderDocument, updateSettings]
  );

  return (
    <div className="native-renderer-root">
      <DiffViewer document={document} settings={document.settings} onSettingsChange={updateSettings} />
    </div>
  );
}

function normaliseDocument(document: DiffDocument): DiffDocument {
  const incomingDocument = document as IncomingDiffDocument;
  const fallbackDocument = createInitialDocument();

  return {
    ...fallbackDocument,
    ...incomingDocument,
    source: normaliseSource(incomingDocument.source, fallbackDocument.source),
    settings: {
      ...defaultSettings,
      ...(incomingDocument.settings ?? {})
    },
    annotations: Array.isArray(incomingDocument.annotations) ? incomingDocument.annotations : []
  };
}

function normaliseSource(source: IncomingDiffSource, fallbackSource: DiffSource): DiffSource {
  if (source.kind === "patch") {
    return {
      kind: "patch",
      patch: source.patch
    };
  }

  if (source.kind === "file-pair") {
    return {
      kind: "file-pair",
      oldFile: normaliseFile(source.oldFile, "old"),
      newFile: normaliseFile(source.newFile, "new")
    };
  }

  return fallbackSource;
}

function normaliseFile(file: IncomingDiffFileVersion, prefix: string): DiffFileVersion {
  return {
    ...file,
    cacheKey: file.cacheKey ?? `${prefix}-${file.name}-${file.contents.length}`
  };
}

if (import.meta.env.MODE !== "test") {
  const container = document.getElementById("native-root");

  if (!container) {
    throw new Error("Native renderer root element was not found.");
  }

  createRoot(container).render(
    <StrictMode>
      <NativeRendererApp />
    </StrictMode>
  );
}
