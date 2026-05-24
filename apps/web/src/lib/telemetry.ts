import type { DiffStats, TextSizeBucket } from "../features/diff-workbench/types";

export type TelemetryPlatform = "web" | "iOS" | "macOS";

export type TelemetryProperty =
  | string
  | number
  | boolean
  | TextSizeBucket
  | null;

export interface TelemetryEvent {
  name: TelemetryEventName;
  platform: TelemetryPlatform;
  appVersion: string;
  sessionId: string;
  timestamp: string;
  properties: Record<string, TelemetryProperty>;
}

export type TelemetryEventName =
  | "app_opened"
  | "diff_loaded"
  | "render_started"
  | "render_completed"
  | "render_failed"
  | "settings_changed"
  | "annotation_added"
  | "export_requested";

export interface TelemetryClientOptions {
  enabled: boolean;
  endpoint?: string;
  platform: TelemetryPlatform;
  appVersion: string;
}

const allowedTelemetryPropertyKeys = new Set([
  "telemetryOptIn",
  "additions",
  "deletions",
  "files",
  "sizeBucket",
  "durationBucket",
  "changedSettings",
  "side",
  "lineBucket",
  "format"
]);

export function createTelemetryClient(options: TelemetryClientOptions) {
  const sessionId = crypto.randomUUID();

  return {
    track(name: TelemetryEventName, properties: Record<string, TelemetryProperty> = {}) {
      if (!options.enabled || !options.endpoint) {
        return;
      }

      const event = createTelemetryEvent({
        name,
        platform: options.platform,
        appVersion: options.appVersion,
        sessionId,
        properties
      });

      const body = JSON.stringify(event);

      if (trySendBeacon(options.endpoint, body)) {
        return;
      }

      try {
        void fetch(options.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body,
          keepalive: true
        }).catch(() => {
          // Telemetry is best effort and must never affect local diff work.
        });
      } catch {
        return;
      }
    }
  };
}

export function createTelemetryEvent(input: {
  name: TelemetryEventName;
  platform: TelemetryPlatform;
  appVersion: string;
  sessionId: string;
  properties?: Record<string, TelemetryProperty>;
}): TelemetryEvent {
  return {
    name: input.name,
    platform: input.platform,
    appVersion: input.appVersion,
    sessionId: input.sessionId,
    timestamp: new Date().toISOString(),
    properties: sanitizeTelemetryProperties(input.properties ?? {})
  };
}

export function statsToTelemetryProperties(stats: DiffStats): Record<string, TelemetryProperty> {
  return {
    additions: stats.additions,
    deletions: stats.deletions,
    files: stats.files,
    sizeBucket: stats.sizeBucket
  };
}

export function sanitizeTelemetryProperties(
  properties: Record<string, TelemetryProperty>
): Record<string, TelemetryProperty> {
  return Object.entries(properties).reduce<Record<string, TelemetryProperty>>(
    (safeProperties, [key, value]) => {
      if (!allowedTelemetryPropertyKeys.has(key)) {
        return safeProperties;
      }

      safeProperties[key] = value;
      return safeProperties;
    },
    {}
  );
}

function trySendBeacon(endpoint: string, body: string): boolean {
  try {
    const sendBeacon = navigator.sendBeacon;

    if (!sendBeacon) {
      return false;
    }

    return sendBeacon.call(navigator, endpoint, new Blob([body], { type: "application/json" })) === true;
  } catch {
    return false;
  }
}
