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
  return patch.split("\n").reduce(
    (stats, line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return stats;
      }

      if (line.startsWith("+")) {
        stats.additions += 1;
      }

      if (line.startsWith("-")) {
        stats.deletions += 1;
      }

      return stats;
    },
    { additions: 0, deletions: 0 }
  );
}

function countPatchFiles(patch: string): number {
  const matches = patch.match(/^diff --git /gm);
  if (matches && matches.length > 0) {
    return matches.length;
  }

  return patch.trim().length > 0 ? 1 : 0;
}

function countChangedLines(
  oldContents: string,
  newContents: string
): Pick<DiffStats, "additions" | "deletions"> {
  const oldLines = splitComparableLines(oldContents);
  const newLines = splitComparableLines(newContents);
  const maxLength = Math.max(oldLines.length, newLines.length);
  let additions = 0;
  let deletions = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];

    if (oldLine === newLine) {
      continue;
    }

    if (oldLine !== undefined && newLine !== undefined) {
      additions += 1;
      deletions += 1;
      continue;
    }

    if (newLine !== undefined) {
      additions += 1;
    }

    if (oldLine !== undefined) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function splitComparableLines(contents: string): string[] {
  if (contents === "") {
    return [];
  }

  return contents.split("\n");
}
