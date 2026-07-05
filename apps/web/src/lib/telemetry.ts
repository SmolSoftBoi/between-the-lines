import type {
  DiffStats,
  TelemetrySettingName,
  TextSizeBucket,
  ViewerSettings
} from "../features/diff-workbench/types";

export type TelemetryPlatform = "web" | "iOS" | "macOS";
export type TelemetryEnvironment = "development" | "preview" | "production";

export type TelemetryProperty =
  | string
  | number
  | boolean
  | TextSizeBucket
  | null;

export interface TelemetryEvent {
  event_name: TelemetryEventName;
  event_version: number;
  occurred_at: string;
  environment: TelemetryEnvironment;
  release_sha: string;
  session_id: string;
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
  environment: TelemetryEnvironment;
  platform: TelemetryPlatform;
  releaseSha: string;
}

const allowedTelemetryPropertyKeys = new Set([
  "additions",
  "deletions",
  "duration_bucket",
  "files",
  "format",
  "line_bucket",
  "platform",
  "setting",
  "side",
  "size_bucket"
]);

const telemetrySettingNames: Array<{
  key: keyof ViewerSettings;
  name: TelemetrySettingName;
}> = [
  { key: "diffStyle", name: "diff_style" },
  { key: "overflow", name: "overflow" },
  { key: "lineNumbers", name: "line_numbers" },
  { key: "themeType", name: "theme_type" },
  { key: "theme", name: "theme" },
  { key: "lineDiffType", name: "line_diff_type" },
  { key: "collapsedContextThreshold", name: "collapsed_context_threshold" },
  { key: "telemetryOptIn", name: "telemetry_opt_in" }
];

export function createTelemetryClient(options: TelemetryClientOptions) {
  const sessionId = crypto.randomUUID();

  return {
    track(name: TelemetryEventName, properties: Record<string, TelemetryProperty> = {}) {
      if (!options.enabled || !options.endpoint) {
        return;
      }

      const event = createTelemetryEvent({
        environment: options.environment,
        name,
        platform: options.platform,
        releaseSha: options.releaseSha,
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
  environment: TelemetryEnvironment;
  name: TelemetryEventName;
  platform: TelemetryPlatform;
  releaseSha: string;
  sessionId: string;
  properties?: Record<string, TelemetryProperty>;
}): TelemetryEvent {
  return {
    event_name: input.name,
    event_version: 1,
    occurred_at: new Date().toISOString(),
    environment: input.environment,
    release_sha: input.releaseSha,
    session_id: input.sessionId,
    properties: sanitizeTelemetryProperties({
      ...(input.properties ?? {}),
      platform: input.platform
    })
  };
}

export function statsToTelemetryProperties(stats: DiffStats): Record<string, TelemetryProperty> {
  return {
    additions: stats.additions,
    deletions: stats.deletions,
    files: stats.files,
    size_bucket: stats.sizeBucket
  };
}

export function getTelemetryEnvironment(value: string | undefined): TelemetryEnvironment {
  if (value === "preview" || value === "production") {
    return value;
  }

  return "development";
}

export function getTelemetrySettingName(
  settings: Partial<ViewerSettings>
): TelemetrySettingName | undefined {
  return telemetrySettingNames.find(({ key }) => key in settings)?.name;
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
