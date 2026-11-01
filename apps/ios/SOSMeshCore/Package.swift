// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SOSMeshCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [
        .library(name: "SOSMeshCore", targets: ["SOSMeshCore"]),
    ],
    dependencies: [
        .package(path: "../../../packages/contracts-swift"),
    ],
    targets: [
        .target(
            name: "SOSMeshCore",
            dependencies: [
                .product(name: "SOSMeshContracts", package: "contracts-swift"),
            ]),
        .testTarget(
            name: "SOSMeshCoreTests",
            dependencies: [
                "SOSMeshCore",
                .product(name: "SOSMeshContracts", package: "contracts-swift"),
            ],
            resources: [.copy("Resources")]),
    ]
)
