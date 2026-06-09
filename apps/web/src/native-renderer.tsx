import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DiffViewer } from "./features/diff-workbench/DiffViewer";
import { createInitialDocument } from "./features/diff-workbench/fixtures";
import type { DiffDocument, ViewerSettings } from "./features/diff-workbench/types";
import { getDocumentStats } from "./lib/diffStats";
import { installNativeBridge, postNativeMessage } from "./lib/nativeBridge";
import { getTelemetrySettingName } from "./lib/telemetry";
import { normaliseDocument, normaliseSettings } from "./native-renderer-model";
import "./styles.css";
import "./native-renderer.css";

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
      const nextSettings = normaliseSettings(settings, currentDocument.settings);
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
