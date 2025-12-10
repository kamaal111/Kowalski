// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiDesignSystem",
    defaultLocalization: "en",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "KowalskiDesignSystem", targets: ["KowalskiDesignSystem"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Kamaalio/KamaalSwift", .upToNextMajor(from: "3.3.1")),
        .package(url: "https://github.com/kamaal111/swift-validator", .upToNextMinor(from: "0.0.5")),
    ],
    targets: [
        .target(
            name: "KowalskiDesignSystem",
            dependencies: [
                .product(name: "KamaalUI", package: "KamaalSwift"),
                .product(name: "SwiftValidator", package: "swift-validator"),
            ],
            resources: [
                .process("Resources/Assets.xcassets"),
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ]
        ),
    ]
)
