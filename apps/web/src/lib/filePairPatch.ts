interface FilePairPatchFile {
  name: string;
  contents: string;
}

interface FilePairPatchInput {
  oldFile: FilePairPatchFile;
  newFile: FilePairPatchFile;
}

export function createFullFilePairPatch({ oldFile, newFile }: FilePairPatchInput): string {
  const oldLines = getPatchLines(oldFile.contents);
  const newLines = getPatchLines(newFile.contents);

  return [
    `--- a/${oldFile.name}`,
    `+++ b/${newFile.name}`,
    createHunkHeader(oldLines.length, newLines.length),
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`)
  ].join("\n");
}

function createHunkHeader(oldLineCount: number, newLineCount: number): string {
  return `@@ -${getHunkStart(oldLineCount)},${oldLineCount} +${getHunkStart(newLineCount)},${newLineCount} @@`;
}

function getHunkStart(lineCount: number): 0 | 1 {
  return lineCount === 0 ? 0 : 1;
}

function getPatchLines(contents: string): string[] {
  if (contents.length === 0) {
    return [];
  }

  const lines = contents.split("\n");

  if (lines.at(-1) === "") {
    return lines.slice(0, -1);
  }

  return lines;
}
