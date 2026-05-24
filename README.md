# Between the Lines

Private local diff workbench for web, iOS, and macOS.

## Apps

- `apps/web`: Vite + React + TypeScript workbench powered by `@pierre/diffs`.
- `apps/apple`: SwiftUI iOS/macOS shell with a `WKWebView` diff pane that hosts the bundled web renderer.

## Web

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run build:native-renderer
swift test --package-path apps/apple
bash -n script/build_and_run.sh
```

The macOS preview helper builds the native renderer, bundles it into the staged app, and can run a short verification pass:

```bash
./script/build_and_run.sh --verify --telemetry
```

## Privacy

Telemetry is disabled by default. When enabled, events contain only metadata such as platform, version, timing, option names, and coarse size buckets. Raw diff contents, file names, paths, patches, comments, repository URLs, and secrets must never be sent.
