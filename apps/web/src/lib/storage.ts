import type { DiffDocument, ViewerSettings } from "../features/diff-workbench/types";

const documentKey = "between-the-lines:documents:v1";
const settingsKey = "between-the-lines:settings:v1";

export function loadDocuments(): DiffDocument[] {
  return loadJson<DiffDocument[]>(documentKey, []);
}

export function saveDocuments(documents: DiffDocument[]): void {
  window.localStorage.setItem(documentKey, JSON.stringify(documents.slice(0, 20)));
}

export function loadSettings(defaultSettings: ViewerSettings): ViewerSettings {
  return {
    ...defaultSettings,
    ...loadJson<Partial<ViewerSettings>>(settingsKey, {})
  };
}

export function saveSettings(settings: ViewerSettings): void {
  window.localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
