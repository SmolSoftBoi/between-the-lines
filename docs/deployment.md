# 🚀 Deployment Scaffolding

## 🎯 Goal

Prepare `between-the-lines` for repeatable web, iOS, and macOS deployments while keeping credentials and telemetry controls out of source control.

## 👥 Owner and stakeholders

- Owner: engineering
- Stakeholders: product, privacy, support, and anyone operating production releases

## 📥 Inputs

- A tested build artifact from the app workspace
- Environment variables based on `.env.example`
- A release identifier such as `RELEASE_SHA`
- Hosting provider credentials supplied through the deployment platform, not committed files

## 📤 Outputs

- A deployed web or app build
- A release record containing version, commit, environment, and deployment target
- Rollback instructions linked from the release record

## 🌍 Environments

| Environment | Purpose | Telemetry default | Notes |
| --- | --- | --- | --- |
| `development` | Local development | Disabled | Debug logs may use local-only output. |
| `preview` | Pull request and stakeholder review | Disabled | Enable only for explicit smoke tests. |
| `production` | Customer-facing release | Consent-gated | Use the shortest practical retention period. |

## 🌐 Web

- Target: Vercel static deployment from `apps/web`.
- Build command: `npm run build`.
- Output directory: `apps/web/dist`.
- Config: `apps/web/vercel.json` pins the Vite framework, build command, and output directory.
- Preview deploys should keep `VITE_TELEMETRY_ENABLED=false` unless a specific smoke test needs metadata-only events.

## 📱 iOS

- Target: App Store Connect/TestFlight once bundle ID, Apple team, and signing assets exist.
- Build the hosted renderer with `npm run build:native-renderer` before archiving so the `WKWebView` pane uses the shared `@pierre/diffs` implementation.
- Preferred automation: Xcode Cloud or a macOS CI runner with App Store Connect API credentials stored as secrets.
- Do not commit provisioning profiles, certificates, API keys, or export options containing secrets.

## 🖥️ macOS

- First target: Developer ID signed, notarised, stapled `.dmg` uploaded to GitHub Releases.
- Local preview: `./script/build_and_run.sh --verify --telemetry` stages an app bundle with the native renderer and captures a bounded OSLog sample.
- Validation: archive/export, notarisation result, stapling, and `spctl` assessment.
- Mac App Store distribution can be added later if the release channel requires it.

## ✅ Release checklist

1. Confirm CI passes for docs, configuration, linting, typechecking, tests, web build, and Swift package tests.
2. Confirm `.env.example` has matching deployment variables for the target platform.
3. Confirm telemetry remains disabled unless consent, disclosure, retention, and access controls are ready.
4. Record `RELEASE_SHA`, `APP_ENV`, and `DEPLOYMENT_TARGET`.
5. Deploy from a protected branch or an approved release workflow.
6. Smoke-test the deployed URL.
7. Record rollback instructions and the previous stable release.

## ↩️ Rollback

Rollback must be fast, documented, and reversible:

- Keep the previous stable artifact or platform release available.
- Prefer platform rollback over a hurried follow-up change.
- Disable telemetry through configuration first if telemetry causes operational or privacy risk.
- Record the rollback reason, time, release identifier, and owner.

## ⚠️ Edge cases

- Missing secrets: fail the deployment before build or release steps run.
- Missing telemetry consent controls: deploy with telemetry disabled.
- Broken smoke test: keep the failed release out of production traffic.
- Partial outage after release: roll back first, then investigate from logs that do not contain personal data.

## 🏁 Definition of done

- CI can validate the deployment and telemetry scaffolding.
- `.env.example` documents required variables without secrets.
- The release checklist, rollback path, and telemetry defaults are clear enough for a first deployment.
