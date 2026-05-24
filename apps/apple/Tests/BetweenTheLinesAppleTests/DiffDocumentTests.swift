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
}
