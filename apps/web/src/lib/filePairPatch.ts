interface FilePairPatchFile {
  name: string;
  contents: string;
}

interface FilePairPatchInput {
  oldFile: FilePairPatchFile;
  newFile: FilePairPatchFile;
}

export function createFullFilePairPatch({ oldFile, newFile }: FilePairPatchInput): string {
  const oldLineSet = getPatchLineSet(oldFile.contents);
  const newLineSet = getPatchLineSet(newFile.contents);
  const safeOldName = sanitizePatchFileName(oldFile.name);
  const safeNewName = sanitizePatchFileName(newFile.name);

  return [
    `--- a/${safeOldName}`,
    `+++ b/${safeNewName}`,
    createHunkHeader(oldLineSet.lines.length, newLineSet.lines.length),
    ...formatPatchLines("-", oldLineSet),
    ...formatPatchLines("+", newLineSet)
  ].join("\n");
}

interface PatchLineSet {
  lines: string[];
  needsNoNewlineMarker: boolean;
}

function createHunkHeader(oldLineCount: number, newLineCount: number): string {
  return `@@ -${getHunkStart(oldLineCount)},${oldLineCount} +${getHunkStart(newLineCount)},${newLineCount} @@`;
}

function getHunkStart(lineCount: number): 0 | 1 {
  return lineCount === 0 ? 0 : 1;
}

function getPatchLineSet(contents: string): PatchLineSet {
  if (contents.length === 0) {
    return {
      lines: [],
      needsNoNewlineMarker: false
    };
  }

  const lines = contents.split("\n");

  if (lines.at(-1) === "") {
    return {
      lines: lines.slice(0, -1),
      needsNoNewlineMarker: false
    };
  }

  return {
    lines,
    needsNoNewlineMarker: true
  };
}

function formatPatchLines(prefix: "-" | "+", lineSet: PatchLineSet): string[] {
  return lineSet.lines.flatMap((line, index) => {
    const prefixedLine = `${prefix}${line}`;

    if (lineSet.needsNoNewlineMarker && index === lineSet.lines.length - 1) {
      return [prefixedLine, "\\ No newline at end of file"];
    }

    return [prefixedLine];
  });
}

function sanitizePatchFileName(name: string): string {
  return name.replace(/[\r\n]/g, "_");
}
