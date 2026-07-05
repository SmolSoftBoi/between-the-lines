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
            let changedLines = countChangedLines(oldLines: oldLines, newLines: newLines)

            return DiffStats(
                additions: changedLines.additions,
                deletions: changedLines.deletions,
                files: 1,
                sizeBucket: TextSizeBucket.characterCount(oldFile.contents.count + newFile.contents.count)
            )
        case .patch(let patch):
            let lines = patch.split(separator: "\n", omittingEmptySubsequences: false)
            var additions = 0
            var deletions = 0
            var hunkLineCounts: HunkLineCounts?

            var index = 0

            while index < lines.count {
                let line = lines[index]

                if hunkLineCounts == nil, line.hasPrefix("diff --git ") {
                    index += 1
                    continue
                }

                if hunkLineCounts == nil, isPatchFileHeaderPair(lines, at: index) {
                    index += 2
                    continue
                }

                if let parsedHunkLineCounts = parseHunkLineCounts(line) {
                    hunkLineCounts = parsedHunkLineCounts
                    index += 1
                    continue
                }

                if var counts = hunkLineCounts {
                    if line.hasPrefix("\\") {
                        index += 1
                        continue
                    }

                    if line.hasPrefix("+") {
                        additions += 1
                        counts.newLines -= 1
                    } else if line.hasPrefix("-") {
                        deletions += 1
                        counts.oldLines -= 1
                    } else {
                        counts.oldLines -= 1
                        counts.newLines -= 1
                    }

                    hunkLineCounts = counts.isComplete ? nil : counts
                    index += 1
                    continue
                }

                if line.hasPrefix("+") {
                    additions += 1
                } else if line.hasPrefix("-") {
                    deletions += 1
                }

                index += 1
            }
            let gitFileCount = lines.filter { $0.hasPrefix("diff --git ") }.count
            let headerPairFileCount = countPatchFileHeaderPairs(lines)
            let files = gitFileCount > 0 ? gitFileCount : max(1, headerPairFileCount)

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

private func countChangedLines(oldLines: [Substring], newLines: [Substring]) -> (additions: Int, deletions: Int) {
    let unchangedEdges = countUnchangedEdgeLines(oldLines: oldLines, newLines: newLines)
    let oldChangedCount = oldLines.count - unchangedEdges.prefix - unchangedEdges.suffix
    let newChangedCount = newLines.count - unchangedEdges.prefix - unchangedEdges.suffix

    if oldChangedCount == 0 || newChangedCount == 0 {
        return (
            additions: newChangedCount,
            deletions: oldChangedCount
        )
    }

    if oldChangedCount <= maxExactLineComparisons / newChangedCount {
        let oldEndIndex = oldLines.count - unchangedEdges.suffix
        let newEndIndex = newLines.count - unchangedEdges.suffix
        let commonLineCount = countCommonLines(
            oldLines: Array(oldLines[unchangedEdges.prefix..<oldEndIndex]),
            newLines: Array(newLines[unchangedEdges.prefix..<newEndIndex])
        )

        return (
            additions: newChangedCount - commonLineCount,
            deletions: oldChangedCount - commonLineCount
        )
    }

    return (
        additions: newChangedCount,
        deletions: oldChangedCount
    )
}

private let maxExactLineComparisons = 250_000

private func countUnchangedEdgeLines(oldLines: [Substring], newLines: [Substring]) -> (prefix: Int, suffix: Int) {
    let shortestLineCount = min(oldLines.count, newLines.count)
    var prefix = 0

    while prefix < shortestLineCount, oldLines[prefix] == newLines[prefix] {
        prefix += 1
    }

    var suffix = 0
    let oldSuffixLimit = oldLines.count - prefix
    let newSuffixLimit = newLines.count - prefix

    while suffix < oldSuffixLimit,
          suffix < newSuffixLimit,
          oldLines[oldLines.count - suffix - 1] == newLines[newLines.count - suffix - 1] {
        suffix += 1
    }

    return (prefix: prefix, suffix: suffix)
}

private func countCommonLines(oldLines: [Substring], newLines: [Substring]) -> Int {
    guard !oldLines.isEmpty, !newLines.isEmpty else {
        return 0
    }

    var previousRow = Array(repeating: 0, count: newLines.count + 1)

    for oldLine in oldLines {
        var currentRow = Array(repeating: 0, count: newLines.count + 1)

        for index in 1...newLines.count {
            if oldLine == newLines[index - 1] {
                currentRow[index] = previousRow[index - 1] + 1
            } else {
                currentRow[index] = max(previousRow[index], currentRow[index - 1])
            }
        }

        previousRow = currentRow
    }

    return previousRow[newLines.count]
}

private struct HunkLineCounts {
    var oldLines: Int
    var newLines: Int

    var isComplete: Bool {
        oldLines <= 0 && newLines <= 0
    }
}

private func parseHunkLineCounts(_ line: Substring) -> HunkLineCounts? {
    let fields = line.split(separator: " ")
    guard fields.count >= 4, fields[0] == "@@", fields[3].hasPrefix("@@") else {
        return nil
    }

    guard
        let oldLines = parseHunkLineCount(fields[1], prefix: "-"),
        let newLines = parseHunkLineCount(fields[2], prefix: "+")
    else {
        return nil
    }

    return HunkLineCounts(oldLines: oldLines, newLines: newLines)
}

