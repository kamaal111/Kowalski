// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiUtils",
    platforms: [.macOS(.v12)],
    products: [
        .library(name: "KowalskiUtils", targets: ["KowalskiUtils"]),
    ],
    targets: [
        .target(
            name: "KowalskiUtils",
            swiftSettings: [
                .treatAllWarnings(as: .error),
                .strictMemorySafety(),
                .enableExperimentalFeature("StrictConcurrency"),
            ],
        ),
    ],
)
