import { describe, expect, it } from "vitest";
import { createFullFilePairPatch } from "./filePairPatch";

describe("createFullFilePairPatch", () => {
  it("creates a full-file patch with real multi-line counts", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "story.txt",
          contents: "line one\n\nline three"
        },
        newFile: {
          name: "story.txt",
          contents: "line uno\n\nline tres"
        }
      })
    ).toBe(
      [
        "--- a/story.txt",
        "+++ b/story.txt",
        "@@ -1,3 +1,3 @@",
        "-line one",
        "-",
        "-line three",
        "+line uno",
        "+",
        "+line tres"
      ].join("\n")
    );
  });

  it("uses zero starts and counts for empty old and new files", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "empty.txt",
          contents: ""
        },
        newFile: {
          name: "empty.txt",
          contents: ""
        }
      })
    ).toBe(["--- a/empty.txt", "+++ b/empty.txt", "@@ -0,0 +0,0 @@"].join("\n"));
  });

  it("uses zero starts only for the empty side", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "before.txt",
          contents: ""
        },
        newFile: {
          name: "after.txt",
          contents: "created"
        }
      })
    ).toBe(["--- a/before.txt", "+++ b/after.txt", "@@ -0,0 +1,1 @@", "+created"].join("\n"));
  });

  it("does not count a trailing final newline as an extra blank line", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "newline.txt",
          contents: "before\n"
        },
        newFile: {
          name: "newline.txt",
          contents: "after\n"
        }
      })
    ).toBe(
      ["--- a/newline.txt", "+++ b/newline.txt", "@@ -1,1 +1,1 @@", "-before", "+after"].join("\n")
    );
  });
});
