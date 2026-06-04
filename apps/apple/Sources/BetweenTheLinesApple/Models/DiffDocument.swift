import Foundation

public struct DiffDocument: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var title: String
    public var source: DiffSource
    public var settings: ViewerSettings
    public var annotations: [ReviewAnnotation]
    public let createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
        title: String,
        source: DiffSource,
        settings: ViewerSettings = ViewerSettings(),
        annotations: [ReviewAnnotation] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.source = source
        self.settings = settings
        self.annotations = annotations
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var stats: DiffStats {
        switch source {
        case .filePair(let oldFile, let newFile):
            let oldLines = splitComparableLines(oldFile.contents)
            let newLines = splitComparableLines(newFile.contents)
            let maxCount = max(oldLines.count, newLines.count)
            var additions = 0
            var deletions = 0

            for index in 0..<maxCount {
                let oldLine = index < oldLines.count ? oldLines[index] : nil
                let newLine = index < newLines.count ? newLines[index] : nil

                if oldLine == newLine {
                    continue
                }

                if oldLine != nil {
                    deletions += 1
                }

                if newLine != nil {
                    additions += 1
                }
            }

            return DiffStats(
                additions: additions,
                deletions: deletions,
                files: 1,
                sizeBucket: TextSizeBucket.characterCount(oldFile.contents.count + newFile.contents.count)
            )
        case .patch(let patch):
            let lines = patch.split(separator: "\n", omittingEmptySubsequences: false)
            let additions = lines.filter { $0.hasPrefix("+") && !$0.hasPrefix("+++") }.count
            let deletions = lines.filter { $0.hasPrefix("-") && !$0.hasPrefix("---") }.count
            let files = max(1, lines.filter { $0.hasPrefix("diff --git ") }.count)

            return DiffStats(
                additions: additions,
                deletions: deletions,
                files: patch.isEmpty ? 0 : files,
                sizeBucket: TextSizeBucket.characterCount(patch.count)
            )
        }
    }

    public static let sample = DiffDocument(
        title: "Invoice formatter review",
        source: .filePair(
            oldFile: DiffFileVersion(
                name: "src/billing/invoice.ts",
                contents: """
                export function formatInvoiceTotal(items) {
                  const total = items.reduce((sum, item) => sum + item.price, 0);
                  return "$" + total.toFixed(2);
                }
                """
            ),
            newFile: DiffFileVersion(
                name: "src/billing/invoice.ts",
                contents: """
                export function formatInvoiceTotal(items, currency = "USD") {
                  const total = items.reduce((sum, item) => {
                    return sum + item.price * item.quantity;
                  }, 0);

                  return new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency
                  }).format(total);
                }
                """
            )
        ),
        annotations: [
            ReviewAnnotation(
                side: .additions,
                lineNumber: 7,
                note: "Check locale handling before sharing this formatter."
            ),
        ]
    )
}

public enum DiffSource: Codable, Equatable, Sendable {
    case filePair(oldFile: DiffFileVersion, newFile: DiffFileVersion)
    case patch(String)

    private enum CodingKeys: String, CodingKey {
        case kind
        case oldFile
        case newFile
        case patch
    }

    private enum Kind: String, Codable {
        case filePair = "file-pair"
        case patch
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(Kind.self, forKey: .kind)

        switch kind {
        case .filePair:
            self = .filePair(
                oldFile: try container.decode(DiffFileVersion.self, forKey: .oldFile),
                newFile: try container.decode(DiffFileVersion.self, forKey: .newFile)
            )
        case .patch:
            self = .patch(try container.decode(String.self, forKey: .patch))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .filePair(let oldFile, let newFile):
            try container.encode(Kind.filePair, forKey: .kind)
            try container.encode(oldFile, forKey: .oldFile)
            try container.encode(newFile, forKey: .newFile)
        case .patch(let patch):
            try container.encode(Kind.patch, forKey: .kind)
            try container.encode(patch, forKey: .patch)
        }
    }
}

private func splitComparableLines(_ contents: String) -> [Substring] {
    contents.isEmpty ? [] : contents.split(separator: "\n", omittingEmptySubsequences: false)
}

public struct DiffFileVersion: Codable, Equatable, Sendable {
    public var name: String
    public var contents: String
    public var lang: String?
    public var cacheKey: String

    public init(name: String, contents: String, lang: String? = nil, cacheKey: String? = nil) {
        self.name = name
        self.contents = contents
        self.lang = lang
        self.cacheKey = cacheKey ?? "\(name)-\(contents.count)"
    }
}

public struct ViewerSettings: Codable, Equatable, Sendable {
    public var diffStyle: DiffStyle
    public var overflow: DiffOverflow
    public var themeType: ThemeType
    public var lineDiffType: LineDiffType
    public var lineNumbers: Bool
    public var collapsedContextThreshold: Int
    public var telemetryOptIn: Bool

    public init(
        diffStyle: DiffStyle = .split,
        overflow: DiffOverflow = .scroll,
        themeType: ThemeType = .light,
        lineDiffType: LineDiffType = .word,
        lineNumbers: Bool = true,
        collapsedContextThreshold: Int = 12,
        telemetryOptIn: Bool = false
    ) {
        self.diffStyle = diffStyle
        self.overflow = overflow
        self.themeType = themeType
        self.lineDiffType = lineDiffType
        self.lineNumbers = lineNumbers
        self.collapsedContextThreshold = collapsedContextThreshold
        self.telemetryOptIn = telemetryOptIn
    }
}

public enum DiffStyle: String, Codable, Sendable {
    case split
    case unified
}

public enum DiffOverflow: String, Codable, Sendable {
    case scroll
    case wrap
}

public enum ThemeType: String, Codable, Sendable {
    case system
    case light
    case dark
}

public enum LineDiffType: String, Codable, Sendable {
    case word
    case wordAlt = "word-alt"
    case character = "char"
    case none
}

public struct ReviewAnnotation: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var side: AnnotationSide
    public var lineNumber: Int
    public var note: String
    public var status: AnnotationStatus
    public let createdAt: Date

    public init(
        id: UUID = UUID(),
        side: AnnotationSide,
        lineNumber: Int,
        note: String,
        status: AnnotationStatus = .open,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.side = side
        self.lineNumber = lineNumber
        self.note = note
        self.status = status
        self.createdAt = createdAt
    }
}

public enum AnnotationSide: String, Codable, Sendable {
    case deletions
    case additions
}

public enum AnnotationStatus: String, Codable, Sendable {
    case open
    case resolved
}

public struct DiffStats: Codable, Equatable, Sendable {
    public let additions: Int
    public let deletions: Int
    public let files: Int
    public let sizeBucket: TextSizeBucket
}

public enum TextSizeBucket: String, Codable, Sendable {
    case empty
    case small
    case medium
    case large
    case huge

    static func characterCount(_ count: Int) -> TextSizeBucket {
        switch count {
        case 0:
            .empty
        case 1..<5_000:
            .small
        case 5_000..<50_000:
            .medium
        case 50_000..<250_000:
            .large
        default:
            .huge
        }
    }
}
