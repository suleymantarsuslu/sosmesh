import Foundation
import SOSMeshContracts

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

    /// Upper-case 128-bit form. CoreBluetooth may report Bluetooth-base UUIDs in their short
    /// 16-bit form ("FFF1"); every comparison goes through this so both spellings match.
    public static func canonicalUuid(_ uuid: String) -> String {
        let upper = uuid.uppercased()
        if upper.count == 4 {
            return "0000\(upper)-0000-1000-8000-00805F9B34FB"
        }
        return upper
    }
}
