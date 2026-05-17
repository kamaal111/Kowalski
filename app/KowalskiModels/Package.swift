// swift-tools-version: 6.2.4
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiModels",
    defaultLocalization: "en",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "KowalskiModels", targets: ["KowalskiModels"]),
    ],
    targets: [
        .target(name: "KowalskiModels"),
    ],
    swiftLanguageModes: [.v6],
)
