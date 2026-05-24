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
        sizeBucket: "small",
        durationBucket: "short",
        changedSettings: "diffStyle,theme",
        side: "additions",
        lineBucket: "near-start",
        format: "patch",
        contents: "do not include",
        fileName: "private.ts",
        patch: "raw patch",
        repositoryUrl: "https://example.test/private",
        durationMs: 42,
        harmlessUnknown: true
      })
    ).toEqual({
      telemetryOptIn: true,
      additions: 3,
      deletions: 1,
      files: 2,
      sizeBucket: "small",
      durationBucket: "short",
      changedSettings: "diffStyle,theme",
      side: "additions",
      lineBucket: "near-start",
      format: "patch"
    });
  });
});

describe("createTelemetryEvent", () => {
  it("creates a metadata-only event envelope", () => {
    const event = createTelemetryEvent({
      name: "render_completed",
      platform: "web",
      appVersion: "0.1.0",
      sessionId: "session-1",
      properties: {
        files: 1,
        contents: "do not include"
      }
    });

    expect(event).toMatchObject({
      name: "render_completed",
      platform: "web",
      appVersion: "0.1.0",
      sessionId: "session-1",
      properties: {
        files: 1
      }
    });
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
    endpoint: "https://telemetry.example.test/events",
    platform: "web",
    appVersion: "0.1.0"
  });
}

function stubSendBeacon(sendBeacon: Navigator["sendBeacon"]): void {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon
  });
}
