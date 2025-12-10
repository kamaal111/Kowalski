// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiApp",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "KowalskiApp", targets: ["KowalskiApp"]),
    ],
    dependencies: [
        .package(path: "../KowalskiFeatures"),
    ],
    targets: [
        .target(
            name: "KowalskiApp",
            dependencies: [
                .product(name: "KowalskiAuth", package: "KowalskiFeatures"),
                .product(name: "KowalskiPortfolio", package: "KowalskiFeatures"),
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ]
        ),
    ]
)
