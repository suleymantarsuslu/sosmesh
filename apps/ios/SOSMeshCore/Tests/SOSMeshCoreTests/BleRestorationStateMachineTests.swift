import XCTest
@testable import SOSMeshCore

final class BleRestorationStateMachineTests: XCTestCase {
    func testForegroundScanConnectBackgroundCycle() throws {
        var machine = BleRestorationStateMachine()
        try machine.apply(.appLaunched)
        try machine.apply(.bluetoothPoweredOn)
        XCTAssertTrue(machine.canResumeBleWork)
        try machine.apply(.beginScan)
        try machine.apply(.peerConnected)
        try machine.apply(.didEnterBackground)
        XCTAssertFalse(machine.canResumeBleWork)
        XCTAssertEqual(machine.userFacingLimitationKey, "ios.limitation.background")
        try machine.apply(.willEnterForeground)
        XCTAssertTrue(machine.canResumeBleWork)
    }

    func testForceQuitIsTerminal() throws {
        var machine = BleRestorationStateMachine()
        try machine.apply(.appLaunched)
        try machine.apply(.userForceQuit)
        XCTAssertEqual(machine.phase, .forceQuitTerminal)
        XCTAssertEqual(machine.userFacingLimitationKey, "ios.limitation.force_quit")
        XCTAssertFalse(machine.canResumeBleWork)
    }

    func testForceQuitTerminalAbsorbsFurtherEvents() throws {
        var machine = BleRestorationStateMachine(phase: .scanning)
        try machine.apply(.userForceQuit)
        XCTAssertEqual(machine.phase, .forceQuitTerminal)
        try machine.apply(.bluetoothPoweredOn)
        XCTAssertEqual(machine.phase, .forceQuitTerminal)
        XCTAssertFalse(machine.canResumeBleWork)
    }

    func testSystemRestorationPath() throws {
        var machine = BleRestorationStateMachine(phase: .backgroundSuspended)
        try machine.apply(.systemWillRestoreState)
        XCTAssertEqual(machine.phase, .restoringFromSystem)
        try machine.apply(.restorationCompleted)
        XCTAssertEqual(machine.phase, .readyForeground)
    }
}
