#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/apps/apple"
APP_NAME="BetweenTheLinesPreview"
APP_BUNDLE="$ROOT_DIR/dist/$APP_NAME.app"
EXECUTABLE="$PACKAGE_DIR/.build/debug/$APP_NAME"
WEB_RENDERER_DIR="$ROOT_DIR/apps/apple/Sources/BetweenTheLinesApple/Resources/native-renderer"

cd "$ROOT_DIR"
npm --workspace apps/web run build:native-renderer
cd "$PACKAGE_DIR"

swift build --product "$APP_NAME"

mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/native-renderer"
cp "$EXECUTABLE" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
cp -R "$WEB_RENDERER_DIR/." "$APP_BUNDLE/Contents/Resources/native-renderer/"
cat > "$APP_BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>computer.pierre.between-the-lines.preview</string>
  <key>CFBundleName</key>
  <string>Between the Lines Preview</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

should_run=false
should_verify=false
should_logs=false
should_telemetry=false

for arg in "$@"; do
  case "$arg" in
    --run)
      should_run=true
      ;;
    --verify)
      should_run=true
      should_verify=true
      ;;
    --logs)
      should_run=true
      should_logs=true
      ;;
    --telemetry)
      should_run=true
      should_telemetry=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ "$should_run" == true ]]; then
  pkill -x "$APP_NAME" 2>/dev/null || true
  /usr/bin/open -n "$APP_BUNDLE"
fi

if [[ "$should_verify" == true ]]; then
  sleep 2
  pgrep -x "$APP_NAME" >/dev/null
fi

if [[ "$should_logs" == true ]]; then
  /usr/bin/log stream --style compact --predicate "process == \"$APP_NAME\""
fi

if [[ "$should_telemetry" == true ]]; then
  sleep 2
  /usr/bin/log show --style compact --last 2m --predicate "subsystem == \"computer.pierre.between-the-lines.preview\" || process == \"$APP_NAME\"" | tail -n 80 || true
fi
