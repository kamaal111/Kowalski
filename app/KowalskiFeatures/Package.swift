// swift-tools-version: 6.2.4
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiFeatures",
    defaultLocalization: "en",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "KowalskiAuth", targets: ["KowalskiAuth"]),
        .library(name: "KowalskiPortfolio", targets: ["KowalskiPortfolio"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Kamaalio/KamaalSwift", .upToNextMajor(from: "3.5.0")),
        .package(url: "https://github.com/kamaal111/ForexKit", .upToNextMajor(from: "5.0.0")),
        .package(path: "../KowalskiClient"),
        .package(path: "../KowalskiDesignSystem"),
        .package(path: "../KowalskiUtils"),
    ],
    targets: [
        .target(
            name: "KowalskiFeaturesConfig",
            dependencies: [
                "ForexKit",
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ],
        ),
        .target(
            name: "KowalskiAuth",
            dependencies: [
                .product(name: "KamaalLogger", package: "KamaalSwift"),
                .product(name: "KamaalUI", package: "KamaalSwift"),
                .product(name: "KamaalUtils", package: "KamaalSwift"),
                "ForexKit",
                "KowalskiClient",
                "KowalskiDesignSystem",
                "KowalskiFeaturesConfig",
                "KowalskiUtils",
            ],
            resources: [
                .process("Localizable.xcstrings"),
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ],
        ),
        .target(
            name: "KowalskiPortfolio",
            dependencies: [
                .product(name: "KamaalUI", package: "KamaalSwift"),
                .product(name: "KamaalLogger", package: "KamaalSwift"),
                .product(name: "KamaalExtensions", package: "KamaalSwift"),
                "ForexKit",
                "KowalskiAuth",
                "KowalskiUtils",
                "KowalskiDesignSystem",
                "KowalskiFeaturesConfig",
            ],
            resources: [
                .process("Localizable.xcstrings"),
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ],
        ),
        .testTarget(
            name: "KowalskiPortfolioTests",
            dependencies: [
                "KowalskiPortfolio",
                "KowalskiClient",
                "ForexKit",
                "KowalskiFeaturesConfig",
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ],
        ),
        .testTarget(
            name: "KowalskiAuthTests",
            dependencies: [
                "KowalskiAuth",
                "KowalskiClient",
                "ForexKit",
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ],
        ),
    ],
)
