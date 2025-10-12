// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "swift-validator",
    platforms: [.macOS(.v10_13), .iOS(.v12)],
    products: [
        .library(name: "SwiftValidator", targets: ["SwiftValidator"]),
    ],
    targets: [
        .target(name: "SwiftValidator"),
    ]
)
