import { describe, expect, it } from "vitest";
import { bucketTextSize, getDocumentStats } from "./diffStats";
import { createInitialDocument } from "../features/diff-workbench/fixtures";

describe("bucketTextSize", () => {
  it("uses coarse buckets only", () => {
    expect(bucketTextSize(0)).toBe("empty");
    expect(bucketTextSize(100)).toBe("small");
    expect(bucketTextSize(20_000)).toBe("medium");
    expect(bucketTextSize(100_000)).toBe("large");
    expect(bucketTextSize(500_000)).toBe("huge");
  });
});

describe("getDocumentStats", () => {
  it("counts patch additions and deletions without file headers", () => {
    const document = createInitialDocument();
    document.source = {
      kind: "patch",
      patch: [
        "--- a/example.ts",
        "+++ b/example.ts",
        "@@ -1,2 +1,2 @@",
        "-const oldValue = 1;",
        "+const newValue = 2;",
        " const shared = true;"
      ].join("\n")
    };

    expect(getDocumentStats(document)).toMatchObject({
      additions: 1,
      deletions: 1,
      files: 1
    });
  });

  it("counts file-pair additions and deletions from one comparison result", () => {
    const document = createInitialDocument();
    document.source = {
      kind: "file-pair",
      oldFile: {
        name: "example.ts",
        contents: ["same", "old", "removed"].join("\n"),
        cacheKey: "old-example"
      },
      newFile: {
        name: "example.ts",
        contents: ["same", "new", "added"].join("\n"),
        cacheKey: "new-example"
      }
    };

    expect(getDocumentStats(document)).toMatchObject({
      additions: 2,
      deletions: 2,
      files: 1
    });
  });
});
