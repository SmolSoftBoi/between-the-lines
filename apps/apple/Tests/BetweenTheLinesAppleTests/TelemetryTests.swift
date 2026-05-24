import XCTest
@testable import BetweenTheLinesApple

final class TelemetryTests: XCTestCase {
    func testInMemoryTelemetryClientStoresTrackedEvents() {
        let client = InMemoryTelemetryClient()
        let event = TelemetryEvent(
            name: .renderCompleted,
            properties: ["change_count": "2"],
            date: Date(timeIntervalSince1970: 1_800_000_000)
        )

        client.track(event)

        XCTAssertEqual(client.events, [event])
    }

    func testTelemetryDropsSensitiveProperties() {
        let event = TelemetryEvent(
            name: .diffLoaded,
            properties: [
                "files": "1",
                "file_name": "secret.swift",
                "patch": "+token",
                "note": "private review note",
            ]
        )

        XCTAssertEqual(event.properties, ["files": "1"])
    }
}
