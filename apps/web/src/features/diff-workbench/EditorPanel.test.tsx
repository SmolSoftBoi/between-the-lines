import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorPanel } from "./EditorPanel";
import { createInitialDocument } from "./fixtures";
import type { DiffSource } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditorPanel file-pair inputs", () => {
  it("uses an imported file name when regenerating the cache key", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    const onSourceChange = vi.fn<(source: DiffSource) => void>();
    const document = createInitialDocument();
    const importedFile = new File(["new file contents"], "fresh-name.ts", {
      type: "text/plain"
    });

    render(
      <EditorPanel
        document={document}
        mode="file-pair"
        onModeChange={vi.fn()}
        onSourceChange={onSourceChange}
      />
    );

    const oldFileInput = screen.getAllByLabelText("Import")[0];

    fireEvent.change(oldFileInput, {
      target: {
        files: [importedFile]
      }
    });

    await waitFor(() => expect(onSourceChange).toHaveBeenCalledOnce());

    expect(onSourceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        oldFile: expect.objectContaining({
          cacheKey: "fresh-name.ts-17-1234",
          contents: "new file contents",
          name: "fresh-name.ts"
        })
      })
    );
  });
});
