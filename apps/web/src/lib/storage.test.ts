import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialDocument, defaultSettings } from "../features/diff-workbench/fixtures";
import { saveDocuments, saveSettings } from "./storage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storage saves", () => {
  it("does not throw when saving documents fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });

    expect(() => saveDocuments([createInitialDocument()])).not.toThrow();
  });

  it("does not throw when saving settings fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });

    expect(() => saveSettings(defaultSettings)).not.toThrow();
  });
});
