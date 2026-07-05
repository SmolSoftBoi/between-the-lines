import { createInitialDocument, defaultSettings } from "./features/diff-workbench/fixtures";
import type {
  DiffDocument,
  DiffFileVersion,
  DiffSource,
  ViewerSettings
} from "./features/diff-workbench/types";

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

export function normaliseDocument(document: DiffDocument): DiffDocument {
  const incomingDocument = document as IncomingDiffDocument;
  const fallbackDocument = createInitialDocument();

  return {
    ...fallbackDocument,
    ...incomingDocument,
    source: normaliseSource(incomingDocument.source, fallbackDocument.source),
    settings: normaliseSettings(incomingDocument.settings),
    annotations: Array.isArray(incomingDocument.annotations) ? incomingDocument.annotations : []
  };
}

export function normaliseSettings(
  settings: Partial<ViewerSettings> | undefined,
  fallbackSettings: ViewerSettings = defaultSettings
): ViewerSettings {
  const nextSettings = {
    ...fallbackSettings,
    ...(settings ?? {})
  };

  if (settings?.theme === undefined) {
    nextSettings.theme = concreteThemeFor(nextSettings.themeType);
  }

  return nextSettings;
}

function concreteThemeFor(themeType: ViewerSettings["themeType"]): ViewerSettings["theme"] {
  if (themeType === "dark") {
    return "pierre-dark";
  }

  if (themeType === "system" && prefersDarkTheme()) {
    return "pierre-dark";
  }

  return "pierre-light";
}

function prefersDarkTheme(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
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
