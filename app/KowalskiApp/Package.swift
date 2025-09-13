// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiApp",
    platforms: [.macOS(.v11), .iOS(.v14)],
    products: [
        .library(name: "KowalskiApp", targets: ["KowalskiApp"]),
    ],
    dependencies: [
        .package(path: "../KowalskiClient"),
    ],
    targets: [
        .target(
            name: "KowalskiApp",
            dependencies: [
                "KowalskiClient",
            ]
        ),
    ]
)
