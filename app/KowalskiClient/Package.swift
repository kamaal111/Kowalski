// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiClient",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "KowalskiClient", targets: ["KowalskiClient"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-urlsession", .upToNextMajor(from: "1.2.0")),
        .package(url: "https://github.com/apple/swift-openapi-runtime", .upToNextMajor(from: "1.8.3")),
        .package(url: "https://github.com/apple/swift-openapi-generator", .upToNextMajor(from: "1.10.3")),
        .package(url: "https://github.com/apple/swift-http-types", .upToNextMajor(from: "1.5.1")),
        .package(url: "https://github.com/Kamaalio/KamaalSwift", .upToNextMajor(from: "3.3.1")),
        .package(path: "../KowalskiUtils"),
    ],
    targets: [
        .target(
            name: "KowalskiClient",
            dependencies: [
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "HTTPTypes", package: "swift-http-types"),
                .product(name: "KamaalUtils", package: "KamaalSwift"),
                .product(name: "KamaalLogger", package: "KamaalSwift"),
                "KowalskiUtils",
            ],
            swiftSettings: [
                .treatAllWarnings(as: .error),
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
    ]
)
