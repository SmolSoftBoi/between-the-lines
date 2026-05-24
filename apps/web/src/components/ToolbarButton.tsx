import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function ToolbarButton({ icon, label, ...props }: ToolbarButtonProps) {
  return (
    <button {...props} className="toolbar-button" type={props.type ?? "button"}>
      <span aria-hidden="true" className="toolbar-button__icon">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
