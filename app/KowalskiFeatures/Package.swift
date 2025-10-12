// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiFeatures",
    defaultLocalization: "en",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "KowalskiAuth", targets: ["KowalskiAuth"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Kamaalio/KamaalSwift", .upToNextMajor(from: "3.3.1")),
        .package(path: "../KowalskiClient"),
        .package(path: "../KowalskiDesignSystem"),
    ],
    targets: [
        .target(
            name: "KowalskiAuth",
            dependencies: [
                .product(name: "KamaalLogger", package: "KamaalSwift"),
                .product(name: "KamaalUI", package: "KamaalSwift"),
                "KowalskiClient",
                "KowalskiDesignSystem",
            ]
        ),
    ]
)
