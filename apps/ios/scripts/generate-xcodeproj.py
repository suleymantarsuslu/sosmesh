#!/usr/bin/env python3
"""Generate a minimal SOSMesh.xcodeproj for CI xcodebuild (ADIM 31, release ADIM 52)."""
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]
PROJ = ROOT / "SOSMesh.xcodeproj" / "project.pbxproj"
PROJ.parent.mkdir(parents=True, exist_ok=True)

APP_SOURCES = [
    "SOSMesh/SOSMeshApp.swift",
    "SOSMesh/AppModel.swift",
    "SOSMesh/RootTabView.swift",
    "SOSMesh/Features/HomeView.swift",
    "SOSMesh/Features/CrossPlatformFaultViews.swift",
    "SOSMesh/Features/StatusView.swift",
    "SOSMesh/Features/RelayView.swift",
    "SOSMesh/Features/SettingsView.swift",
    "SOSMesh/Features/PermissionGateView.swift",
    "SOSMesh/Features/EmergencyCall112Link.swift",
    "SOSMesh/Features/EmergencyCall112Button.swift",
    "SOSMesh/Permissions/LiveAppPermissionProbe.swift",
    "SOSMesh/Crypto/SosCryptoConfiguration.swift",
    "SOSMesh/Storage/OutboxStorePaths.swift",
    "SOSMesh/Companion/PhoneWatchSessionManager.swift",
    "SOSMesh/Companion/PhoneWatchOutboxAdapter.swift",
    "SOSMesh/Companion/PhoneWatchCompanionHolder.swift",
    "CoreBLE/BleCentralCoordinator.swift",
    "CoreBLE/BlePeripheralCoordinator.swift",
    "CoreBLE/BleBackgroundConfiguration.swift",
    "CoreBLE/BleGattBridge.swift",
    "CoreBLE/LiveBleMeshRadio.swift",
]

WATCH_APP_SOURCES = [
    "../watchos/SOSMeshWatch/SOSMeshWatchApp.swift",
    "../watchos/SOSMeshWatch/WatchAppModel.swift",
    "../watchos/SOSMeshWatch/WatchRootView.swift",
    "../watchos/SOSMeshWatch/WatchSessionBridge.swift",
]

WATCH_WIDGET_SOURCES = [
    "../watchos/SOSMeshWatchWidgets/SOSMeshWatchWidgetsBundle.swift",
    "../watchos/SOSMeshWatch/Complications/SOSMeshComplicationWidget.swift",
]

WATCH_RESOURCES = [
    "../watchos/SOSMeshWatch/Info.plist",
    "../watchos/SOSMeshWatch/PrivacyInfo.xcprivacy",
]

WATCH_WIDGET_RESOURCES = [
    "../watchos/SOSMeshWatchWidgets/PrivacyInfo.xcprivacy",
]

RESOURCES = [
    "SOSMesh/Info.plist",
    "SOSMesh/SOSMesh.entitlements",
    "SOSMesh/PrivacyInfo.xcprivacy",
    "SOSMesh/tr.lproj/Localizable.strings",
    "SOSMesh/en.lproj/Localizable.strings",
    "SOSMesh/tr.lproj/InfoPlist.strings",
    "SOSMesh/en.lproj/InfoPlist.strings",
    "SOSMesh/Assets.xcassets",
]

IOS_COPY_RESOURCES = [
    "SOSMesh/PrivacyInfo.xcprivacy",
    "SOSMesh/tr.lproj/Localizable.strings",
    "SOSMesh/en.lproj/Localizable.strings",
    "SOSMesh/tr.lproj/InfoPlist.strings",
    "SOSMesh/en.lproj/InfoPlist.strings",
    "SOSMesh/Assets.xcassets",
]

TEST_SOURCES = [
    "SOSMeshTests/SOSMeshCoreLinkTests.swift",
    "SOSMeshTests/AppModelPermissionGateTests.swift",
    "SOSMeshTests/EmergencyCall112LinkTests.swift",
    "SOSMeshTests/SosCryptoConfigurationErrorTests.swift",
]


def uid(n: int) -> str:
    return f"A31{n:04d}0000000000000001"


def uid37(n: int) -> str:
    return f"A37{n:04d}0000000000000001"


