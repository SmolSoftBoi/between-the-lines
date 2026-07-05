import { describe, expect, it } from "vitest";
import { createFullFilePairPatch } from "./filePairPatch";

describe("createFullFilePairPatch", () => {
  it("creates a full-file patch with real multi-line counts", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "story.txt",
          contents: "line one\n\nline three\n"
        },
        newFile: {
          name: "story.txt",
          contents: "line uno\n\nline tres\n"
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
    ).toBe(
      [
        "--- a/before.txt",
        "+++ b/after.txt",
        "@@ -0,0 +1,1 @@",
        "+created",
        "\\ No newline at end of file"
      ].join("\n")
    );
  });

  it("emits no-newline markers for non-empty sides without trailing line feeds", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "before.txt",
          contents: "a"
        },
        newFile: {
          name: "after.txt",
          contents: "b"
        }
      })
    ).toBe(
      [
        "--- a/before.txt",
        "+++ b/after.txt",
        "@@ -1,1 +1,1 @@",
        "-a",
        "\\ No newline at end of file",
        "+b",
        "\\ No newline at end of file"
      ].join("\n")
    );
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

  it("sanitises line breaks in file names before writing patch headers", () => {
    expect(
      createFullFilePairPatch({
        oldFile: {
          name: "before\rsecret.txt",
          contents: "old\n"
        },
        newFile: {
          name: "after\nsecret.txt",
          contents: "new\n"
        }
      })
    ).toBe(
      [
        "--- a/before_secret.txt",
        "+++ b/after_secret.txt",
        "@@ -1,1 +1,1 @@",
        "-old",
        "+new"
      ].join("\n")
    );
  });
});
