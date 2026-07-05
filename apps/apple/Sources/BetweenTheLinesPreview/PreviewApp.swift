import BetweenTheLinesApple
import SwiftUI

@main
struct BetweenTheLinesPreviewApp: App {
    var body: some Scene {
        WindowGroup {
            BetweenTheLinesShellView(telemetry: OSLogTelemetryClient())
        }
    }
}
