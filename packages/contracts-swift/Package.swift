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
    targets: [
        .target(
            name: "SOSMeshContracts"),
        .testTarget(
            name: "SOSMeshContractsTests",
            dependencies: ["SOSMeshContracts"]),
    ]
)
