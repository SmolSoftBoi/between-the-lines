import type { ReactNode } from "react";

interface SegmentedOption<TValue extends string> {
  label: ReactNode;
  value: TValue;
}

interface SegmentedControlProps<TValue extends string> {
  label: string;
  value: TValue;
  options: SegmentedOption<TValue>[];
  onChange(value: TValue): void;
}

export function SegmentedControl<TValue extends string>({
  label,
  value,
  options,
  onChange
}: SegmentedControlProps<TValue>) {
  return (
    <div className="segmented-control" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          className="segmented-control__button"
          aria-pressed={option.value === value}
          data-active={option.value === value}
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
