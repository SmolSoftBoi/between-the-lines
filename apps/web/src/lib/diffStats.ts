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
    const patchStats = analysePatch(source.patch);

    return {
      additions: patchStats.additions,
      deletions: patchStats.deletions,
      files: patchStats.files,
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

function analysePatch(patch: string): Pick<DiffStats, "additions" | "deletions" | "files"> {
  const lines = patch.split("\n");
  let additions = 0;
  let deletions = 0;
  let headerPairs = 0;
  let hunkLineCounts: HunkLineCounts | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (hunkLineCounts === null && line.startsWith("diff --git ")) {
      continue;
    }

    if (hunkLineCounts === null && isPatchFileHeaderPair(lines, index)) {
      headerPairs += 1;
      index += 1;
      continue;
    }

    const parsedHunkLineCounts = parseHunkLineCounts(line);
    if (parsedHunkLineCounts) {
      hunkLineCounts = parsedHunkLineCounts;
      continue;
    }

    if (hunkLineCounts === null) {
      if (line.startsWith("+")) {
        additions += 1;
      }

      if (line.startsWith("-")) {
        deletions += 1;
      }

      continue;
    }

    if (line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
      hunkLineCounts.newLines -= 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
      hunkLineCounts.oldLines -= 1;
    } else {
      hunkLineCounts.oldLines -= 1;
      hunkLineCounts.newLines -= 1;
    }

    if (hunkLineCounts.oldLines <= 0 && hunkLineCounts.newLines <= 0) {
      hunkLineCounts = null;
    }
  }

  const gitFiles = countGitPatchFiles(lines);

  return {
    additions,
    deletions,
    files: gitFiles > 0 ? gitFiles : countFallbackPatchFiles(patch, headerPairs)
  };
}

interface HunkLineCounts {
  oldLines: number;
  newLines: number;
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

function parseHunkLineCounts(line: string): HunkLineCounts | null {
  const match = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/u.exec(line);
  if (!match) {
    return null;
  }

  return {
    oldLines: match[1] === undefined ? 1 : Number.parseInt(match[1], 10),
    newLines: match[2] === undefined ? 1 : Number.parseInt(match[2], 10)
  };
}

function countGitPatchFiles(lines: string[]): number {
  return lines.filter((line) => line.startsWith("diff --git ")).length;
}

function countFallbackPatchFiles(patch: string, headerPairs: number): number {
  if (headerPairs > 0) {
    return headerPairs;
  }

  return patch.trim().length > 0 ? 1 : 0;
}

function countChangedLines(
  oldContents: string,
  newContents: string
): Pick<DiffStats, "additions" | "deletions"> {
  const oldLines = splitComparableLines(oldContents);
  const newLines = splitComparableLines(newContents);
  const unchangedEdges = countUnchangedEdgeLines(oldLines, newLines);
  const oldChangedCount = oldLines.length - unchangedEdges.prefix - unchangedEdges.suffix;
  const newChangedCount = newLines.length - unchangedEdges.prefix - unchangedEdges.suffix;

  if (oldChangedCount === 0 || newChangedCount === 0) {
    return {
      additions: newChangedCount,
      deletions: oldChangedCount
    };
  }

  if (
    oldChangedCount <= MAX_EXACT_LINE_COMPARISONS / newChangedCount
  ) {
    const commonLines = countCommonLines(
      oldLines.slice(unchangedEdges.prefix, oldLines.length - unchangedEdges.suffix),
      newLines.slice(unchangedEdges.prefix, newLines.length - unchangedEdges.suffix)
    );

    return {
      additions: newChangedCount - commonLines,
      deletions: oldChangedCount - commonLines
    };
  }

  return {
    additions: newChangedCount,
    deletions: oldChangedCount
  };
}

const MAX_EXACT_LINE_COMPARISONS = 250_000;

function splitComparableLines(contents: string): string[] {
  if (contents === "") {
    return [];
  }

  return contents.split("\n");
}

function countUnchangedEdgeLines(
  oldLines: string[],
  newLines: string[]
): { prefix: number; suffix: number } {
  const shortestLineCount = Math.min(oldLines.length, newLines.length);
  let prefix = 0;

  while (prefix < shortestLineCount && oldLines[prefix] === newLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const oldSuffixLimit = oldLines.length - prefix;
  const newSuffixLimit = newLines.length - prefix;

  while (
    suffix < oldSuffixLimit &&
    suffix < newSuffixLimit &&
    oldLines[oldLines.length - suffix - 1] === newLines[newLines.length - suffix - 1]
  ) {
    suffix += 1;
  }

  return { prefix, suffix };
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
