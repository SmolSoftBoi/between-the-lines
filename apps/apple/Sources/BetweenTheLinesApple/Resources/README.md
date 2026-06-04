Generated native renderer assets are written to `native-renderer/` by
`npm run build:native-renderer` before SwiftPM/Xcode archives.

The generated directory is ignored by Git, but declared as a SwiftPM resource so
standard Apple builds can bundle it after the web renderer build step.
