import XCTest
@testable import BetweenTheLinesApple

final class TelemetryTests: XCTestCase {
    func testInMemoryTelemetryClientStoresTrackedEvents() {
        let client = InMemoryTelemetryClient()
        let event = TelemetryEvent(
            name: .renderCompleted,
            properties: ["files": "2"],
            date: Date(timeIntervalSince1970: 1_800_000_000)
        )

        client.track(event)

        XCTAssertEqual(client.events, [event])
    }

    func testTelemetryKeepsOnlyAllowListedMetadata() {
        let event = TelemetryEvent(
            name: .renderCompleted,
            properties: [
                "additions": "12",
                "deletions": "0",
                "duration_bucket": "under_500ms",
                "files": "1",
                "reason": "invalid_bridge_message",
                "setting": "diff_style",
                "setting_overflow": "overflow",
                "size_bucket": "huge",
                "file_name": "secret.swift",
                "patch": "+token",
                "unknown": "private review note",
            ]
        )

        XCTAssertEqual(
            event.properties,
            [
                "additions": "12",
                "deletions": "0",
                "duration_bucket": "under_500ms",
                "files": "1",
                "reason": "invalid_bridge_message",
                "setting": "diff_style",
                "size_bucket": "huge",
            ]
        )
    }

    func testTelemetryDropsInvalidAllowListedValues() {
        let event = TelemetryEvent(
            name: .renderFailed,
            properties: [
                "additions": "12.5",
                "deletions": "-1",
                "duration_bucket": "240ms",
                "files": "one",
                "reason": "fatal error: /tmp/private.patch",
                "setting": "file_path",
                "size_bucket": "massive",
                "source": "native_renderer",
            ]
        )

        XCTAssertEqual(event.properties, [:])
    }
}
