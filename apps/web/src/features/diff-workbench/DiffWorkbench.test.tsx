import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeBridgeHandlers } from "../../lib/nativeBridge";
import type {
  TelemetryClientOptions,
  TelemetryEventName,
  TelemetryProperty
} from "../../lib/telemetry";
import { DiffWorkbench } from "./DiffWorkbench";
import { defaultSettings } from "./fixtures";
import type { DiffDocument, NativeRendererMessage, ViewerSettings } from "./types";

const nativeBridgeMock = vi.hoisted(() => ({
  installNativeBridge: vi.fn<(_handlers: NativeBridgeHandlers) => () => void>(() => vi.fn()),
  postNativeMessage: vi.fn<(_message: NativeRendererMessage) => void>()
}));

const storageMock = vi.hoisted(() => ({
  documents: [] as DiffDocument[],
  loadDocuments: vi.fn(() => storageMock.documents),
  loadSettings: vi.fn((settings: ViewerSettings) => settings),
  saveDocuments: vi.fn<(_documents: DiffDocument[]) => void>(),
  saveSettings: vi.fn<(_settings: ViewerSettings) => void>()
}));

type TrackTelemetry = (
  name: TelemetryEventName,
  properties?: Record<string, TelemetryProperty>
) => void;

const telemetryMock = vi.hoisted(() => ({
  clients: [] as Array<{
    options: TelemetryClientOptions;
    track: ReturnType<typeof vi.fn<TrackTelemetry>>;
  }>,
  createTelemetryClient: vi.fn((options: TelemetryClientOptions) => {
    const track = vi.fn<TrackTelemetry>();
    telemetryMock.clients.push({ options, track });
    return { track };
  })
}));

vi.mock("../../lib/nativeBridge", () => nativeBridgeMock);

vi.mock("../../lib/storage", () => storageMock);

vi.mock("../../lib/telemetry", async () => {
  const actual = await vi.importActual<typeof import("../../lib/telemetry")>(
    "../../lib/telemetry"
  );

  return {
    ...actual,
    createTelemetryClient: telemetryMock.createTelemetryClient
  };
});

vi.mock("./DiffViewer", () => ({
  DiffViewer: () => null
}));

vi.mock("./EditorPanel", () => ({
  EditorPanel: () => null
}));

vi.mock("./InspectorPanel", () => ({
  InspectorPanel: () => null
}));

vi.mock("./HeaderToolbar", () => ({
  HeaderToolbar: ({
    onTelemetryChange,
    onSaveSnapshot,
    onTitleChange
  }: {
    onTelemetryChange(telemetryOptIn: boolean): void;
    onSaveSnapshot(): void;
    onTitleChange(title: string): void;
  }) => (
    <div>
      <button type="button" onClick={onSaveSnapshot}>
        Save snapshot
      </button>
      <button type="button" onClick={() => onTitleChange("Updated title")}>
        Update title
      </button>
      <button type="button" onClick={() => onTelemetryChange(false)}>
        Disable telemetry
      </button>
    </div>
  )
}));

const currentDocumentId = "00000000-0000-4000-8000-000000000001";
const currentAnnotationId = "00000000-0000-4000-8000-000000000002";
const otherDocumentId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  storageMock.documents = [];
  storageMock.loadDocuments.mockClear();
  storageMock.loadSettings.mockClear();
  storageMock.loadSettings.mockImplementation((settings: ViewerSettings) => settings);
  storageMock.saveDocuments.mockClear();
  storageMock.saveSettings.mockClear();
  telemetryMock.clients = [];
  telemetryMock.createTelemetryClient.mockClear();
  nativeBridgeMock.installNativeBridge.mockClear();
  nativeBridgeMock.postNativeMessage.mockClear();
  vi.spyOn(crypto, "randomUUID")
    .mockReturnValueOnce(currentDocumentId)
    .mockReturnValueOnce(currentAnnotationId);
  vi.stubGlobal("requestAnimationFrame", vi.fn<(_callback: FrameRequestCallback) => number>(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DiffWorkbench telemetry", () => {
  it("does not send a settings event when telemetry is switched off", async () => {
    storageMock.loadSettings.mockImplementation((settings: ViewerSettings) => ({
      ...settings,
      telemetryOptIn: true
    }));

    render(<DiffWorkbench />);

    await waitFor(() => expect(nativeBridgeMock.postNativeMessage).toHaveBeenCalledOnce());
    const enabledTelemetryClient = telemetryMock.clients[0];
    enabledTelemetryClient.track.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Disable telemetry" }));

    await waitFor(() =>
      expect(storageMock.saveSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({ telemetryOptIn: false })
      )
    );
    expect(enabledTelemetryClient.track).not.toHaveBeenCalled();
  });
});

describe("DiffWorkbench native bridge lifecycle", () => {
  it("keeps the bridge listener stable across document rerenders", async () => {
    render(<DiffWorkbench />);

    await waitFor(() => expect(nativeBridgeMock.installNativeBridge).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Update title" }));

    expect(nativeBridgeMock.installNativeBridge).toHaveBeenCalledOnce();
  });

  it("does not resend render messages when only the title changes", async () => {
    render(<DiffWorkbench />);

    await waitFor(() => expect(nativeBridgeMock.postNativeMessage).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Update title" }));

    expect(nativeBridgeMock.postNativeMessage).toHaveBeenCalledOnce();
  });
});

describe("DiffWorkbench history", () => {
  it("replaces an existing snapshot for the current document id", async () => {
    storageMock.documents = [
      createHistoryDocument(currentDocumentId, "Older copy"),
      createHistoryDocument(otherDocumentId, "Other document")
    ];

    render(<DiffWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Save snapshot" }));

    await waitFor(() => expect(storageMock.saveDocuments).toHaveBeenCalledOnce());
    expect(storageMock.saveDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: currentDocumentId,
        title: "Invoice formatter review"
      }),
      expect.objectContaining({
        id: otherDocumentId,
        title: "Other document"
      })
    ]);
  });
});

function createHistoryDocument(id: string, title: string): DiffDocument {
  return {
    id,
    title,
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
