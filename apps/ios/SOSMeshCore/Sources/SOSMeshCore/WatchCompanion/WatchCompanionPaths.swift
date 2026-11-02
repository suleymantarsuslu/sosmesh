import Foundation

public enum WatchCompanionPaths {
    public static let capabilityPhone = "sosmesh_phone_v1"
    public static let sosCreate = "/sosmesh/v1/sos/create"
    public static let phoneAck = "/sosmesh/v1/sos/phone_ack"
    public static let phoneStatus = "/sosmesh/v1/sos/phone_status"

    public enum MessageKey {
        public static let path = "path"
        public static let payloadBase64 = "payload_b64"
    }
}
