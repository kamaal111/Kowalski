// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "KowalskiClient",
    platforms: [.macOS(.v10_15)],
    products: [
        .library(name: "KowalskiClient", targets: ["KowalskiClient"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-urlsession", .upToNextMajor(from: "1.1.0")),
        .package(url: "https://github.com/apple/swift-openapi-runtime", .upToNextMajor(from: "1.8.2")),
        .package(url: "https://github.com/apple/swift-openapi-generator", .upToNextMajor(from: "1.10.2")),
    ],
    targets: [
        .target(
            name: "KowalskiClient",
            dependencies: [
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
    ]
)
