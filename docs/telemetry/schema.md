# 📐 Telemetry Schema

## 🎯 Purpose

Define the first event contract for privacy-first telemetry. The schema intentionally favours coarse, operational fields and rejects personally identifiable information.

## ✉️ Event envelope

Every event should use this envelope:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `event_name` | string | Yes | Lowercase snake case, such as `render_completed`. |
| `event_version` | integer | Yes | Start at `1`; increment only for breaking property changes. |
| `occurred_at` | ISO 8601 string | Yes | Client or server event time in UTC. |
| `received_at` | ISO 8601 string | Yes | Server receipt time in UTC. |
| `environment` | string | Yes | One of `development`, `preview`, or `production`. |
| `release_sha` | string | Yes | Commit or release identifier. |
| `anonymous_subject_id` | string | No | Rotating, salted hash only; never a raw user or device ID. |
| `session_id` | string | No | Random, short-lived identifier; avoid cross-device tracking. |
| `properties` | object | Yes | Event-specific fields from the allow-list below. |

## ✅ Allowed properties

Start with this small allow-list:

| Property | Type | Example | Notes |
| --- | --- | --- | --- |
| `platform` | string | `web` | Use `web`, `ios`, or `macos`. |
| `duration_bucket` | string | `under_500ms` | Prefer coarse timing buckets. |
| `result` | string | `success` | Prefer enums such as `success`, `failure`, or `cancelled`. |
| `error_code` | string | `network_timeout` | Use safe internal codes, not raw exception messages. |
| `diff_style` | string | `split` | Option value only. |
| `overflow` | string | `wrap` | Option value only. |
| `line_diff_type` | string | `word` | Option value only. |
| `size_bucket` | string | `small` | One of `empty`, `small`, `medium`, `large`, `huge`. |
| `files` | integer | `1` | Aggregate count only. |
| `additions` | integer | `24` | Aggregate count only. |
| `deletions` | integer | `11` | Aggregate count only. |

## 🚫 Blocked fields

Events must reject fields that contain personally identifiable information or sensitive content:

- `name`
- `email`
- `phone`
- `address`
- `ip_address`
- `precise_location`
- `payment_*`
- `auth_*`
- `token`
- `secret`
- `free_text`
- `message_body`
- `contents`
- `patch`
- `file_name`
- `file_path`
- `repository_url`
- `note`
- `comment`
- `raw_user_id`
- `raw_device_id`

## 🧪 Example event

```json
{
  "event_name": "render_completed",
  "event_version": 1,
  "occurred_at": "2026-05-22T10:15:30Z",
  "received_at": "2026-05-22T10:15:31Z",
  "environment": "preview",
  "release_sha": "abc1234",
  "anonymous_subject_id": "rotating_hash_30d",
  "session_id": "session_15m_random",
  "properties": {
    "duration_bucket": "under_500ms",
    "result": "success",
    "platform": "web",
    "diff_style": "split",
    "size_bucket": "small",
    "files": 1,
    "additions": 24,
    "deletions": 11
  }
}
```

## 🛡️ Validation rules

- Reject events with blocked fields at any depth.
- Reject unknown top-level fields.
- Reject properties not on the allow-list until reviewed.
- Reject raw exception messages.
- Reject telemetry when `TELEMETRY_ENABLED` is not `true`.
- Drop `anonymous_subject_id` when no consent or legitimate internal testing basis exists.

## 🔁 Schema change process

1. Add or update the documented event and property.
2. Explain the purpose, retention period, and privacy risk.
3. Review whether aggregate metrics can answer the same question.
4. Update implementation and tests in the app workspace.
5. Keep old event versions readable until their retention window expires.
