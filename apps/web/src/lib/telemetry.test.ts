import { describe, expect, it } from "vitest";
import { createTelemetryEvent, sanitizeTelemetryProperties } from "./telemetry";

describe("sanitizeTelemetryProperties", () => {
  it("drops sensitive keys before events leave the app", () => {
    expect(
      sanitizeTelemetryProperties({
        sizeBucket: "small",
        fileName: "private.ts",
        patch: "raw patch",
        repositoryUrl: "https://example.test/private",
        durationMs: 42
      })
    ).toEqual({
      sizeBucket: "small",
      durationMs: 42
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