private func parseHunkLineCount(_ field: Substring, prefix: Character) -> Int? {
    guard field.first == prefix else {
        return nil
    }

    let lineRange = field.dropFirst()
    guard let commaIndex = lineRange.firstIndex(of: ",") else {
        return 1
    }

    let countStartIndex = lineRange.index(after: commaIndex)
    return Int(lineRange[countStartIndex...])
}

private func countPatchFileHeaderPairs(_ lines: [Substring]) -> Int {
    var files = 0
    var index = 0
    var hunkLineCounts: HunkLineCounts?

    while index < lines.count {
        let line = lines[index]

        if hunkLineCounts == nil, isPatchFileHeaderPair(lines, at: index) {
            files += 1
            index += 2
            continue
        }

        if let parsedHunkLineCounts = parseHunkLineCounts(line) {
            hunkLineCounts = parsedHunkLineCounts
            index += 1
            continue
        }

        if var counts = hunkLineCounts {
            if line.hasPrefix("\\") {
                index += 1
                continue
            }

            if line.hasPrefix("+") {
                counts.newLines -= 1
            } else if line.hasPrefix("-") {
                counts.oldLines -= 1
            } else {
                counts.oldLines -= 1
                counts.newLines -= 1
            }

            hunkLineCounts = counts.isComplete ? nil : counts
        }

        index += 1
    }

    return files
}

private func isPatchFileHeaderPair(_ lines: [Substring], at index: Int) -> Bool {
    guard index + 1 < lines.count else {
        return false
    }

    guard isOldPatchFileHeader(lines[index]), isNewPatchFileHeader(lines[index + 1]) else {
        return false
    }

    guard index + 2 < lines.count else {
        return true
    }

    return lines[index + 2].hasPrefix("@@ ")
}

private func isOldPatchFileHeader(_ line: Substring) -> Bool {
    let text = String(line)
    return text == "---" ||
        text.hasPrefix("--- ") ||
        text.hasPrefix("---\t")
}

private func isNewPatchFileHeader(_ line: Substring) -> Bool {
    let text = String(line)
    return text == "+++" ||
        text.hasPrefix("+++ ") ||
        text.hasPrefix("+++\t")
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
        self.cacheKey = cacheKey ?? "\(name)-\(contents.count)-\(stableContentDigest(contents))"
    }
}

private func stableContentDigest(_ contents: String) -> String {
    var hash: UInt64 = 0xcbf29ce484222325

    for byte in contents.utf8 {
        hash ^= UInt64(byte)
        hash = hash &* 0x100000001b3
    }

    return String(hash, radix: 16)
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

extension DiffDocument {
    var patchExportText: String {
        switch source {
        case .patch(let patch):
            patch
        case .filePair(let oldFile, let newFile):
            createFullFilePairPatch(oldFile: oldFile, newFile: newFile)
        }
    }

    var patchExportFilename: String {
        "\(slugifyFilename(title)).patch"
    }
}

private func createFullFilePairPatch(oldFile: DiffFileVersion, newFile: DiffFileVersion) -> String {
    let oldLineSet = patchLineSet(oldFile.contents)
    let newLineSet = patchLineSet(newFile.contents)

    return (
        [
            "--- a/\(sanitizePatchFileName(oldFile.name))",
            "+++ b/\(sanitizePatchFileName(newFile.name))",
            "@@ -\(hunkStart(oldLineSet.lines.count)),\(oldLineSet.lines.count) +\(hunkStart(newLineSet.lines.count)),\(newLineSet.lines.count) @@",
        ] +
        prefixedPatchLines("-", lineSet: oldLineSet) +
        prefixedPatchLines("+", lineSet: newLineSet)
    ).joined(separator: "\n")
}

private struct PatchLineSet {
    let lines: [Substring]
    let needsNoNewlineMarker: Bool
}

private func patchLineSet(_ contents: String) -> PatchLineSet {
    guard !contents.isEmpty else {
        return PatchLineSet(lines: [], needsNoNewlineMarker: false)
    }

    let lines = contents.split(separator: "\n", omittingEmptySubsequences: false)
    if lines.last == "" {
        return PatchLineSet(lines: Array(lines.dropLast()), needsNoNewlineMarker: false)
    }

    return PatchLineSet(lines: lines, needsNoNewlineMarker: true)
}

private func prefixedPatchLines(_ prefix: String, lineSet: PatchLineSet) -> [String] {
    lineSet.lines.enumerated().flatMap { index, line -> [String] in
        let prefixedLine = "\(prefix)\(line)"

        if lineSet.needsNoNewlineMarker, index == lineSet.lines.count - 1 {
            return [prefixedLine, "\\ No newline at end of file"]
        }

        return [prefixedLine]
    }
}

private func hunkStart(_ lineCount: Int) -> Int {
    lineCount == 0 ? 0 : 1
}

private func sanitizePatchFileName(_ name: String) -> String {
    name
        .replacingOccurrences(of: "\r", with: "_")
        .replacingOccurrences(of: "\n", with: "_")
}

private func slugifyFilename(_ title: String) -> String {
    let slug = title
        .lowercased()
        .map { character -> Character in
            character.isLetter || character.isNumber ? character : "-"
        }
        .reduce(into: "") { result, character in
            if character == "-", result.last == "-" {
                return
            }

            result.append(character)
        }
        .trimmingCharacters(in: CharacterSet(charactersIn: "-"))

    return slug.isEmpty ? "between-the-lines-diff" : slug
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