lines = []
lines.append("// !$*UTF8*$!")
lines.append("{")
lines.append("\tarchiveVersion = 1;")
lines.append("\tclasses = {")
lines.append("\t};")
lines.append("\tobjectVersion = 56;")
lines.append("\tobjects = {")

# File references
all_source_paths = APP_SOURCES + TEST_SOURCES + WATCH_APP_SOURCES + WATCH_WIDGET_SOURCES
file_refs = {}
for i, path in enumerate(
    all_source_paths + RESOURCES + WATCH_RESOURCES + WATCH_WIDGET_RESOURCES, start=1
):
    ref = uid(i)
    file_refs[path] = ref
    isa = "PBXFileReference"
    last = path.split("/")[-1]
    if path.endswith(".swift"):
        if path.startswith("../"):
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = sourcecode.swift; path = {path}; sourceTree = SOURCE_ROOT; }};"
            )
        else:
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = sourcecode.swift; path = {last}; sourceTree = \"<group>\"; }};"
            )
    elif path.endswith(".plist"):
        if path.startswith("../"):
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.plist.xml; path = {path}; sourceTree = SOURCE_ROOT; }};"
            )
        else:
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.plist.xml; path = {last}; sourceTree = \"<group>\"; }};"
            )
    elif path.endswith(".strings"):
        if ".lproj/" in path:
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.plist.strings; path = {path}; sourceTree = SOURCE_ROOT; }};"
            )
        else:
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.plist.strings; path = {last}; sourceTree = \"<group>\"; }};"
            )
    elif path.endswith(".xcassets"):
        lines.append(f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = folder.assetcatalog; path = {last}; sourceTree = \"<group>\"; }};")
    elif path.endswith(".xcprivacy"):
        if path.startswith("../"):
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.xml; path = {path}; sourceTree = SOURCE_ROOT; }};"
            )
        else:
            lines.append(
                f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.xml; path = {last}; sourceTree = \"<group>\"; }};"
            )
    elif path.endswith(".entitlements"):
        lines.append(
            f"\t\t{ref} /* {last} */ = {{isa = {isa}; lastKnownFileType = text.plist.entitlements; path = {last}; sourceTree = \"<group>\"; }};"
        )

