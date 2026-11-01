import Foundation

/// BLE V1 GATT profile constants (cross-platform with Android `BleMeshConstants`).
public enum BleMeshConstants {
    public static let serviceUUID = "0000FFF0-0000-1000-8000-00805F9B34FB"
    public static let controlCharacteristicUUID = "0000FFF1-0000-1000-8000-00805F9B34FB"
    public static let dataCharacteristicUUID = "0000FFF2-0000-1000-8000-00805F9B34FB"
    public static let ackCharacteristicUUID = "0000FFF3-0000-1000-8000-00805F9B34FB"
    public static let protocolVersion: UInt8 = BleProtocol.protocolVersion
    public static let manufacturerCompanyId: UInt16 = 0xFFFF
    public static let centralRestorationIdentifier = "com.sosmesh.ble.central"
    public static let peripheralRestorationIdentifier = "com.sosmesh.ble.peripheral"
}
