import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("marks the active button with aria-pressed and data-active", () => {
    render(
      <SegmentedControl
        label="View"
        value="split"
        options={[
          { label: "Split", value: "split" },
          { label: "Unified", value: "unified" }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("data-active", "false");
  });

  it("updates the selected button when clicked", () => {
    const onChange = vi.fn();

    function ExampleSegmentedControl() {
      const [value, setValue] = useState<"split" | "unified">("split");

      return (
        <SegmentedControl
          label="View"
          value={value}
          options={[
            { label: "Split", value: "split" },
            { label: "Unified", value: "unified" }
          ]}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
      );
    }

    render(<ExampleSegmentedControl />);

    fireEvent.click(screen.getByRole("button", { name: "Unified" }));

    expect(onChange).toHaveBeenCalledWith("unified");
    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("aria-pressed", "true");
  });
});
