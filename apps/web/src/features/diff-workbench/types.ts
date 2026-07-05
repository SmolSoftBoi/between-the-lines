import type {
  AnnotationSide,
  DiffsThemeNames,
  LineDiffTypes,
  ThemeTypes
} from "@pierre/diffs/react";

export type DiffSource =
  | {
      kind: "file-pair";
      oldFile: DiffFileVersion;
      newFile: DiffFileVersion;
    }
  | {
      kind: "patch";
      patch: string;
    };

export interface DiffDocument {
  id: string;
  title: string;
  source: DiffSource;
  settings: ViewerSettings;
  annotations: ReviewAnnotation[];
  createdAt: string;
  updatedAt: string;
}

export interface DiffFileVersion {
  name: string;
  contents: string;
  lang?: string;
  cacheKey: string;
}

export interface ViewerSettings {
  diffStyle: "split" | "unified";
  overflow: "scroll" | "wrap";
  themeType: ThemeTypes;
  theme: DiffsThemeNames;
  lineDiffType: LineDiffTypes;
  lineNumbers: boolean;
  collapsedContextThreshold: number;
  telemetryOptIn: boolean;
}

export type TelemetrySettingName =
  | "collapsed_context_threshold"
  | "diff_style"
  | "line_diff_type"
  | "line_numbers"
  | "overflow"
  | "telemetry_opt_in"
  | "theme"
  | "theme_type";

export interface ReviewAnnotation {
  id: string;
  side: AnnotationSide;
  lineNumber: number;
  note: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  files: number;
  sizeBucket: TextSizeBucket;
}

export type TextSizeBucket = "empty" | "small" | "medium" | "large" | "huge";

export type NativeRendererMessage =
  | {
      type: "renderDiff";
      document: DiffDocument;
    }
  | {
      type: "updateSettings";
      settings: Partial<ViewerSettings>;
      setting?: TelemetrySettingName;
    }
  | {
      type: "exportRequested";
      format: "patch" | "json";
    }
  | {
      type: "renderStarted";
      documentId: string;
    }
  | {
      type: "renderCompleted";
      documentId: string;
      stats: DiffStats;
      durationMs: number;
    }
  | {
      type: "renderFailed";
      documentId: string;
      reason: string;
    };
