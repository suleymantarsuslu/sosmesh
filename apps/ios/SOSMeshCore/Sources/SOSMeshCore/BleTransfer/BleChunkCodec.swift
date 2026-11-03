import Foundation
import SOSMeshContracts

public enum BleChunkCodec {
    public static func calculateCrc32(_ data: Data) -> UInt32 {
        BleProtocol.calculateCRC32(data)
    }

    public static func calculateDigest(_ data: Data) -> Data {
        BleProtocol.calculateSHA256(data)
    }

    public static func splitIntoChunks(_ data: Data, chunkSize: Int) -> [BleTransferChunk] {
        guard chunkSize > 0 else { return [] }
        let totalChunks = (data.count + chunkSize - 1) / chunkSize
        var chunks: [BleTransferChunk] = []
        for index in 0 ..< totalChunks {
            let start = index * chunkSize
            let end = min(start + chunkSize, data.count)
            let payload = data.subdata(in: start ..< end)
            var flags = 0
            if index == 0 { flags |= BleChunkFlags.firstChunk.rawValue }
            if index == totalChunks - 1 { flags |= BleChunkFlags.lastChunk.rawValue }
            chunks.append(
                BleTransferChunk(
                    header: BleTransferChunkHeader(
                        seq: index,
                        total: totalChunks,
                        crc32: calculateCrc32(payload),
                        flags: flags
                    ),
                    payload: payload
                )
            )
        }
        return chunks
    }

    public static func serializeChunk(_ chunk: BleTransferChunk) -> Data {
        var header = Data(count: BleTransferProtocolConstants.chunkHeaderSize)
        header[0] = UInt8((chunk.header.seq >> 8) & 0xff)
        header[1] = UInt8(chunk.header.seq & 0xff)
        header[2] = UInt8((chunk.header.total >> 8) & 0xff)
        header[3] = UInt8(chunk.header.total & 0xff)
        let crc = chunk.header.crc32
        header[4] = UInt8((crc >> 24) & 0xff)
        header[5] = UInt8((crc >> 16) & 0xff)
        header[6] = UInt8((crc >> 8) & 0xff)
        header[7] = UInt8(crc & 0xff)
        header[8] = UInt8(chunk.header.flags & 0xff)
        header[9] = UInt8((chunk.payload.count >> 8) & 0xff)
        header[10] = UInt8(chunk.payload.count & 0xff)
        header[11] = 0
        var wire = header
        wire.append(chunk.payload)
        return wire
    }

    public static func deserializeChunk(_ data: Data) -> BleTransferChunk? {
        let headerSize = BleTransferProtocolConstants.chunkHeaderSize
        guard data.count >= headerSize else { return nil }
        let seq = (Int(data[0]) << 8) | Int(data[1])
        let total = (Int(data[2]) << 8) | Int(data[3])
        let crc32 =
            (UInt32(data[4]) << 24)
            | (UInt32(data[5]) << 16)
            | (UInt32(data[6]) << 8)
            | UInt32(data[7])
        let flags = Int(data[8])
        let payloadLen = (Int(data[9]) << 8) | Int(data[10])
        guard data.count >= headerSize + payloadLen else { return nil }
        let payload = data.subdata(in: headerSize ..< (headerSize + payloadLen))
        return BleTransferChunk(
            header: BleTransferChunkHeader(seq: seq, total: total, crc32: crc32, flags: flags),
            payload: payload
        )
    }

    public static func assembleChunks(_ chunks: [BleTransferChunk]) -> Data {
        let sorted = chunks.sorted { $0.header.seq < $1.header.seq }
        var buffer = Data()
        for chunk in sorted {
            buffer.append(chunk.payload)
        }
        return buffer
    }

    public static func extractDigestFromLastChunk(_ lastChunk: BleTransferChunk) -> (digest: Data, data: Data)? {
        guard BleChunkFlags.lastChunk.has(flags: lastChunk.header.flags) else { return nil }
        guard lastChunk.payload.count >= 32 else { return nil }
        let digest = lastChunk.payload.suffix(32)
        let dataPart = lastChunk.payload.prefix(lastChunk.payload.count - 32)
        return (Data(digest), Data(dataPart))
    }

    public static func verifyDigest(_ assembled: Data, digest: Data) -> Bool {
        calculateDigest(assembled) == digest
    }

    public static func createLastChunkWithDigest(
        fullPayload: Data,
        chunkSize: Int,
        seq: Int,
        total: Int
    ) -> BleTransferChunk {
        let digest = calculateDigest(fullPayload)
        let dataStart = seq * chunkSize
        let dataEnd = min(dataStart + chunkSize - 32, fullPayload.count)
        let chunkData = fullPayload.subdata(in: dataStart ..< dataEnd)
        var payload = chunkData
        payload.append(digest)
        return BleTransferChunk(
            header: BleTransferChunkHeader(
                seq: seq,
                total: total,
                crc32: calculateCrc32(payload),
                flags: BleChunkFlags.lastChunk.rawValue
            ),
            payload: payload
        )
    }
}
