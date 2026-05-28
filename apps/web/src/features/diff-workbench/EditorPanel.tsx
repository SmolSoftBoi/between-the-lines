import type { ChangeEvent } from "react";
import { SegmentedControl } from "../../components/SegmentedControl";
import type { DiffDocument, DiffFileVersion, DiffSource } from "./types";

interface EditorPanelProps {
  document: DiffDocument;
  mode: DiffSource["kind"];
  onModeChange(mode: DiffSource["kind"]): void;
  onSourceChange(source: DiffSource): void;
}

export function EditorPanel({ document, mode, onModeChange, onSourceChange }: EditorPanelProps) {
  return (
    <aside className="panel editor-panel" aria-label="Diff inputs">
      <div className="panel__header">
        <div>
          <h2>Inputs</h2>
          <p>Paste text, load files, or render a patch.</p>
        </div>
        <SegmentedControl
          label="Input mode"
          value={mode}
          options={[
            { label: "Pair", value: "file-pair" },
            { label: "Patch", value: "patch" }
          ]}
          onChange={onModeChange}
        />
      </div>

      {document.source.kind === "file-pair" ? (
        <FilePairEditor source={document.source} onSourceChange={onSourceChange} />
      ) : (
        <PatchEditor source={document.source} onSourceChange={onSourceChange} />
      )}
    </aside>
  );
}

function FilePairEditor({
  source,
  onSourceChange
}: {
  source: Extract<DiffSource, { kind: "file-pair" }>;
  onSourceChange(source: DiffSource): void;
}) {
  const updateFile = (side: "oldFile" | "newFile", nextFile: DiffFileVersion) => {
    onSourceChange({
      ...source,
      [side]: nextFile
    });
  };

  return (
    <div className="editor-stack">
      <FileInput
        label="Old"
        file={source.oldFile}
        onFileChange={(file) => updateFile("oldFile", file)}
      />
      <FileInput
        label="New"
        file={source.newFile}
        onFileChange={(file) => updateFile("newFile", file)}
      />
    </div>
  );
}

function FileInput({
  label,
  file,
  onFileChange
}: {
  label: string;
  file: DiffFileVersion;
  onFileChange(file: DiffFileVersion): void;
}) {
  const update = (patch: Partial<DiffFileVersion>) => {
    const nextName = patch.name ?? file.name;
    const contents = patch.contents ?? file.contents;
    onFileChange({
      ...file,
      ...patch,
      cacheKey: `${nextName}-${contents.length}-${Date.now()}`
    });
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    update({
      name: selectedFile.name,
      contents: await selectedFile.text()
    });
  };

  return (
    <section className="editor-block">
      <div className="editor-block__header">
        <strong>{label}</strong>
        <label className="file-import">
          <span>Import</span>
          <input type="file" onChange={importFile} />
        </label>
      </div>
      <label className="field-label">
        <span>File name</span>
        <input value={file.name} onChange={(event) => update({ name: event.target.value })} />
      </label>
      <textarea
        aria-label={`${label} file contents`}
        spellCheck={false}
        value={file.contents}
        onChange={(event) => update({ contents: event.target.value })}
      />
    </section>
  );
}

function PatchEditor({
  source,
  onSourceChange
}: {
  source: Extract<DiffSource, { kind: "patch" }>;
  onSourceChange(source: DiffSource): void;
}) {
  return (
    <section className="editor-block editor-block--patch">
      <label className="field-label">
        <span>Unified patch</span>
        <textarea
          aria-label="Unified patch"
          spellCheck={false}
          value={source.patch}
          onChange={(event) =>
            onSourceChange({
              kind: "patch",
              patch: event.target.value
            })
          }
        />
      </label>
    </section>
  );
}
