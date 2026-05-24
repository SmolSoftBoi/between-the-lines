import SwiftUI
import WebKit

public struct DiffWebView: View {
    private let document: DiffDocument
    private let telemetry: TelemetryClient
    private let renderer: DiffHTMLRenderer

    public init(
        document: DiffDocument,
        telemetry: TelemetryClient = NoOpTelemetryClient(),
        renderer: DiffHTMLRenderer = DiffHTMLRenderer()
    ) {
        self.document = document
        self.telemetry = telemetry
        self.renderer = renderer
    }

    public var body: some View {
        PlatformWebView(document: document, telemetry: telemetry, fallbackHTML: renderer.render(document))
    }
}

#if os(iOS)
private struct PlatformWebView: UIViewRepresentable {
    let document: DiffDocument
    let telemetry: TelemetryClient
    let fallbackHTML: String

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator(telemetry: telemetry)
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = makeWebView(coordinator: context.coordinator)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.render(document, in: webView, fallbackHTML: fallbackHTML)
    }
}
#elseif os(macOS)
private struct PlatformWebView: NSViewRepresentable {
    let document: DiffDocument
    let telemetry: TelemetryClient
    let fallbackHTML: String

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator(telemetry: telemetry)
    }

    func makeNSView(context: Context) -> WKWebView {
        let webView = makeWebView(coordinator: context.coordinator)
        webView.setValue(false, forKey: "drawsBackground")
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.render(document, in: webView, fallbackHTML: fallbackHTML)
    }
}
#endif

private func makeWebView(coordinator: WebViewCoordinator) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.userContentController.add(coordinator, name: "betweenTheLines")

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = coordinator

    return webView
}

private final class WebViewCoordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    private let telemetry: TelemetryClient
    private let encoder: JSONEncoder
    private var currentRendererURL: URL?
    private var hasLoadedBundledRenderer = false
    private var pendingDocumentJSON: String?

    init(telemetry: TelemetryClient) {
        self.telemetry = telemetry
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
    }

    func render(_ document: DiffDocument, in webView: WKWebView, fallbackHTML: String) {
        telemetry.track(TelemetryEvent(name: .renderStarted, properties: document.stats.telemetryProperties))

        guard let documentJSON = encode(document) else {
            telemetry.track(TelemetryEvent(name: .renderFailed, properties: ["reason": "encode_failed"]))
            webView.loadHTMLString(fallbackHTML, baseURL: nil)
            return
        }

        guard let rendererURL = bundledRendererURL() else {
            webView.loadHTMLString(fallbackHTML, baseURL: nil)
            telemetry.track(TelemetryEvent(name: .renderCompleted, properties: document.stats.telemetryProperties))
            return
        }

        pendingDocumentJSON = documentJSON

        if currentRendererURL != rendererURL {
            currentRendererURL = rendererURL
            hasLoadedBundledRenderer = false
            webView.loadFileURL(rendererURL, allowingReadAccessTo: rendererURL.deletingLastPathComponent())
            return
        }

        if hasLoadedBundledRenderer {
            postPendingDocument(to: webView)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasLoadedBundledRenderer = true
        postPendingDocument(to: webView)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "betweenTheLines" else {
            return
        }

        let bridgeEvent = classifyDiffBridgeMessageBody(message.body)
        telemetry.track(TelemetryEvent(name: bridgeEvent.name, properties: bridgeEvent.properties))
    }

    private func encode(_ document: DiffDocument) -> String? {
        guard let data = try? encoder.encode(document) else {
            return nil
        }

        return String(decoding: data, as: UTF8.self)
    }

    private func postPendingDocument(to webView: WKWebView) {
        guard let pendingDocumentJSON else {
            return
        }

        let script = "window.postMessage({\"type\":\"renderDiff\",\"document\":\(pendingDocumentJSON)}, \"*\");"
        webView.evaluateJavaScript(script) { [telemetry] _, error in
            if error != nil {
                telemetry.track(TelemetryEvent(name: .renderFailed, properties: ["reason": "post_message_failed"]))
            }
        }

        self.pendingDocumentJSON = nil
    }

    private func bundledRendererURL() -> URL? {
        if
            let explicitPath = ProcessInfo.processInfo.environment["BETWEEN_THE_LINES_RENDERER_PATH"],
            FileManager.default.fileExists(atPath: explicitPath)
        {
            return URL(fileURLWithPath: explicitPath)
        }

        guard let resourceURL = Bundle.main.resourceURL else {
            return nil
        }

        let rendererDirectoryURL = resourceURL
            .appendingPathComponent("native-renderer", isDirectory: true)

        for fileName in ["index.html", "native.html"] {
            let rendererURL = rendererDirectoryURL.appendingPathComponent(fileName)

            if FileManager.default.fileExists(atPath: rendererURL.path) {
                return rendererURL
            }
        }

        return nil
    }

}

struct DiffBridgeTelemetryEvent: Equatable {
    let name: TelemetryEventName
    let properties: [String: String]

    init(name: TelemetryEventName, properties: [String: String]) {
        self.name = name
        self.properties = TelemetryEvent.sanitizedProperties(properties)
    }
}

func classifyDiffBridgeMessageBody(_ messageBody: Any) -> DiffBridgeTelemetryEvent {
    guard
        let body = messageBody as? [String: Any],
        let type = body["type"] as? String
    else {
        return DiffBridgeTelemetryEvent(
            name: .renderFailed,
            properties: ["reason": "invalid_bridge_message"]
        )
    }

    switch type {
    case "renderStarted":
        return DiffBridgeTelemetryEvent(
            name: .renderStarted,
            properties: ["source": "web_renderer"]
        )
    case "renderCompleted":
        return DiffBridgeTelemetryEvent(
            name: .renderCompleted,
            properties: telemetryProperties(from: body)
        )
    case "renderFailed":
        return DiffBridgeTelemetryEvent(
            name: .renderFailed,
            properties: ["reason": "web_renderer_failed"]
        )
    case "updateSettings":
        return DiffBridgeTelemetryEvent(
            name: .settingsChanged,
            properties: settingsProperties(from: body)
        )
    case "exportRequested":
        return DiffBridgeTelemetryEvent(
            name: .exportRequested,
            properties: ["source": "web_renderer"]
        )
    default:
        return DiffBridgeTelemetryEvent(
            name: .renderFailed,
            properties: ["reason": "unknown_bridge_message"]
        )
    }
}

private func telemetryProperties(from body: [String: Any]) -> [String: String] {
    var properties: [String: String] = ["source": "web_renderer"]

    properties["duration_ms"] = integerString(from: body["durationMs"])

    guard let stats = body["stats"] as? [String: Any] else {
        return properties
    }

    properties["additions"] = integerString(from: stats["additions"])
    properties["deletions"] = integerString(from: stats["deletions"])
    properties["files"] = integerString(from: stats["files"])
    properties["size_bucket"] = stats["sizeBucket"] as? String

    return properties.compactMapValues { $0 }
}

private func settingsProperties(from body: [String: Any]) -> [String: String] {
    var properties: [String: String] = ["source": "web_renderer"]
    properties["setting"] = body["setting"] as? String
    return properties
}

private func integerString(from value: Any?) -> String? {
    switch value {
    case let value as Int where value >= 0:
        return String(value)
    case let value as Double where value.isFinite && value >= 0:
        let roundedValue = value.rounded()
        guard roundedValue <= Double(Int.max) else {
            return nil
        }

        return String(Int(roundedValue))
    case let value as String:
        return value
    default:
        return nil
    }
}
