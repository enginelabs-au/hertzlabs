// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "HertzAudioEngine",
    platforms: [
        .iOS(.v17),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "HertzAudioEngine",
            targets: ["HertzAudioEngine"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-atomics.git", from: "1.2.0"),
        .package(url: "https://github.com/google/generative-ai-swift", from: "0.5.0")
    ],
    targets: [
        .target(
            name: "HertzAudioEngine",
            dependencies: [
                .product(name: "Atomics", package: "swift-atomics"),
                .product(name: "GoogleGenerativeAI", package: "generative-ai-swift")
            ]
        ),
        .testTarget(
            name: "HertzAudioEngineTests",
            dependencies: ["HertzAudioEngine"]
        )
    ]
)
