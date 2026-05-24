import type { DiffDocument } from "../features/diff-workbench/types";

export function exportDocument(document: DiffDocument, format: "patch" | "json"): string {
  if (format === "json") {
    return JSON.stringify(document, null, 2);
  }

  if (document.source.kind === "patch") {
    return document.source.patch;
  }

  return [
    `--- a/${document.source.oldFile.name}`,
    `+++ b/${document.source.newFile.name}`,
    "@@ Local file-pair export @@",
    ...document.source.oldFile.contents.split("\n").map((line) => `-${line}`),
    ...document.source.newFile.contents.split("\n").map((line) => `+${line}`)
  ].join("\n");
}
