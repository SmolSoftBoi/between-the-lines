import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./fixtures";
import { InspectorPanel } from "./InspectorPanel";
import type { DiffDocument, DiffStats } from "./types";

const baseStats: DiffStats = {
  additions: 1,
  deletions: 1,
  files: 1,
  sizeBucket: "small"
};

describe("InspectorPanel annotations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["decimal", "1.5"],
    ["zero", "0"],
    ["negative", "-1"],
    ["blank", ""]
  ])("rejects a %s line number", (_label, lineNumber) => {
    const { form, onAddAnnotation } = renderInspectorPanel();

    fillAnnotationForm(lineNumber);
    fireEvent.submit(form);

    expect(onAddAnnotation).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric line number", () => {
    const OriginalFormData = FormData;

    class NonNumericLineFormData extends OriginalFormData {
      override get(name: string): FormDataEntryValue | null {
        if (name === "lineNumber") {
          return "abc";
        }

        return super.get(name);
      }
    }

    vi.stubGlobal("FormData", NonNumericLineFormData);
    const { form, onAddAnnotation } = renderInspectorPanel();

    fillAnnotationForm("1");
    fireEvent.submit(form);

    expect(onAddAnnotation).not.toHaveBeenCalled();
  });

  it("accepts a valid integer line number", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const { form, onAddAnnotation } = renderInspectorPanel();

    fillAnnotationForm("12");
    fireEvent.submit(form);

    expect(onAddAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000001",
        side: "additions",
        lineNumber: 12,
        note: "Needs a closer look",
        status: "open",
        createdAt: expect.any(String)
      })
    );
  });
});

function renderInspectorPanel() {
  const onAddAnnotation = vi.fn();
  const { container } = render(
    <InspectorPanel
      document={createDocument()}
      history={[]}
      settings={defaultSettings}
      stats={baseStats}
      onAddAnnotation={onAddAnnotation}
      onLoadDocument={vi.fn()}
      onResolveAnnotation={vi.fn()}
      onSettingsChange={vi.fn()}
    />
  );
  const form = container.querySelector("form");

  if (!form) {
    throw new Error("Expected annotation form to render.");
  }

  return { form, onAddAnnotation };
}

function fillAnnotationForm(lineNumber: string): void {
  fireEvent.change(screen.getByLabelText("Line"), {
    target: { value: lineNumber }
  });
  fireEvent.change(screen.getByLabelText("Note"), {
    target: { value: "Needs a closer look" }
  });
}

function createDocument(): DiffDocument {
  return {
    id: "document-1",
    title: "Review notes",
    source: {
      kind: "patch",
      patch: "@@ -1,1 +1,1 @@\n-old\n+new"
    },
    settings: defaultSettings,
    annotations: [],
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z"
  };
}
