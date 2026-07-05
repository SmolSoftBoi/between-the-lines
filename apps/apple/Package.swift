// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "BetweenTheLinesApple",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "BetweenTheLinesApple",
            targets: ["BetweenTheLinesApple"]
        ),
        .executable(
            name: "BetweenTheLinesPreview",
            targets: ["BetweenTheLinesPreview"]
        ),
    ],
    targets: [
        .target(
            name: "BetweenTheLinesApple",
            resources: [
                .copy("Resources"),
            ]
        ),
        .executableTarget(
            name: "BetweenTheLinesPreview",
            dependencies: ["BetweenTheLinesApple"]
        ),
        .testTarget(
            name: "BetweenTheLinesAppleTests",
            dependencies: ["BetweenTheLinesApple"]
        ),
    ]
)
