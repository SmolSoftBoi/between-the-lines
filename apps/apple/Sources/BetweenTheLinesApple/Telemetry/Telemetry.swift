import Foundation
import OSLog

public struct TelemetryEvent: Equatable, Sendable {
    public let name: TelemetryEventName
    public let properties: [String: String]
    public let date: Date

    public init(name: TelemetryEventName, properties: [String: String] = [:], date: Date = Date()) {
        self.name = name
        self.properties = TelemetryEvent.sanitized(properties)
        self.date = date
    }

    private static func sanitized(_ properties: [String: String]) -> [String: String] {
        properties.filter { key, _ in
            !blockedPropertyKeys.contains(key.lowercased())
        }
    }
}

private let blockedPropertyKeys: Set<String> = [
    "content",
    "contents",
    "patch",
    "path",
    "file",
    "file_name",
    "filename",
    "file_path",
    "repo",
    "repository",
    "repository_url",
    "note",
    "comment",
    "token",
    "secret",
    "title",
]

public enum TelemetryEventName: String, Sendable {
    case appOpened = "app_opened"
    case diffLoaded = "diff_loaded"
    case renderStarted = "render_started"
    case renderCompleted = "render_completed"
    case renderFailed = "render_failed"
    case settingsChanged = "settings_changed"
    case annotationAdded = "annotation_added"
    case exportRequested = "export_requested"
}

public protocol TelemetryClient: Sendable {
    func track(_ event: TelemetryEvent)
}

public struct NoOpTelemetryClient: TelemetryClient {
    public init() {}

    public func track(_ event: TelemetryEvent) {}
}

public struct OSLogTelemetryClient: TelemetryClient {
    private let logger: Logger

    public init(
        subsystem: String = Bundle.main.bundleIdentifier ?? "computer.pierre.between-the-lines",
        category: String = "DiffWorkbench"
    ) {
        logger = Logger(subsystem: subsystem, category: category)
    }

    public func track(_ event: TelemetryEvent) {
        logger.notice("event=\(event.name.rawValue, privacy: .public) timestamp=\(event.date.timeIntervalSince1970, privacy: .public) properties=\(event.properties.description, privacy: .public)")
    }
}

public final class InMemoryTelemetryClient: TelemetryClient, @unchecked Sendable {
    private let lock = NSLock()
    private var storedEvents: [TelemetryEvent] = []

    public init() {}

    public var events: [TelemetryEvent] {
        lock.withLock {
            storedEvents
        }
    }

    public func track(_ event: TelemetryEvent) {
        lock.withLock {
            storedEvents.append(event)
        }
    }
}

public extension DiffStats {
    var telemetryProperties: [String: String] {
        [
            "additions": "\(additions)",
            "deletions": "\(deletions)",
            "files": "\(files)",
            "size_bucket": sizeBucket.rawValue,
        ]
    }
}
