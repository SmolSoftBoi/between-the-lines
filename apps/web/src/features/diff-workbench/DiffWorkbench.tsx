import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportDocument } from "../../lib/exportDocument";
import { getDocumentStats } from "../../lib/diffStats";
import { installNativeBridge, postNativeMessage } from "../../lib/nativeBridge";
import {
  createTelemetryClient,
  getTelemetryEnvironment,
  getTelemetrySettingName,
  statsToTelemetryProperties
} from "../../lib/telemetry";
import { createFullFilePairPatch } from "../../lib/filePairPatch";
import { loadDocuments, loadSettings, saveDocuments, saveSettings } from "../../lib/storage";
import { DiffViewer } from "./DiffViewer";
import { EditorPanel } from "./EditorPanel";
import { createInitialDocument } from "./fixtures";
import { HeaderToolbar } from "./HeaderToolbar";
import { InspectorPanel } from "./InspectorPanel";
import type { DiffDocument, DiffSource, ReviewAnnotation, ViewerSettings } from "./types";

const telemetryEndpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT as string | undefined;
const telemetryEnabled = import.meta.env.VITE_TELEMETRY_ENABLED === "true";
const telemetryEnvironment = getTelemetryEnvironment(
  (import.meta.env.VITE_APP_ENV as string | undefined) ?? import.meta.env.MODE
);
const telemetryReleaseSha = (import.meta.env.VITE_RELEASE_SHA as string | undefined) ?? "local";

