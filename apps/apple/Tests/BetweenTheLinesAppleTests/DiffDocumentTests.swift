import XCTest
@testable import BetweenTheLinesApple

final class DiffDocumentTests: XCTestCase {
    func testFilePairStatsUseCoarseMetadata() {
        let document = DiffDocument.sample

        XCTAssertEqual(document.stats.files, 1)
        XCTAssertGreaterThan(document.stats.additions, 0)
        XCTAssertGreaterThan(document.stats.deletions, 0)
        XCTAssertEqual(document.stats.sizeBucket, .small)
    }

    func testPatchStatsIgnorePatchHeaders() {
        let document = DiffDocument(
            title: "Patch",
            source: .patch(
                [
                    "--- a/example.ts",
                    "+++ b/example.ts",
                    "@@ -1,2 +1,2 @@",
                    "-const oldValue = 1;",
                    "+const newValue = 2;",
                    " const shared = true;",
                ].joined(separator: "\n")
            )
        )

        XCTAssertEqual(document.stats.additions, 1)
        XCTAssertEqual(document.stats.deletions, 1)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testPatchStatsCountHunkLinesThatStartWithPatchMarkers() {
        let document = DiffDocument(
            title: "Patch",
            source: .patch(
                [
                    "--- a/example.env",
                    "+++ b/example.env",
                    "@@ -1,2 +1,2 @@",
                    "--- disabled",
                    "+++ enabled",
                    " unchanged",
                ].joined(separator: "\n")
            )
        )

        XCTAssertEqual(document.stats.additions, 1)
        XCTAssertEqual(document.stats.deletions, 1)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testPatchStatsCountAdjacentTripleMarkerLinesAtEndOfHunk() {
        let document = DiffDocument(
            title: "Patch",
            source: .patch(
                [
                    "--- a/example.env",
                    "+++ b/example.env",
                    "@@ -1 +1 @@",
                    "--- disabled",
                    "+++ enabled",
                ].joined(separator: "\n")
            )
        )

        XCTAssertEqual(document.stats.additions, 1)
        XCTAssertEqual(document.stats.deletions, 1)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testPatchStatsCountStandardMultiFileUnifiedPatches() {
        let document = DiffDocument(
            title: "Patch",
            source: .patch(
                [
                    "--- a/first.txt",
                    "+++ b/first.txt",
                    "@@ -1 +1 @@",
                    "-old first",
                    "+new first",
                    "--- a/second.txt",
                    "+++ b/second.txt",
                    "@@ -1 +1 @@",
                    "-old second",
                    "+new second",
                ].joined(separator: "\n")
            )
        )

        XCTAssertEqual(document.stats.additions, 2)
        XCTAssertEqual(document.stats.deletions, 2)
        XCTAssertEqual(document.stats.files, 2)
    }

    func testFilePairStatsTreatEmptyOldFileAsZeroLines() {
        let document = makeFilePairDocument(oldContents: "", newContents: "created")

        XCTAssertEqual(document.stats.additions, 1)
        XCTAssertEqual(document.stats.deletions, 0)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testFilePairStatsKeepInsertedLineAlignedWithUnchangedText() {
        let document = makeFilePairDocument(oldContents: "a\nb", newContents: "x\na\nb")

        XCTAssertEqual(document.stats.additions, 1)
        XCTAssertEqual(document.stats.deletions, 0)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testFilePairStatsStayBoundedWhenLargeUnchangedTextSurroundsInsertion() {
        let sharedLines = (0..<1_000).map { "line \($0)" }
        let document = makeFilePairDocument(
            oldContents: sharedLines.joined(separator: "\n"),
            newContents: (["inserted"] + sharedLines).joined(separator: "\n")
        )

        XCTAssertEqual(document.stats.additions, 1)
        XCTAssertEqual(document.stats.deletions, 0)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testFilePairStatsTreatEmptyNewFileAsZeroLines() {
        let document = makeFilePairDocument(oldContents: "removed", newContents: "")

        XCTAssertEqual(document.stats.additions, 0)
        XCTAssertEqual(document.stats.deletions, 1)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testFilePairStatsTreatBothEmptyFilesAsZeroLines() {
        let document = makeFilePairDocument(oldContents: "", newContents: "")

        XCTAssertEqual(document.stats.additions, 0)
        XCTAssertEqual(document.stats.deletions, 0)
        XCTAssertEqual(document.stats.files, 1)
    }

    func testRendererEscapesUserVisibleText() {
        let document = DiffDocument(
            title: "<Title>",
            source: .patch("+<script>alert('x')</script>")
        )

        let html = DiffHTMLRenderer().render(document)

        XCTAssertTrue(html.contains("&lt;Title&gt;"))
        XCTAssertTrue(html.contains("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"))
        XCTAssertFalse(html.contains("<script>alert"))
    }

    private func makeFilePairDocument(oldContents: String, newContents: String) -> DiffDocument {
        DiffDocument(
            title: "File pair",
            source: .filePair(
                oldFile: DiffFileVersion(name: "before.txt", contents: oldContents),
                newFile: DiffFileVersion(name: "after.txt", contents: newContents)
            )
        )
    }
}
