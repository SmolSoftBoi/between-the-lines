import { SegmentedControl } from "../../components/SegmentedControl";
import { ToolbarButton } from "../../components/ToolbarButton";
import type { DiffSource, ViewerSettings } from "./types";

interface HeaderToolbarProps {
  title: string;
  mode: DiffSource["kind"];
  telemetryOptIn: boolean;
  onModeChange(mode: DiffSource["kind"]): void;
  onTitleChange(title: string): void;
  onSaveSnapshot(): void;
  onExport(format: "patch" | "json"): void;
  onTelemetryChange(enabled: boolean): void;
  settings: ViewerSettings;
}

export function HeaderToolbar({
  title,
  mode,
  telemetryOptIn,
  onModeChange,
  onTitleChange,
  onSaveSnapshot,
  onExport,
  onTelemetryChange
}: HeaderToolbarProps) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          BtL
        </div>
        <div>
          <p className="app-header__eyebrow">Private local workbench</p>
          <label className="title-field">
            <span className="sr-only">Document title</span>
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </label>
        </div>
      </div>

      <SegmentedControl
        label="Diff source"
        value={mode}
        options={[
          { label: "File Pair", value: "file-pair" },
          { label: "Patch", value: "patch" }
        ]}
        onChange={onModeChange}
      />

      <div className="header-actions">
        <ToolbarButton icon="↓" label="Patch" onClick={() => onExport("patch")} />
        <ToolbarButton icon="{}" label="JSON" onClick={() => onExport("json")} />
        <ToolbarButton icon="＋" label="Snapshot" onClick={onSaveSnapshot} />
        <label className="telemetry-toggle">
          <input
            checked={telemetryOptIn}
            type="checkbox"
            onChange={(event) => onTelemetryChange(event.target.checked)}
          />
          <span>Telemetry {telemetryOptIn ? "on" : "off"}</span>
        </label>
      </div>
    </header>
  );
}