export function DiffWorkbench() {
  const [document, setDocument] = useState<DiffDocument>(() => {
    const initialDocument = createInitialDocument();
    return {
      ...initialDocument,
      settings: loadSettings(initialDocument.settings)
    };
  });
  const [history, setHistory] = useState<DiffDocument[]>(() => loadDocuments());
  const stats = useMemo(() => getDocumentStats(document), [document]);
  const latestDocumentRef = useRef(document);
  const latestStatsRef = useRef(stats);
  const telemetry = useMemo(
    () =>
      createTelemetryClient({
        enabled: telemetryEnabled && document.settings.telemetryOptIn,
        environment: telemetryEnvironment,
        endpoint: telemetryEndpoint,
        platform: "web",
        releaseSha: telemetryReleaseSha
      }),
    [document.settings.telemetryOptIn]
  );

  useEffect(() => {
    telemetry.track("app_opened");
  }, [telemetry]);

  useEffect(() => {
    latestDocumentRef.current = document;
    latestStatsRef.current = stats;
  }, [document, stats]);

  useEffect(() => {
    saveSettings(document.settings);
  }, [document.settings]);

  useEffect(() => {
    const startedAt = performance.now();
    postNativeMessage({ type: "renderStarted", documentId: document.id });
    telemetry.track("render_started", statsToTelemetryProperties(stats));

    const frame = window.requestAnimationFrame(() => {
      const durationMs = Math.round(performance.now() - startedAt);
      postNativeMessage({
        type: "renderCompleted",
        documentId: document.id,
        stats,
        durationMs
      });
      telemetry.track("render_completed", {
        ...statsToTelemetryProperties(stats),
        duration_bucket: bucketDuration(durationMs)
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [document.id, document.source, document.annotations, document.settings, stats, telemetry]);

  const mode = document.source.kind;

  const updateDocument = useCallback((patch: Partial<DiffDocument>) => {
    setDocument((currentDocument) => ({
      ...currentDocument,
      ...patch,
      updatedAt: new Date().toISOString()
    }));
  }, []);

  const updateSettings = useCallback((settings: Partial<ViewerSettings>) => {
    setDocument((currentDocument) => ({
      ...currentDocument,
      settings: {
        ...currentDocument.settings,
        ...settings
      },
      updatedAt: new Date().toISOString()
    }));
    const telemetrySetting = getTelemetrySettingName(settings);
    telemetry.track("settings_changed", telemetrySetting ? { setting: telemetrySetting } : {});
  }, [telemetry]);

  const updateSource = useCallback((source: DiffSource) => {
    updateDocument({ source });
    telemetry.track("diff_loaded", statsToTelemetryProperties(getDocumentStats({ ...document, source })));
  }, [document, telemetry, updateDocument]);

  const changeMode = useCallback((nextMode: DiffSource["kind"]) => {
    if (nextMode === document.source.kind) {
      return;
    }

    if (nextMode === "patch") {
      updateSource({
        kind: "patch",
        patch: createPatchFromDocument(document)
      });
      return;
    }

    updateSource({
      kind: "file-pair",
      oldFile: {
        name: "old.txt",
        contents: "",
        cacheKey: `old-empty-${Date.now()}`
      },
      newFile: {
        name: "new.txt",
        contents: "",
        cacheKey: `new-empty-${Date.now()}`
      }
    });
  }, [document, updateSource]);

  const addAnnotation = useCallback((annotation: ReviewAnnotation) => {
    updateDocument({
      annotations: [annotation, ...document.annotations]
    });
    telemetry.track("annotation_added", {
      side: annotation.side,
      line_bucket: bucketLine(annotation.lineNumber)
    });
  }, [document.annotations, telemetry, updateDocument]);

  const resolveAnnotation = useCallback((id: string) => {
    updateDocument({
      annotations: document.annotations.map((annotation) =>
        annotation.id === id
          ? {
              ...annotation,
              status: "resolved"
            }
          : annotation
      )
    });
  }, [document.annotations, updateDocument]);

  const saveSnapshot = useCallback(() => {
    const snapshot = {
      ...document,
      updatedAt: new Date().toISOString()
    };
    const nextHistory = [snapshot, ...history.filter((item) => item.id !== snapshot.id)].slice(0, 20);
    setHistory(nextHistory);
    saveDocuments(nextHistory);
  }, [document, history]);

  const loadSnapshot = useCallback((nextDocument: DiffDocument) => {
    setDocument({
      ...nextDocument,
      updatedAt: new Date().toISOString()
    });
  }, []);

  const exportCurrentDocument = useCallback((format: "patch" | "json") => {
    const currentDocument = latestDocumentRef.current;
    const currentStats = latestStatsRef.current;
    const exported = exportDocument(currentDocument, format);
    const blob = new Blob([exported], { type: format === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${slugify(currentDocument.title)}.${format === "json" ? "json" : "patch"}`;
    link.click();
    URL.revokeObjectURL(url);
    telemetry.track("export_requested", {
      format,
      ...statsToTelemetryProperties(currentStats)
    });
  }, [telemetry]);

  const handleNativeRenderDiff = useCallback((nextDocument: DiffDocument) => {
    setDocument(nextDocument);
  }, []);

  useEffect(() => {
    return installNativeBridge({
      onRenderDiff: handleNativeRenderDiff,
      onUpdateSettings: updateSettings,
      onExportRequested: exportCurrentDocument
    });
  }, [exportCurrentDocument, handleNativeRenderDiff, updateSettings]);

  return (
    <div className="app-shell">
      <HeaderToolbar
        mode={mode}
        settings={document.settings}
        telemetryOptIn={document.settings.telemetryOptIn}
        title={document.title}
        onExport={exportCurrentDocument}
        onModeChange={changeMode}
        onSaveSnapshot={saveSnapshot}
        onTelemetryChange={(telemetryOptIn) => updateSettings({ telemetryOptIn })}
        onTitleChange={(title) => updateDocument({ title })}
      />
      <div className="workbench-grid">
        <EditorPanel
          document={document}
          mode={mode}
          onModeChange={changeMode}
          onSourceChange={updateSource}
        />
        <DiffViewer document={document} settings={document.settings} onSettingsChange={updateSettings} />
        <InspectorPanel
          document={document}
          history={history}
          settings={document.settings}
          stats={stats}
          onAddAnnotation={addAnnotation}
          onLoadDocument={loadSnapshot}
          onResolveAnnotation={resolveAnnotation}
          onSettingsChange={updateSettings}
        />
      </div>
    </div>
  );
}

function createPatchFromDocument(document: DiffDocument): string {
  if (document.source.kind === "patch") {
    return document.source.patch;
  }

  return createFullFilePairPatch({
    oldFile: document.source.oldFile,
    newFile: document.source.newFile
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || "between-the-lines";
}

function bucketDuration(durationMs: number): string {
  if (durationMs < 100) {
    return "under_100ms";
  }

  if (durationMs < 500) {
    return "under_500ms";
  }

  if (durationMs < 2_000) {
    return "under_2s";
  }

  return "over_2s";
}

function bucketLine(lineNumber: number): string {
  if (lineNumber < 25) {
    return "top";
  }

  if (lineNumber < 200) {
    return "middle";
  }

  return "deep";
}
