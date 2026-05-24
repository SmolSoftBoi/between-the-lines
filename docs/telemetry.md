# 🔒 Privacy-First Telemetry

## 🎯 Goal

Collect the minimum operational and product signals needed to improve `between-the-lines`, while protecting people from unnecessary tracking.

## 🧭 Principles

- Telemetry is disabled by default.
- Product telemetry requires clear disclosure and user consent.
- Events must not include directly identifying data.
- Use coarse, aggregate measurements before session-level detail.
- Keep retention short and document why data exists.
- Prefer deletion over long-term warehousing.

## 📊 What to collect

Start with operational health and anonymous product signals:

| Category | Example events | Purpose |
| --- | --- | --- |
| Health | `app_opened`, `render_failed` | Detect release quality issues. |
| Rendering | `diff_loaded`, `render_started`, `render_completed` | Understand performance by coarse size bucket. |
| Workflow | `settings_changed`, `annotation_added`, `export_requested` | Learn which local tools are useful. |

## 🚫 What not to collect

Do not collect:

- Names, email addresses, phone numbers, precise addresses, or account identifiers
- Free-text content unless a separate consent and redaction flow exists
- Precise location
- Full IP addresses
- Payment details or authentication secrets
- Raw device identifiers
- Raw diff contents, patches, file names, file paths, repository URLs, comments, or annotation notes

## ⚙️ Configuration

Use `.env.example` as the source for required environment variables:

- `TELEMETRY_ENABLED=false` keeps collection off until the product is ready.
- `VITE_TELEMETRY_ENABLED=false` keeps the web client disabled by default.
- `TELEMETRY_SAMPLE_RATE=0` prevents accidental sampling in greenfield builds.
- `TELEMETRY_RETENTION_DAYS=30` sets the expected upper bound for early telemetry.
- `TELEMETRY_HASH_SALT` must be supplied as a secret only when hashed identifiers are needed.
- `TELEMETRY_ALLOW_DEBUG_LOGS=false` prevents verbose telemetry logs outside local debugging.

## ✅ Consent and disclosure

Before enabling telemetry outside internal testing:

1. Explain what categories of events are collected.
2. Explain why the data is collected.
3. Provide an opt-out or consent control where required.
4. Keep telemetry disabled until the consent state is known.
5. Confirm the implementation follows `docs/telemetry/schema.md`.

## 🗄️ Access and retention

- Limit telemetry access to maintainers who need it for product quality or operations.
- Delete or aggregate raw event data after the configured retention period.
- Review event names and properties before release.
- Treat telemetry exports as sensitive, even when they should not contain personal data.

## 📈 Metrics

Track the telemetry system itself:

| Metric | Target |
| --- | --- |
| Events rejected for schema violations | Trending down |
| Events containing blocked fields | Zero |
| Median ingestion delay | Under 5 minutes |
| Retention deletion success | 100% |

## 🏁 Definition of done

- Telemetry remains opt-in or consent-gated.
- Events match the documented schema.
- No personally identifying fields are accepted.
- Retention and access rules have an owner.
