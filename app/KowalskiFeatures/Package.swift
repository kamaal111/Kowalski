// swift-tools-version: 6.2
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
        .package(url: "https://github.com/Kamaalio/KamaalSwift", .upToNextMajor(from: "3.3.1")),
        .package(url: "https://github.com/kamaal111/ForexKit", .upToNextMajor(from: "4.0.0")),
        .package(path: "../KowalskiClient"),
        .package(path: "../KowalskiDesignSystem"),
        .package(path: "../KowalskiUtils"),
    ],
    targets: [
        .target(
            name: "KowalskiAuth",
            dependencies: [
                .product(name: "KamaalLogger", package: "KamaalSwift"),
                .product(name: "KamaalUI", package: "KamaalSwift"),
                .product(name: "KamaalUtils", package: "KamaalSwift"),
                "ForexKit",
                "KowalskiClient",
                "KowalskiDesignSystem",
                "KowalskiUtils",
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
            ]
        ),
        .target(
            name: "KowalskiPortfolio",
            dependencies: [
                .product(name: "KamaalUI", package: "KamaalSwift"),
                .product(name: "KamaalLogger", package: "KamaalSwift"),
                .product(name: "KamaalExtensions", package: "KamaalSwift"),
                "KowalskiAuth",
                "KowalskiDesignSystem",
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
            ]
        ),
    ]
)
