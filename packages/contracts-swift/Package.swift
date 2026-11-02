// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SOSMeshContracts",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(
            name: "SOSMeshContracts",
            targets: ["SOSMeshContracts"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .target(
            name: "SOSMeshContracts",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ]),
        .testTarget(
            name: "SOSMeshContractsTests",
            dependencies: ["SOSMeshContracts"],
            resources: [
                .copy("Resources/golden-001.json"),
                .copy("Resources/canonical-json-001.json"),
            ]),
    ]
)
