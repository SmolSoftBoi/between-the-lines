import { SegmentedControl } from "../../components/SegmentedControl";
import type { DiffDocument, DiffStats, ReviewAnnotation, ViewerSettings } from "./types";

interface InspectorPanelProps {
  document: DiffDocument;
  history: DiffDocument[];
  stats: DiffStats;
  settings: ViewerSettings;
  onAddAnnotation(annotation: ReviewAnnotation): void;
  onResolveAnnotation(id: string): void;
  onLoadDocument(document: DiffDocument): void;
  onSettingsChange(settings: Partial<ViewerSettings>): void;
}

export function InspectorPanel({
  document,
  history,
  stats,
  settings,
  onAddAnnotation,
  onResolveAnnotation,
  onLoadDocument,
  onSettingsChange
}: InspectorPanelProps) {
  return (
    <aside className="panel inspector-panel" aria-label="Review inspector">
      <section className="inspector-section stats-grid" aria-label="Diff stats">
        <Stat label="Files" value={stats.files} />
        <Stat label="Added" value={`+${stats.additions}`} tone="addition" />
        <Stat label="Deleted" value={`-${stats.deletions}`} tone="deletion" />
        <Stat label="Size" value={stats.sizeBucket} />
      </section>

      <section className="inspector-section">
        <div className="section-heading">
          <h2>Annotations</h2>
          <span>{document.annotations.filter((item) => item.status === "open").length} open</span>
        </div>
        <AnnotationForm onAddAnnotation={onAddAnnotation} />
        <div className="annotation-list">
          {document.annotations.length === 0 ? (
            <p className="empty-state">No annotations yet.</p>
          ) : (
            document.annotations.map((annotation) => (
              <article className="annotation-card" data-status={annotation.status} key={annotation.id}>
                <div>
                  <strong>
                    {annotation.side} line {annotation.lineNumber}
                  </strong>
                  <p>{annotation.note}</p>
                </div>
                {annotation.status === "open" ? (
                  <button type="button" onClick={() => onResolveAnnotation(annotation.id)}>
                    Resolve
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="inspector-section">
        <div className="section-heading">
          <h2>Settings</h2>
        </div>
        <label className="checkbox-row">
          <input
            checked={settings.lineNumbers}
            type="checkbox"
            onChange={(event) => onSettingsChange({ lineNumbers: event.target.checked })}
          />
          Line numbers
        </label>
        <SegmentedControl
          label="Theme"
          value={settings.themeType}
          options={[
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
            { label: "System", value: "system" }
          ]}
          onChange={(themeType) =>
            onSettingsChange({
              themeType,
              theme: themeType === "dark" ? "pierre-dark" : "pierre-light"
            })
          }
        />
        <label className="range-field">
          <span>Collapsed context: {settings.collapsedContextThreshold}</span>
          <input
            max="40"
            min="4"
            type="range"
            value={settings.collapsedContextThreshold}
            onChange={(event) =>
              onSettingsChange({ collapsedContextThreshold: Number(event.target.value) })
            }
          />
        </label>
      </section>

      <section className="inspector-section">
        <div className="section-heading">
          <h2>History</h2>
          <span>{history.length} saved</span>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <p className="empty-state">Save a snapshot to keep it here.</p>
          ) : (
            history.map((item) => (
              <button className="history-item" key={item.id} type="button" onClick={() => onLoadDocument(item)}>
                <span>{item.title}</span>
                <time>{new Date(item.updatedAt).toLocaleString()}</time>
              </button>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone?: "addition" | "deletion";
}) {
  return (
    <div className="stat" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AnnotationForm({
  onAddAnnotation
}: {
  onAddAnnotation(annotation: ReviewAnnotation): void;
}) {
  const addAnnotation = (formData: FormData) => {
    const note = String(formData.get("note") ?? "").trim();
    const lineNumber = Number(formData.get("lineNumber") ?? "1");
    const side = formData.get("side") === "deletions" ? "deletions" : "additions";

    if (!note || Number.isNaN(lineNumber) || lineNumber < 1) {
      return;
    }

    onAddAnnotation({
      id: crypto.randomUUID(),
      side,
      lineNumber,
      note,
      status: "open",
      createdAt: new Date().toISOString()
    });
  };

  return (
    <form
      className="annotation-form"
      action={(formData) => {
        addAnnotation(formData);
      }}
    >
      <div className="annotation-form__row">
        <label>
          <span>Side</span>
          <select name="side" defaultValue="additions">
            <option value="additions">Additions</option>
            <option value="deletions">Deletions</option>
          </select>
        </label>
        <label>
          <span>Line</span>
          <input name="lineNumber" min="1" type="number" defaultValue="1" />
        </label>
      </div>
      <label>
        <span>Note</span>
        <textarea name="note" rows={3} placeholder="Add a private review note" />
      </label>
      <button type="submit">Add annotation</button>
    </form>
  );
}
