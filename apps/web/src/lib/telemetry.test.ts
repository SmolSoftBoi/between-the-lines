import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTelemetryClient,
  createTelemetryEvent,
  sanitizeTelemetryProperties
} from "./telemetry";

const originalSendBeacon = navigator.sendBeacon;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: originalSendBeacon
  });
});

describe("sanitizeTelemetryProperties", () => {
  it("keeps only the currently emitted metadata allow-list", () => {
    expect(
      sanitizeTelemetryProperties({
        telemetryOptIn: true,
        additions: 3,
        deletions: 1,
        files: 2,
        size_bucket: "small",
        duration_bucket: "under_500ms",
        setting: "diff_style",
        side: "additions",
        line_bucket: "top",
        format: "patch",
        contents: "do not include",
        fileName: "private.ts",
        patch: "raw patch",
        repositoryUrl: "https://example.test/private",
        durationMs: 42,
        changedSettings: "diffStyle,theme",
        sizeBucket: "small",
        harmlessUnknown: true
      })
    ).toEqual({
      additions: 3,
      deletions: 1,
      files: 2,
      size_bucket: "small",
      duration_bucket: "under_500ms",
      setting: "diff_style",
      side: "additions",
      line_bucket: "top",
      format: "patch"
    });
  });
});

describe("createTelemetryEvent", () => {
  it("creates a metadata-only event envelope", () => {
    const event = createTelemetryEvent({
      environment: "preview",
      name: "render_completed",
      platform: "web",
      releaseSha: "abc1234",
      sessionId: "session-1",
      properties: {
        files: 1,
        contents: "do not include"
      }
    });

    expect(event).toMatchObject({
      event_name: "render_completed",
      event_version: 1,
      environment: "preview",
      release_sha: "abc1234",
      session_id: "session-1",
      properties: {
        files: 1,
        platform: "web"
      }
    });
    expect(event.occurred_at).toEqual(expect.any(String));
    expect(event.properties).not.toHaveProperty("contents");
  });
});

describe("createTelemetryClient", () => {
  it("does not use fetch when sendBeacon returns true", () => {
    const sendBeacon = vi.fn(() => true);
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    stubSendBeacon(sendBeacon);
    vi.stubGlobal("fetch", fetch);

    createClient().track("app_opened", { telemetryOptIn: true });

    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to fetch when sendBeacon returns false", () => {
    const sendBeacon = vi.fn(() => false);
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    stubSendBeacon(sendBeacon);
    vi.stubGlobal("fetch", fetch);

    createClient().track("app_opened", { telemetryOptIn: true });

    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("falls back to fetch when sendBeacon throws", () => {
    const sendBeacon = vi.fn(() => {
      throw new Error("Beacon unavailable");
    });
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    stubSendBeacon(sendBeacon);
    vi.stubGlobal("fetch", fetch);

    expect(() => createClient().track("app_opened", { telemetryOptIn: true })).not.toThrow();
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
});

function createClient() {
  return createTelemetryClient({
    enabled: true,
    environment: "development",
    endpoint: "https://telemetry.example.test/events",
    platform: "web",
    releaseSha: "local"
  });
}

function stubSendBeacon(sendBeacon: Navigator["sendBeacon"]): void {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon
  });
}
