import { useEffect, useMemo, useState } from "react";
import { exportDocument } from "../../lib/exportDocument";
import { getDocumentStats } from "../../lib/diffStats";
import { installNativeBridge, postNativeMessage } from "../../lib/nativeBridge";
import {
  createTelemetryClient,
  statsToTelemetryProperties
} from "../../lib/telemetry";
import { loadDocuments, loadSettings, saveDocuments, saveSettings } from "../../lib/storage";
import { DiffViewer } from "./DiffViewer";
import { EditorPanel } from "./EditorPanel";
import { createInitialDocument } from "./fixtures";
import { HeaderToolbar } from "./HeaderToolbar";
import { InspectorPanel } from "./InspectorPanel";
import type { DiffDocument, DiffSource, ReviewAnnotation, ViewerSettings } from "./types";

const telemetryEndpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT as string | undefined;
const telemetryEnabled = import.meta.env.VITE_TELEMETRY_ENABLED === "true";

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
  const telemetry = useMemo(
    () =>
      createTelemetryClient({
        enabled: telemetryEnabled && document.settings.telemetryOptIn,
        endpoint: telemetryEndpoint,
        platform: "web",
        appVersion: "0.1.0"
      }),
    [document.settings.telemetryOptIn]
  );

  useEffect(() => {
    telemetry.track("app_opened", { telemetryOptIn: document.settings.telemetryOptIn });
  }, [document.settings.telemetryOptIn, telemetry]);

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
        durationBucket: bucketDuration(durationMs)
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [document.id, document.source, document.annotations, document.settings, stats, telemetry]);

  const mode = document.source.kind;

  const updateDocument = (patch: Partial<DiffDocument>) => {
    setDocument((currentDocument) => ({
      ...currentDocument,
      ...patch,
      updatedAt: new Date().toISOString()
    }));
  };

  const updateSettings = (settings: Partial<ViewerSettings>) => {
    setDocument((currentDocument) => ({
      ...currentDocument,
      settings: {
        ...currentDocument.settings,
        ...settings
      },
      updatedAt: new Date().toISOString()
    }));
    telemetry.track("settings_changed", {
      changedSettings: Object.keys(settings).sort().join(",")
    });
  };

  const updateSource = (source: DiffSource) => {
    updateDocument({ source });
    telemetry.track("diff_loaded", statsToTelemetryProperties(getDocumentStats({ ...document, source })));
  };

  const changeMode = (nextMode: DiffSource["kind"]) => {
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
  };

  const addAnnotation = (annotation: ReviewAnnotation) => {
    updateDocument({
      annotations: [annotation, ...document.annotations]
    });
    telemetry.track("annotation_added", {
      side: annotation.side,
      lineBucket: bucketLine(annotation.lineNumber)
    });
  };

  const resolveAnnotation = (id: string) => {
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
  };

  const saveSnapshot = () => {
    const snapshot = {
      ...document,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString()
    };
    const nextHistory = [snapshot, ...history.filter((item) => item.id !== snapshot.id)].slice(0, 20);
    setHistory(nextHistory);
    saveDocuments(nextHistory);
  };

  const loadSnapshot = (nextDocument: DiffDocument) => {
    setDocument({
      ...nextDocument,
      updatedAt: new Date().toISOString()
    });
  };

  const exportCurrentDocument = (format: "patch" | "json") => {
    const exported = exportDocument(document, format);
    const blob = new Blob([exported], { type: format === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${slugify(document.title)}.${format === "json" ? "json" : "patch"}`;
    link.click();
    URL.revokeObjectURL(url);
    telemetry.track("export_requested", {
      format,
      ...statsToTelemetryProperties(stats)
    });
  };

  useEffect(() => {
    return installNativeBridge({
      onRenderDiff(nextDocument) {
        setDocument(nextDocument);
      },
      onUpdateSettings(settings) {
        updateSettings(settings);
      },
      onExportRequested(format) {
        exportCurrentDocument(format);
      }
    });
  });

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

  return [
    `--- a/${document.source.oldFile.name}`,
    `+++ b/${document.source.newFile.name}`,
    "@@ -1,1 +1,1 @@",
    ...document.source.oldFile.contents.split("\n").map((line) => `-${line}`),
    ...document.source.newFile.contents.split("\n").map((line) => `+${line}`)
  ].join("\n");
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
