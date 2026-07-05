# Between the Lines Apple

SwiftUI iOS/macOS shell scaffolding for the private diff workbench.

The package contains:

- `BetweenTheLinesApple`: shared models, telemetry, SwiftUI shell, and `WKWebView` renderer host.
- `BetweenTheLinesPreview`: macOS preview executable for local development.

Run tests:

```bash
swift test --package-path apps/apple
```

Build the preview bundle:

```bash
./script/build_and_run.sh
```

Launch it:

```bash
./script/build_and_run.sh --run
```

The native shell keeps telemetry local by default through `NoOpTelemetryClient` or `OSLogTelemetryClient`. Event properties must remain metadata-only and must not include raw diff contents, file names, paths, patches, or annotation text.
