import type { DiffDocument } from "../features/diff-workbench/types";
import { createFullFilePairPatch } from "./filePairPatch";

export function exportDocument(document: DiffDocument, format: "patch" | "json"): string {
  if (format === "json") {
    return JSON.stringify(document, null, 2);
  }

  if (document.source.kind === "patch") {
    return document.source.patch;
  }

  return createFullFilePairPatch({
    oldFile: document.source.oldFile,
    newFile: document.source.newFile
  });
}
