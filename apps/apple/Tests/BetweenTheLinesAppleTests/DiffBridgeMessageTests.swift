import XCTest
@testable import BetweenTheLinesApple

final class DiffBridgeMessageTests: XCTestCase {
    func testMalformedBridgeBodyClassifiesAsRenderFailed() {
        let event = classifyDiffBridgeMessageBody("not a bridge dictionary")

        XCTAssertEqual(event.name, .renderFailed)
        XCTAssertEqual(event.properties, ["reason": "invalid_bridge_message"])
    }

    func testBridgeBodyMissingTypeClassifiesAsRenderFailed() {
        let event = classifyDiffBridgeMessageBody(["source": "web_renderer"])

        XCTAssertEqual(event.name, .renderFailed)
        XCTAssertEqual(event.properties, ["reason": "invalid_bridge_message"])
    }

    func testUnknownBridgeMessageClassifiesAsRenderFailedWithoutRawType() {
        let event = classifyDiffBridgeMessageBody([
            "type": "openDocument",
            "documentId": "secret-document-id",
            "path": "/tmp/private.patch",
        ])

        XCTAssertEqual(event.name, .renderFailed)
        XCTAssertEqual(event.properties, ["reason": "unknown_bridge_message"])
    }

    func testRenderCompletedClassifiesWithSafeRendererMetadata() {
        let event = classifyDiffBridgeMessageBody([
            "type": "renderCompleted",
            "durationMs": 12.6,
            "stats": [
                "additions": 3,
                "deletions": 1,
                "files": 2,
                "sizeBucket": "small",
                "patch": "+secret",
            ],
        ])

        XCTAssertEqual(event.name, .renderCompleted)
        XCTAssertEqual(
            event.properties,
            [
                "additions": "3",
                "deletions": "1",
                "duration_ms": "13",
                "files": "2",
                "size_bucket": "small",
                "source": "web_renderer",
            ]
        )
    }

    func testRenderCompletedAcceptsTrimmedNumericStringMetadata() {
        let event = classifyDiffBridgeMessageBody([
            "type": "renderCompleted",
            "durationMs": " 42 ",
            "stats": [
                "additions": "7",
                "deletions": " 0 ",
                "files": "001",
                "sizeBucket": "medium",
            ],
        ])

        XCTAssertEqual(event.name, .renderCompleted)
        XCTAssertEqual(
            event.properties,
            [
                "additions": "7",
                "deletions": "0",
                "duration_ms": "42",
                "files": "001",
                "size_bucket": "medium",
                "source": "web_renderer",
            ]
        )
    }

    func testRenderCompletedDropsInvalidNumericStringMetadata() {
        let event = classifyDiffBridgeMessageBody([
            "type": "renderCompleted",
            "durationMs": "",
            "stats": [
                "additions": "12ms",
                "deletions": "12.5",
                "files": "-1",
                "sizeBucket": "small",
            ],
        ])

        XCTAssertEqual(event.name, .renderCompleted)
        XCTAssertEqual(
            event.properties,
            [
                "size_bucket": "small",
                "source": "web_renderer",
            ]
        )
    }

    func testUpdateSettingsClassifiesOnlySafeSettingMetadata() {
        let event = classifyDiffBridgeMessageBody([
            "type": "updateSettings",
            "setting": "line_numbers",
            "path": "/tmp/private.patch",
        ])

        XCTAssertEqual(event.name, .settingsChanged)
        XCTAssertEqual(
            event.properties,
            [
                "setting": "line_numbers",
                "source": "web_renderer",
            ]
        )
    }
}
