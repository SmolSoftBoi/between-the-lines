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

    func testRenderStartedClassifiesWithoutSourceMetadata() {
        let event = classifyDiffBridgeMessageBody([
            "type": "renderStarted",
            "source": "web_renderer",
        ])

        XCTAssertEqual(event.name, .renderStarted)
        XCTAssertEqual(event.properties, [:])
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
                "duration_bucket": "under_100ms",
                "files": "2",
                "size_bucket": "small",
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
                "duration_bucket": "under_100ms",
                "files": "001",
                "size_bucket": "medium",
            ]
        )
    }

    func testRenderCompletedBucketsDoubleDurationsWithoutRounding() {
        let event = classifyDiffBridgeMessageBody([
            "type": "renderCompleted",
            "durationMs": 99.6,
        ])

        XCTAssertEqual(event.name, .renderCompleted)
        XCTAssertEqual(
            event.properties,
            [
                "duration_bucket": "under_100ms",
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
            ]
        )
    }

    func testUpdateSettingsClassifiesOnlySafeSettingMetadata() {
        let event = classifyDiffBridgeMessageBody([
            "type": "updateSettings",
            "setting": "overflow",
            "path": "/tmp/private.patch",
        ])

        XCTAssertEqual(event.name, .settingsChanged)
        XCTAssertEqual(
            event.properties,
            [
                "setting": "overflow",
            ]
        )
    }

    func testRendererSettingsParsesSafeUpdateSettingsMessage() {
        let settings = rendererSettings(
            from: [
                "type": "updateSettings",
                "settings": [
                    "diffStyle": "unified",
                    "overflow": "wrap",
                    "themeType": "dark",
                    "lineDiffType": "char",
                    "lineNumbers": false,
                    "collapsedContextThreshold": 4,
                    "telemetryOptIn": true,
                    "path": "/tmp/private.patch",
                ],
            ],
            currentSettings: ViewerSettings()
        )

        XCTAssertEqual(settings?.diffStyle, .unified)
        XCTAssertEqual(settings?.overflow, .wrap)
        XCTAssertEqual(settings?.themeType, .dark)
        XCTAssertEqual(settings?.lineDiffType, .character)
        XCTAssertEqual(settings?.lineNumbers, false)
        XCTAssertEqual(settings?.collapsedContextThreshold, 4)
        XCTAssertEqual(settings?.telemetryOptIn, true)
    }

    func testRendererSettingsRejectsMessagesWithoutValidSettings() {
        let currentSettings = ViewerSettings()
        let settings = rendererSettings(
            from: [
                "type": "updateSettings",
                "settings": [
                    "diffStyle": "side-by-side",
                    "collapsedContextThreshold": -1,
                    "lineNumbers": "false",
                ],
            ],
            currentSettings: currentSettings
        )

        XCTAssertNil(settings)
    }

    func testRenderDiffPostMessageScriptEscapesJavaScriptLineSeparators() {
        let script = makeRenderDiffPostMessageScript(
            documentJSON: "{\"title\":\"Line separator\u{2028}Paragraph separator\u{2029}\"}"
        )

        XCTAssertFalse(script.contains("\u{2028}"))
        XCTAssertFalse(script.contains("\u{2029}"))
        XCTAssertTrue(script.contains(#"\u2028"#))
        XCTAssertTrue(script.contains(#"\u2029"#))
    }

    func testBundledRendererURLFindsSwiftPackageResources() throws {
        let resourceURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let rendererDirectoryURL = resourceURL
            .appendingPathComponent("Resources/native-renderer", isDirectory: true)
        let rendererURL = rendererDirectoryURL.appendingPathComponent("native.html")

        try FileManager.default.createDirectory(
            at: rendererDirectoryURL,
            withIntermediateDirectories: true
        )
        try "<html></html>".write(to: rendererURL, atomically: true, encoding: .utf8)
        defer {
            try? FileManager.default.removeItem(at: resourceURL)
        }

        XCTAssertEqual(
            bundledRendererURL(environment: [:], resourceURLs: [resourceURL]),
            rendererURL
        )
    }
}
