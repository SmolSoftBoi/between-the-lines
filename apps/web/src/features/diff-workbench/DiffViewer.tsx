import {
  MultiFileDiff,
  PatchDiff,
  Virtualizer,
  WorkerPoolContextProvider,
  type DiffLineAnnotation,
  type FileContents,
  type SupportedLanguages
} from "@pierre/diffs/react";
import DiffWorker from "@pierre/diffs/worker/worker.js?worker";
import { useMemo } from "react";
import { SegmentedControl } from "../../components/SegmentedControl";
import type { DiffDocument, ReviewAnnotation, ViewerSettings } from "./types";

interface DiffViewerProps {
  document: DiffDocument;
  settings: ViewerSettings;
  onSettingsChange(settings: Partial<ViewerSettings>): void;
}

export function DiffViewer({ document, settings, onSettingsChange }: DiffViewerProps) {
  const annotations = useMemo<DiffLineAnnotation<ReviewAnnotation>[]>(
    () =>
      document.annotations
        .filter((annotation) => annotation.status === "open")
        .map((annotation) => ({
          side: annotation.side,
          lineNumber: annotation.lineNumber,
          metadata: annotation
        })),
    [document.annotations]
  );

  const options = useMemo(
    () => ({
      diffStyle: settings.diffStyle,
      overflow: settings.overflow,
      theme: settings.theme,
      themeType: settings.themeType,
      lineDiffType: settings.lineDiffType,
      disableLineNumbers: !settings.lineNumbers,
      stickyHeader: true,
      hunkSeparators: "line-info-basic" as const,
      collapsedContextThreshold: settings.collapsedContextThreshold,
      diffIndicators: "bars" as const
    }),
    [settings]
  );

  const workerPoolOptions = useMemo(
    () => ({
      workerFactory: () => new DiffWorker(),
      poolSize: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))
    }),
    []
  );

  const highlighterOptions = useMemo(
    () => ({
      theme: settings.theme,
      langs: ["typescript", "javascript", "json", "swift", "markdown", "text"] as SupportedLanguages[]
    }),
    [settings.theme]
  );

  return (
    <main className="viewer-shell" aria-label="Diff viewer">
      <div className="viewer-toolbar">
        <div>
          <h2>Diff</h2>
          <p>{document.source.kind === "patch" ? "Rendering pasted patch" : "Comparing file pair"}</p>
        </div>
        <div className="viewer-toolbar__controls">
          <SegmentedControl
            label="Diff layout"
            value={settings.diffStyle}
            options={[
              { label: "Split", value: "split" },
              { label: "Unified", value: "unified" }
            ]}
            onChange={(diffStyle) => onSettingsChange({ diffStyle })}
          />
          <SegmentedControl
            label="Line wrapping"
            value={settings.overflow}
            options={[
              { label: "Scroll", value: "scroll" },
              { label: "Wrap", value: "wrap" }
            ]}
            onChange={(overflow) => onSettingsChange({ overflow })}
          />
        </div>
      </div>

      <div className="diff-frame">
        <WorkerPoolContextProvider
          highlighterOptions={highlighterOptions}
          poolOptions={workerPoolOptions}
        >
          <Virtualizer className="diff-virtualizer" contentClassName="diff-virtualizer__content">
            {document.source.kind === "patch" ? (
              <PatchDiff
                lineAnnotations={annotations}
                options={options}
                patch={document.source.patch}
                renderAnnotation={renderAnnotation}
              />
            ) : (
              <MultiFileDiff
                lineAnnotations={annotations}
                newFile={toFileContents(document.source.newFile)}
                oldFile={toFileContents(document.source.oldFile)}
                options={options}
                renderAnnotation={renderAnnotation}
              />
            )}
          </Virtualizer>
        </WorkerPoolContextProvider>
      </div>
    </main>
  );
}

function renderAnnotation(annotation: DiffLineAnnotation<ReviewAnnotation>) {
  return (
    <div className="diff-annotation">
      <strong>Note</strong>
      <span>{annotation.metadata.note}</span>
    </div>
  );
}

function toFileContents(file: {
  name: string;
  contents: string;
  lang?: string;
  cacheKey: string;
}): FileContents {
  return {
    name: file.name,
    contents: file.contents,
    lang: file.lang as SupportedLanguages | undefined,
    cacheKey: file.cacheKey
  };
}
