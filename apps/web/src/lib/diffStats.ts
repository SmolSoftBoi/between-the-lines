import type {
  DiffDocument,
  DiffSource,
  DiffStats,
  TextSizeBucket
} from "../features/diff-workbench/types";

export function bucketTextSize(characterCount: number): TextSizeBucket {
  if (characterCount === 0) {
    return "empty";
  }

  if (characterCount < 5_000) {
    return "small";
  }

  if (characterCount < 50_000) {
    return "medium";
  }

  if (characterCount < 250_000) {
    return "large";
  }

  return "huge";
}

export function getDocumentStats(document: DiffDocument): DiffStats {
  return getSourceStats(document.source);
}

export function getSourceStats(source: DiffSource): DiffStats {
  if (source.kind === "patch") {
    return {
      ...countPatchLines(source.patch),
      files: countPatchFiles(source.patch),
      sizeBucket: bucketTextSize(source.patch.length)
    };
  }

  const changedLines = countChangedLines(
    source.oldFile.contents,
    source.newFile.contents
  );

  return {
    additions: changedLines.additions,
    deletions: changedLines.deletions,
    files: 1,
    sizeBucket: bucketTextSize(
      source.oldFile.contents.length + source.newFile.contents.length
    )
  };
}

function countPatchLines(patch: string): Pick<DiffStats, "additions" | "deletions"> {
  const lines = patch.split("\n");
  let additions = 0;
  let deletions = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("diff --git ")) {
      continue;
    }

    if (isPatchFileHeaderPair(lines, index)) {
      index += 1;
      continue;
    }

    if (line.startsWith("@@ ")) {
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
    }

    if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function isPatchFileHeaderPair(lines: string[], index: number): boolean {
  const afterNewHeader = lines[index + 2];

  return (
    isOldPatchFileHeader(lines[index]) &&
    isNewPatchFileHeader(lines[index + 1]) &&
    (afterNewHeader === undefined || afterNewHeader.startsWith("@@ "))
  );
}

function isOldPatchFileHeader(line: string | undefined): boolean {
  return line === "---" || line?.startsWith("--- ") === true || line?.startsWith("---\t") === true;
}

function isNewPatchFileHeader(line: string | undefined): boolean {
  return line === "+++" || line?.startsWith("+++ ") === true || line?.startsWith("+++\t") === true;
}

function countPatchFiles(patch: string): number {
  const matches = patch.match(/^diff --git /gm);
  if (matches && matches.length > 0) {
    return matches.length;
  }

  const headerPairs = countPatchFileHeaderPairs(patch.split("\n"));
  if (headerPairs > 0) {
    return headerPairs;
  }

  return patch.trim().length > 0 ? 1 : 0;
}

function countPatchFileHeaderPairs(lines: string[]): number {
  let files = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (isPatchFileHeaderPair(lines, index)) {
      files += 1;
      index += 1;
    }
  }

  return files;
}

function countChangedLines(
  oldContents: string,
  newContents: string
): Pick<DiffStats, "additions" | "deletions"> {
  const oldLines = splitComparableLines(oldContents);
  const newLines = splitComparableLines(newContents);
  const commonLines = countCommonLines(oldLines, newLines);

  return {
    additions: newLines.length - commonLines,
    deletions: oldLines.length - commonLines
  };
}

function splitComparableLines(contents: string): string[] {
  if (contents === "") {
    return [];
  }

  return contents.split("\n");
}

function countCommonLines(oldLines: string[], newLines: string[]): number {
  if (oldLines.length === 0 || newLines.length === 0) {
    return 0;
  }

  let previousRow = new Array<number>(newLines.length + 1).fill(0);

  for (const oldLine of oldLines) {
    const currentRow = new Array<number>(newLines.length + 1).fill(0);

    for (let index = 1; index <= newLines.length; index += 1) {
      if (oldLine === newLines[index - 1]) {
        currentRow[index] = previousRow[index - 1] + 1;
      } else {
        currentRow[index] = Math.max(previousRow[index], currentRow[index - 1]);
      }
    }

    previousRow = currentRow;
  }

  return previousRow[newLines.length];
}
