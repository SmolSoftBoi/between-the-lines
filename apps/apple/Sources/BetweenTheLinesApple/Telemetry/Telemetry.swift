import Foundation
import OSLog

public struct TelemetryEvent: Equatable, Sendable {
    public let name: TelemetryEventName
    public let properties: [String: String]
    public let date: Date

    public init(name: TelemetryEventName, properties: [String: String] = [:], date: Date = Date()) {
        self.name = name
        self.properties = TelemetryEvent.sanitizedProperties(properties)
        self.date = date
    }

    static func sanitizedProperties(_ properties: [String: String]) -> [String: String] {
        var sanitizedProperties: [String: String] = [:]

        for (key, value) in properties {
            guard isAllowedMetadataValue(key: key, value: value) else {
                continue
            }

            sanitizedProperties[key] = value
        }

        return sanitizedProperties
    }

    private static func isAllowedMetadataValue(key: String, value: String) -> Bool {
        switch key {
        case "additions", "deletions", "files", "duration_ms":
            return isIntegerString(value)
        case "size_bucket":
            return allowedSizeBuckets.contains(value)
        case "source":
            return value == "web_renderer"
        case "reason":
            return allowedReasons.contains(value)
        case "setting":
            return allowedSettings.contains(value)
        default:
            return false
        }
    }

    private static func isIntegerString(_ value: String) -> Bool {
        guard !value.isEmpty else {
            return false
        }

        return value.unicodeScalars.allSatisfy { scalar in
            scalar.value >= 48 && scalar.value <= 57
        }
    }

    private static let allowedSizeBuckets: Set<String> = [
        "empty",
        "small",
        "medium",
        "large",
        "huge",
    ]

    private static let allowedReasons: Set<String> = [
        "encode_failed",
        "web_renderer_failed",
        "post_message_failed",
        "invalid_bridge_message",
        "unknown_bridge_message",
    ]

    private static let allowedSettings: Set<String> = [
        "collapsed_context_threshold",
        "diff_style",
        "line_diff_type",
        "line_numbers",
        "overflow",
        "telemetry_opt_in",
        "theme",
        "theme_type",
    ]
}

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