prod_ref = uid(9001)
lines.append(f"\t\t{prod_ref} /* SOSMesh.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = SOSMesh.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
test_prod_ref = uid(9002)
lines.append(f"\t\t{test_prod_ref} /* SOSMeshTests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = SOSMeshTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};")
watch_prod_ref = uid37(9001)
lines.append(f"\t\t{watch_prod_ref} /* SOSMeshWatch.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = SOSMeshWatch.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
watch_widget_prod_ref = uid37(9002)
lines.append(
    f"\t\t{watch_widget_prod_ref} /* SOSMeshWatchWidgets.appex */ = {{isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; includeInIndex = 0; path = SOSMeshWatchWidgets.appex; sourceTree = BUILT_PRODUCTS_DIR; }};"
)

# Groups
main_group = uid(8000)
products_group = uid(8001)
app_group = uid(8002)
coreble_group = uid(8003)
features_group = uid(8004)
tests_group = uid(8005)
permissions_group = uid(8006)
crypto_group = uid(8007)
storage_group = uid(8008)
watch_group = uid37(8001)
watch_widget_group = uid37(8002)
companion_group = uid37(8003)

lines.append(
    f"\t\t{products_group} = {{isa = PBXGroup; children = ({prod_ref} /* SOSMesh.app */, {test_prod_ref} /* SOSMeshTests.xctest */, {watch_prod_ref} /* SOSMeshWatch.app */, {watch_widget_prod_ref} /* SOSMeshWatchWidgets.appex */); name = Products; sourceTree = \"<group>\"; }};"
)

feat_children = ", ".join(file_refs[p] + f" /* {p.split('/')[-1]} */" for p in APP_SOURCES if "Features/" in p)
lines.append(f"\t\t{features_group} = {{isa = PBXGroup; children = ({feat_children}); path = Features; sourceTree = \"<group>\"; }};")

ble_children = ", ".join(file_refs[p] + f" /* {p.split('/')[-1]} */" for p in APP_SOURCES if p.startswith("CoreBLE"))
lines.append(f"\t\t{coreble_group} = {{isa = PBXGroup; children = ({ble_children}); path = CoreBLE; sourceTree = \"<group>\"; }};")

companion_children = ", ".join(
    file_refs[p] + f" /* {p.split('/')[-1]} */" for p in APP_SOURCES if p.startswith("SOSMesh/Companion/")
)
lines.append(f"\t\t{companion_group} = {{isa = PBXGroup; children = ({companion_children}); path = Companion; sourceTree = \"<group>\"; }};")

permissions_children = ", ".join(
    file_refs[p] + f" /* {p.split('/')[-1]} */" for p in APP_SOURCES if p.startswith("SOSMesh/Permissions/")
)
lines.append(
    f"\t\t{permissions_group} = {{isa = PBXGroup; children = ({permissions_children}); path = Permissions; sourceTree = \"<group>\"; }};"
)

crypto_children = ", ".join(
    file_refs[p] + f" /* {p.split('/')[-1]} */" for p in APP_SOURCES if p.startswith("SOSMesh/Crypto/")
)
lines.append(f"\t\t{crypto_group} = {{isa = PBXGroup; children = ({crypto_children}); path = Crypto; sourceTree = \"<group>\"; }};")

storage_children = ", ".join(
    file_refs[p] + f" /* {p.split('/')[-1]} */" for p in APP_SOURCES if p.startswith("SOSMesh/Storage/")
)
lines.append(f"\t\t{storage_group} = {{isa = PBXGroup; children = ({storage_children}); path = Storage; sourceTree = \"<group>\"; }};")

watch_children = ", ".join(file_refs[p] + f" /* {p.split('/')[-1]} */" for p in WATCH_APP_SOURCES)
lines.append(f"\t\t{watch_group} = {{isa = PBXGroup; children = ({watch_children}); name = SOSMeshWatch; path = ../watchos/SOSMeshWatch; sourceTree = \"<group>\"; }};")

watch_widget_children = ", ".join(file_refs[p] + f" /* {p.split('/')[-1]} */" for p in WATCH_WIDGET_SOURCES)
lines.append(
    f"\t\t{watch_widget_group} = {{isa = PBXGroup; children = ({watch_widget_children}); name = SOSMeshWatchWidgets; path = ../watchos/SOSMeshWatchWidgets; sourceTree = \"<group>\"; }};"
)

app_children = []
for p in APP_SOURCES:
    if p.startswith("CoreBLE/"):
        continue
    if "Features/" in p:
        continue
    if p.startswith("SOSMesh/Companion/"):
        continue
    if p.startswith("SOSMesh/Permissions/"):
        continue
    if p.startswith("SOSMesh/Crypto/"):
        continue
    if p.startswith("SOSMesh/Storage/"):
        continue
    app_children.append(f"{file_refs[p]} /* {p.split('/')[-1]} */")
app_children.append(f"{features_group} /* Features */")
app_children.append(f"{companion_group} /* Companion */")
app_children.append(f"{permissions_group} /* Permissions */")
app_children.append(f"{crypto_group} /* Crypto */")
app_children.append(f"{storage_group} /* Storage */")
app_children.append(f"{file_refs['SOSMesh/tr.lproj/Localizable.strings']} /* Localizable.strings */")
app_children.append(f"{file_refs['SOSMesh/en.lproj/Localizable.strings']} /* Localizable.strings */")
app_children.append(f"{file_refs['SOSMesh/Assets.xcassets']} /* Assets.xcassets */")
app_children.append(f"{file_refs['SOSMesh/Info.plist']} /* Info.plist */")
app_children.append(f"{file_refs['SOSMesh/SOSMesh.entitlements']} /* SOSMesh.entitlements */")
app_children.append(f"{file_refs['SOSMesh/PrivacyInfo.xcprivacy']} /* PrivacyInfo.xcprivacy */")
lines.append(f"\t\t{app_group} = {{isa = PBXGroup; children = ({', '.join(app_children)}); path = SOSMesh; sourceTree = \"<group>\"; }};")

test_children = ", ".join(file_refs[p] + f" /* {p.split('/')[-1]} */" for p in TEST_SOURCES)
lines.append(f"\t\t{tests_group} = {{isa = PBXGroup; children = ({test_children}); path = SOSMeshTests; sourceTree = \"<group>\"; }};")

lines.append(
    f"\t\t{main_group} = {{isa = PBXGroup; children = ({app_group} /* SOSMesh */, {coreble_group} /* CoreBLE */, {watch_group} /* SOSMeshWatch */, {watch_widget_group} /* SOSMeshWatchWidgets */, {tests_group} /* SOSMeshTests */, {products_group} /* Products */); sourceTree = \"<group>\"; }};"
)

# Build phases
app_sources_phase = uid(7001)
test_sources_phase = uid(7002)
resources_phase = uid(7003)
frameworks_phase = uid(7004)
test_frameworks_phase = uid(7005)
watch_sources_phase = uid37(7001)
watch_resources_phase = uid37(7002)
watch_frameworks_phase = uid37(7003)
watch_widget_sources_phase = uid37(7004)
watch_widget_frameworks_phase = uid37(7005)
watch_widget_resources_phase = uid37(7006)

app_build_files = []
for p in APP_SOURCES:
    bf = uid(6000 + len(app_build_files))
    lines.append(f"\t\t{bf} /* {p.split('/')[-1]} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {p.split('/')[-1]} */; }};")
    app_build_files.append(bf)

test_build_files = []
for p in TEST_SOURCES:
    bf = uid(6500 + len(test_build_files))
    lines.append(f"\t\t{bf} /* {p.split('/')[-1]} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {p.split('/')[-1]} */; }};")
    test_build_files.append(bf)

watch_build_files = []
for p in WATCH_APP_SOURCES:
    bf = uid37(6000 + len(watch_build_files))
    lines.append(f"\t\t{bf} /* {p.split('/')[-1]} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {p.split('/')[-1]} */; }};")
    watch_build_files.append(bf)

watch_widget_build_files = []
for p in WATCH_WIDGET_SOURCES:
    bf = uid37(6100 + len(watch_widget_build_files))
    lines.append(f"\t\t{bf} /* {p.split('/')[-1]} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {p.split('/')[-1]} */; }};")
    watch_widget_build_files.append(bf)

# Local packages and framework build files (referenced by build phases below)
pkg_core = uid(5001)
pkg_contracts = uid(5002)
lines.append(f"\t\t{pkg_core} /* XCLocalSwiftPackageReference \"SOSMeshCore\" */ = {{isa = XCLocalSwiftPackageReference; relativePath = SOSMeshCore; }};")
lines.append(
    f"\t\t{pkg_contracts} /* XCLocalSwiftPackageReference \"contracts-swift\" */ = {{isa = XCLocalSwiftPackageReference; relativePath = ../../packages/contracts-swift; }};"
)

prod_dep_core = uid(5101)
prod_dep_contracts = uid(5102)
prod_dep_core_watch = uid37(5103)
fw_core_app = uid(6701)
fw_contracts_app = uid(6702)
fw_core_test = uid(6703)
fw_core_watch = uid37(6710)
fw_core_watch_widget = uid37(6711)
wc_ios_bf = uid37(6720)
wc_watch_bf = uid37(6721)
wk_bf = uid37(6722)
wc_ios_ref = uid37(6801)
wc_watch_ref = uid37(6802)
wk_ref = uid37(6803)

lines.append(
    f"\t\t{fw_core_app} /* SOSMeshCore in Frameworks */ = {{isa = PBXBuildFile; productRef = {prod_dep_core} /* SOSMeshCore */; }};"
)
lines.append(
    f"\t\t{fw_contracts_app} /* SOSMeshContracts in Frameworks */ = {{isa = PBXBuildFile; productRef = {prod_dep_contracts} /* SOSMeshContracts */; }};"
)
lines.append(
    f"\t\t{fw_core_test} /* SOSMeshCore in Frameworks */ = {{isa = PBXBuildFile; productRef = {prod_dep_core} /* SOSMeshCore */; }};"
)
lines.append(
    f"\t\t{fw_core_watch} /* SOSMeshCore in Frameworks */ = {{isa = PBXBuildFile; productRef = {prod_dep_core_watch} /* SOSMeshCore */; }};"
)
lines.append(
    f"\t\t{fw_core_watch_widget} /* SOSMeshCore in Frameworks */ = {{isa = PBXBuildFile; productRef = {prod_dep_core_watch} /* SOSMeshCore */; }};"
)
lines.append(f"\t\t{wc_ios_bf} /* WatchConnectivity.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {wc_ios_ref} /* WatchConnectivity.framework */; }};")
lines.append(f"\t\t{wc_watch_bf} /* WatchConnectivity.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {wc_watch_ref} /* WatchConnectivity.framework */; }};")
lines.append(f"\t\t{wk_bf} /* WidgetKit.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {wk_ref} /* WidgetKit.framework */; }};")
lines.append(f"\t\t{wc_ios_ref} /* WatchConnectivity.framework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = WatchConnectivity.framework; path = System/Library/Frameworks/WatchConnectivity.framework; sourceTree = SDKROOT; }};")
lines.append(f"\t\t{wc_watch_ref} /* WatchConnectivity.framework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = WatchConnectivity.framework; path = System/Library/Frameworks/WatchConnectivity.framework; sourceTree = SDKROOT; }};")
lines.append(f"\t\t{wk_ref} /* WidgetKit.framework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = WidgetKit.framework; path = System/Library/Frameworks/WidgetKit.framework; sourceTree = SDKROOT; }};")
lines.append(
    f"\t\t{prod_dep_core} /* SOSMeshCore */ = {{isa = XCSwiftPackageProductDependency; productName = SOSMeshCore; package = {pkg_core} /* SOSMeshCore */; }};"
)
lines.append(
    f"\t\t{prod_dep_core_watch} /* SOSMeshCore */ = {{isa = XCSwiftPackageProductDependency; productName = SOSMeshCore; package = {pkg_core} /* SOSMeshCore */; }};"
)
lines.append(
    f"\t\t{prod_dep_contracts} /* SOSMeshContracts */ = {{isa = XCSwiftPackageProductDependency; productName = SOSMeshContracts; package = {pkg_contracts} /* contracts-swift */; }};"
)

res_build_files = []
for idx, p in enumerate(IOS_COPY_RESOURCES):
    bf = uid(6600 + idx)
    label = p.split("/")[-1]
    lines.append(
        f"\t\t{bf} /* {label} in Resources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {label} */; }};"
    )
    res_build_files.append(bf)

watch_res_build_files = []
for idx, p in enumerate(WATCH_RESOURCES):
    if not p.endswith(".xcprivacy"):
        continue
    bf = uid37(6600 + idx)
    label = p.split("/")[-1]
    lines.append(
        f"\t\t{bf} /* {label} in Resources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {label} */; }};"
    )
    watch_res_build_files.append(bf)

watch_widget_res_build_files = []
for idx, p in enumerate(WATCH_WIDGET_RESOURCES):
    bf = uid37(6650 + idx)
    label = p.split("/")[-1]
    lines.append(
        f"\t\t{bf} /* {label} in Resources */ = {{isa = PBXBuildFile; fileRef = {file_refs[p]} /* {label} */; }};"
    )
    watch_widget_res_build_files.append(bf)

lines.append(
    f"\t\t{app_sources_phase} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Sources */' for b in app_build_files)}); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{test_sources_phase} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Sources */' for b in test_build_files)}); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{watch_sources_phase} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Sources */' for b in watch_build_files)}); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{watch_widget_sources_phase} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Sources */' for b in watch_widget_build_files)}); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{resources_phase} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Resources */' for b in res_build_files)}); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(f"\t\t{frameworks_phase} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({fw_core_app} /* SOSMeshCore in Frameworks */, {fw_contracts_app} /* SOSMeshContracts in Frameworks */, {wc_ios_bf} /* WatchConnectivity in Frameworks */); runOnlyForDeploymentPostprocessing = 0; }};")
lines.append(f"\t\t{test_frameworks_phase} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({fw_core_test} /* SOSMeshCore in Frameworks */); runOnlyForDeploymentPostprocessing = 0; }};")
lines.append(
    f"\t\t{watch_frameworks_phase} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({fw_core_watch} /* SOSMeshCore in Frameworks */, {wc_watch_bf} /* WatchConnectivity in Frameworks */); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{watch_widget_frameworks_phase} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({wk_bf} /* WidgetKit in Frameworks */); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{watch_resources_phase} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Resources */' for b in watch_res_build_files) if watch_res_build_files else ''}); runOnlyForDeploymentPostprocessing = 0; }};"
)
lines.append(
    f"\t\t{watch_widget_resources_phase} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({', '.join(f'{b} /* in Resources */' for b in watch_widget_res_build_files) if watch_widget_res_build_files else ''}); runOnlyForDeploymentPostprocessing = 0; }};"
)

# Targets
app_target = uid(3001)
test_target = uid(3002)
watch_target = uid37(3001)
watch_widget_target = uid37(3002)
lines.append(
    textwrap.dedent(
        f"""
\t\t{app_target} /* SOSMesh-iOS */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {uid(4001)} /* Build configuration list for PBXNativeTarget "SOSMesh-iOS" */;
\t\t\tbuildPhases = ({app_sources_phase} /* Sources */, {frameworks_phase} /* Frameworks */, {resources_phase} /* Resources */);
\t\t\tbuildRules = ();
\t\t\tdependencies = ();
\t\t\tname = "SOSMesh-iOS";
\t\t\tpackageProductDependencies = ({prod_dep_core} /* SOSMeshCore */, {prod_dep_contracts} /* SOSMeshContracts */);
\t\t\tproductName = SOSMesh;
\t\t\tproductReference = {prod_ref} /* SOSMesh.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t}};
"""
    ).strip()
)

lines.append(
    textwrap.dedent(
        f"""
\t\t{test_target} /* SOSMeshTests */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {uid(4002)} /* Build configuration list for PBXNativeTarget "SOSMeshTests" */;
\t\t\tbuildPhases = ({test_sources_phase} /* Sources */, {test_frameworks_phase} /* Frameworks */);
\t\t\tbuildRules = ();
\t\t\tdependencies = ({uid(3101)} /* PBXTargetDependency */);
\t\t\tname = SOSMeshTests;
\t\t\tpackageProductDependencies = ({prod_dep_core} /* SOSMeshCore */);
\t\t\tproductName = SOSMeshTests;
\t\t\tproductReference = {test_prod_ref} /* SOSMeshTests.xctest */;
\t\t\tproductType = "com.apple.product-type.bundle.unit-test";
\t\t}};
"""
    ).strip()
)

lines.append(
    textwrap.dedent(
        f"""
\t\t{watch_target} /* SOSMesh-Watch */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {uid37(4001)} /* Build configuration list for PBXNativeTarget "SOSMesh-Watch" */;
\t\t\tbuildPhases = ({watch_sources_phase} /* Sources */, {watch_frameworks_phase} /* Frameworks */, {watch_resources_phase} /* Resources */);
\t\t\tbuildRules = ();
\t\t\tdependencies = ();
\t\t\tname = "SOSMesh-Watch";
\t\t\tpackageProductDependencies = ({prod_dep_core_watch} /* SOSMeshCore */);
\t\t\tproductName = SOSMeshWatch;
\t\t\tproductReference = {watch_prod_ref} /* SOSMeshWatch.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t}};
"""
    ).strip()
)

lines.append(
    textwrap.dedent(
        f"""
\t\t{watch_widget_target} /* SOSMeshWatchWidgets */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {uid37(4002)} /* Build configuration list for PBXNativeTarget "SOSMeshWatchWidgets" */;
\t\t\tbuildPhases = ({watch_widget_sources_phase} /* Sources */, {watch_widget_frameworks_phase} /* Frameworks */, {watch_widget_resources_phase} /* Resources */);
\t\t\tbuildRules = ();
\t\t\tdependencies = ();
\t\t\tname = "SOSMeshWatchWidgets";
\t\t\tproductName = SOSMeshWatchWidgets;
\t\t\tproductReference = {watch_widget_prod_ref} /* SOSMeshWatchWidgets.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t}};
"""
    ).strip()
)

proj_uid = uid(2001)
lines.append(
    textwrap.dedent(
        f"""
\t\t{proj_uid} /* Project object */ = {{
\t\t\tisa = PBXProject;
\t\t\tattributes = {{ LastSwiftUpdateCheck = 1500; LastUpgradeCheck = 1500; }};
\t\t\tbuildConfigurationList = {uid(4000)} /* Build configuration list for PBXProject "SOSMesh" */;
\t\t\tcompatibilityVersion = "Xcode 14.0";
\t\t\tdevelopmentRegion = tr;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (en, tr, Base);
\t\t\tmainGroup = {main_group};
\t\t\tpackageReferences = ({pkg_core} /* SOSMeshCore */, {pkg_contracts} /* contracts-swift */);
\t\t\tproductRefGroup = {products_group} /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = ({app_target} /* SOSMesh-iOS */, {test_target} /* SOSMeshTests */, {watch_target} /* SOSMesh-Watch */, {watch_widget_target} /* SOSMeshWatchWidgets */);
\t\t}};
"""
    ).strip()
)

dep_uid = uid(3101)
lines.append(f"\t\t{dep_uid} /* PBXTargetDependency */ = {{isa = PBXTargetDependency; target = {app_target} /* SOSMesh-iOS */; targetProxy = {uid(3102)} /* PBXContainerItemProxy */; }};")
lines.append(
    f"\t\t{uid(3102)} /* PBXContainerItemProxy */ = {{isa = PBXContainerItemProxy; containerPortal = {proj_uid} /* Project */; proxyType = 1; remoteGlobalIDString = {app_target}; remoteInfo = \"SOSMesh-iOS\"; }};"
)

# Configurations
def build_settings(
    target_name: str,
    bundle_id: str,
    info_plist: str | None = None,
    test: bool = False,
    release: bool = False,
) -> str:
    settings = [
        "SDKROOT = iphoneos;",
        "SWIFT_VERSION = 5.0;",
        "IPHONEOS_DEPLOYMENT_TARGET = 17.0;",
        "TARGETED_DEVICE_FAMILY = 1;",
        "SUPPORTED_PLATFORMS = \"iphoneos iphonesimulator\";",
        "SUPPORTS_MACCATALYST = NO;",
        '"EXCLUDED_ARCHS[sdk=iphonesimulator*]" = x86_64;',
        "ONLY_ACTIVE_ARCH = YES;",
        "PRODUCT_NAME = " + ("SOSMeshTests" if test else "SOSMesh") + ";",
        "PRODUCT_BUNDLE_IDENTIFIER = " + bundle_id + ";",
        "CODE_SIGNING_ALLOWED = NO;",
        "CODE_SIGNING_REQUIRED = NO;",
        "MARKETING_VERSION = 1.0.0;",
        "CURRENT_PROJECT_VERSION = 1;",
    ]
    if test:
        settings.append("GENERATE_INFOPLIST_FILE = YES;")
        settings.append("BUNDLE_LOADER = \"$(TEST_HOST)\";")
        settings.append(
            "TEST_HOST = \"$(BUILT_PRODUCTS_DIR)/SOSMesh.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/SOSMesh\";"
        )
    else:
        settings.append(f"INFOPLIST_FILE = {info_plist};")
        settings.append("CODE_SIGN_ENTITLEMENTS = SOSMesh/SOSMesh.entitlements;")
        settings.append("ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
        settings.append("LD_RUNPATH_SEARCH_PATHS = \"$(inherited) @executable_path/Frameworks\";")
    if release and not test:
        settings.append("SWIFT_OPTIMIZATION_LEVEL = -O;")
        settings.append("DEBUG_INFORMATION_FORMAT = dwarf-with-dsym;")
        settings.append("ENABLE_NS_ASSERTIONS = NO;")
    return "\n\t\t\t\t" + "\n\t\t\t\t".join(settings)


def watch_build_settings(bundle_id: str, info_plist: str, product_name: str, extension: bool = False) -> str:
    settings = [
        "SDKROOT = watchos;",
        "SWIFT_VERSION = 5.0;",
        "WATCHOS_DEPLOYMENT_TARGET = 10.0;",
        "TARGETED_DEVICE_FAMILY = 4;",
        'SUPPORTED_PLATFORMS = "watchos watchsimulator";',
        "ONLY_ACTIVE_ARCH = YES;",
        f"PRODUCT_NAME = {product_name};",
        "PRODUCT_BUNDLE_IDENTIFIER = " + bundle_id + ";",
        "CODE_SIGNING_ALLOWED = NO;",
        "CODE_SIGNING_REQUIRED = NO;",
        f"INFOPLIST_FILE = {info_plist};",
        "LD_RUNPATH_SEARCH_PATHS = \"$(inherited) @executable_path/Frameworks\";",
    ]
    if extension:
        settings.append("SKIP_INSTALL = YES;")
        settings.append("APPLICATION_EXTENSION_API_ONLY = YES;")
    return "\n\t\t\t\t" + "\n\t\t\t\t".join(settings)


def config_list(list_id, name, target_debug, target_release):
    lines.append(f"\t\t{list_id} /* Build configuration list for {name} */ = {{")
    lines.append("\t\t\tisa = XCConfigurationList;")
    lines.append("\t\t\tbuildConfigurations = (")
    lines.append(f"\t\t\t\t{target_debug} /* Debug */,")
    lines.append(f"\t\t\t\t{target_release} /* Release */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    lines.append("\t\t\tdefaultConfigurationName = Release;")
    lines.append("\t\t};")


proj_debug = uid(4200)
proj_release = uid(4201)
for cfg_id, cfg_name in [(proj_debug, "Debug"), (proj_release, "Release")]:
    lines.append(
        f"\t\t{cfg_id} /* {cfg_name} */ = {{isa = XCBuildConfiguration; buildSettings = {{"
        f"\n\t\t\t\tSDKROOT = iphoneos;"
        f"\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;"
        f"\n\t\t\t\tSUPPORTED_PLATFORMS = \"iphoneos iphonesimulator\";"
        f"\n\t\t\t\tSUPPORTS_MACCATALYST = NO;"
        f"\n\t\t\t\t\"EXCLUDED_ARCHS[sdk=iphonesimulator*]\" = x86_64;"
        f"\n\t\t\t\tONLY_ACTIVE_ARCH = YES;"
        f"\n\t\t\t}}; name = {cfg_name}; }};"
    )
config_list(uid(4000), 'PBXProject "SOSMesh"', proj_debug, proj_release)

app_debug = uid(4210)
app_release = uid(4211)
for cfg_id, cfg_name, rel in [(app_debug, "Debug", False), (app_release, "Release", True)]:
    lines.append(
        f"\t\t{cfg_id} /* {cfg_name} */ = {{isa = XCBuildConfiguration; buildSettings = {{{build_settings('SOSMesh-iOS', 'com.sosmesh.ios', 'SOSMesh/Info.plist', release=rel)}\n\t\t\t}}; name = {cfg_name}; }};"
    )
config_list(uid(4001), 'PBXNativeTarget "SOSMesh-iOS"', app_debug, app_release)

test_debug = uid(4220)
test_release = uid(4221)
for cfg_id, cfg_name in [(test_debug, "Debug"), (test_release, "Release")]:
    lines.append(
        f"\t\t{cfg_id} /* {cfg_name} */ = {{isa = XCBuildConfiguration; buildSettings = {{{build_settings('SOSMeshTests', 'com.sosmesh.ios.tests', test=True)}\n\t\t\t}}; name = {cfg_name}; }};"
    )
config_list(uid(4002), 'PBXNativeTarget "SOSMeshTests"', test_debug, test_release)

watch_debug = uid37(4210)
watch_release = uid37(4211)
for cfg_id, cfg_name in [(watch_debug, "Debug"), (watch_release, "Release")]:
    lines.append(
        f"\t\t{cfg_id} /* {cfg_name} */ = {{isa = XCBuildConfiguration; buildSettings = {{{watch_build_settings('com.sosmesh.ios.watch', '../watchos/SOSMeshWatch/Info.plist', 'SOSMeshWatch')}\n\t\t\t}}; name = {cfg_name}; }};"
    )
config_list(uid37(4001), 'PBXNativeTarget "SOSMesh-Watch"', watch_debug, watch_release)

watch_widget_debug = uid37(4220)
watch_widget_release = uid37(4221)
for cfg_id, cfg_name in [(watch_widget_debug, "Debug"), (watch_widget_release, "Release")]:
    lines.append(
        f"\t\t{cfg_id} /* {cfg_name} */ = {{isa = XCBuildConfiguration; buildSettings = {{{watch_build_settings('com.sosmesh.ios.watch.widgets', '../watchos/SOSMeshWatchWidgets/Info.plist', 'SOSMeshWatchWidgets', extension=True)}\n\t\t\t}}; name = {cfg_name}; }};"
    )
config_list(uid37(4002), 'PBXNativeTarget "SOSMeshWatchWidgets"', watch_widget_debug, watch_widget_release)

lines.append("\t};")
lines.append(f"\trootObject = {proj_uid} /* Project object */;")
lines.append("}")

PROJ.write_text("\n".join(lines) + "\n")
print(f"Wrote {PROJ}")
