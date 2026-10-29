import Foundation

#if canImport(CryptoKit)
import CryptoKit
#else
import Crypto
#endif

public struct BleProtocol {
    public static let protocolVersion: UInt8 = 0x01
    public static let chunkHeaderSize = 12
    
    public struct ChunkHeader {
        public let seq: UInt16
        public let total: UInt16
        public let crc32: UInt32
        public let flags: UInt8
        
        public init(seq: UInt16, total: UInt16, crc32: UInt32, flags: UInt8) {
            self.seq = seq
            self.total = total
            self.crc32 = crc32
            self.flags = flags
        }
    }
    
    public static func calculateCRC32(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFFFFFF
        
        for byte in data {
            let index = Int((crc ^ UInt32(byte)) & 0xFF)
            crc = (crc >> 8) ^ crc32Table[index]
        }
        
        return crc ^ 0xFFFFFFFF
    }
    
    public static func calculateSHA256(_ data: Data) -> Data {
        #if canImport(CryptoKit)
        let hash = CryptoKit.SHA256.hash(data: data)
        #else
        let hash = Crypto.SHA256.hash(data: data)
        #endif
        return Data(hash)
    }
    
    public static func serializeChunkHeader(_ header: ChunkHeader) -> Data {
        var data = Data(count: chunkHeaderSize)
        
        // Big-endian encoding
        data[0] = UInt8((header.seq >> 8) & 0xFF)
        data[1] = UInt8(header.seq & 0xFF)
        data[2] = UInt8((header.total >> 8) & 0xFF)
        data[3] = UInt8(header.total & 0xFF)
        data[4] = UInt8((header.crc32 >> 24) & 0xFF)
        data[5] = UInt8((header.crc32 >> 16) & 0xFF)
        data[6] = UInt8((header.crc32 >> 8) & 0xFF)
        data[7] = UInt8(header.crc32 & 0xFF)
        data[8] = header.flags
        // bytes 9-11: reserved (0x00)
        data[9] = 0
        data[10] = 0
        data[11] = 0
        
        return data
    }
    
    public static func deserializeChunkHeader(_ data: Data) throws -> ChunkHeader {
        guard data.count >= chunkHeaderSize else {
            throw BleError.dataTooSmall
        }
        
        let seq = UInt16(data[0]) << 8 | UInt16(data[1])
        let total = UInt16(data[2]) << 8 | UInt16(data[3])
        let crc32 = UInt32(data[4]) << 24 | UInt32(data[5]) << 16 | 
                    UInt32(data[6]) << 8 | UInt32(data[7])
        let flags = data[8]
        
        return ChunkHeader(seq: seq, total: total, crc32: crc32, flags: flags)
    }
    
    public static func verifyChunkCRC(header: ChunkHeader, payload: Data) -> Bool {
        let actualCRC = calculateCRC32(payload)
        return actualCRC == header.crc32
    }
    
    public enum BleError: Error {
        case dataTooSmall
        case crcMismatch
    }
    
    // CRC32 lookup table (IEEE 802.3)
    private static let crc32Table: [UInt32] = {
        (0..<256).map { i -> UInt32 in
            var crc = UInt32(i)
            for _ in 0..<8 {
                if crc & 1 != 0 {
                    crc = (crc >> 1) ^ 0xEDB88320
                } else {
                    crc >>= 1
                }
            }
            return crc
        }
    }()
}
