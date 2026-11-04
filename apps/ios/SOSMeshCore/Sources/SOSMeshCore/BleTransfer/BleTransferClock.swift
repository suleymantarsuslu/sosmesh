import Foundation

public protocol BleTransferTimer: AnyObject {}

public protocol BleTransferClock: AnyObject {
    func schedule(afterMs: Int64, block: @escaping () -> Void) -> BleTransferTimer
    func cancel(_ timer: BleTransferTimer?)
}

public protocol BleTransferRng: AnyObject {
    func nextUnit() -> Double
}

public final class SystemBleTransferClock: BleTransferClock {
    private final class DispatchTimerHandle: BleTransferTimer {
        let source: DispatchSourceTimer
        init(_ source: DispatchSourceTimer) { self.source = source }
    }

    private let queue: DispatchQueue

    /// Timers fire on `queue`. The live BLE radio passes its serial radio queue so protocol
    /// state is only ever touched from one queue.
    public init(queue: DispatchQueue = DispatchQueue.global(qos: .utility)) {
        self.queue = queue
    }

    public func schedule(afterMs: Int64, block: @escaping () -> Void) -> BleTransferTimer {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + .milliseconds(Int(afterMs)))
        timer.setEventHandler(handler: block)
        timer.resume()
        return DispatchTimerHandle(timer)
    }

    public func cancel(_ timer: BleTransferTimer?) {
        (timer as? DispatchTimerHandle)?.source.cancel()
    }
}

public final class SystemBleTransferRng: BleTransferRng {
    public init() {}
    public func nextUnit() -> Double { Double.random(in: 0 ..< 1) }
}

public final class SeededBleTransferRng: BleTransferRng {
    private var state: UInt64

    public init(seed: UInt64) {
        state = seed == 0 ? 0xDEADBEEF : seed
    }

    public func nextUnit() -> Double {
        state = state &* 6364136223846793005 &+ 1
        return Double(state >> 11) / Double(1 << 53)
    }
}

public final class SimulatedBleTransferClock: BleTransferClock {
    private struct Pending {
        let fireAt: Int64
        let handle: BleTransferTimer
        let block: () -> Void
    }

    private var nowMs: Int64 = 0
    private var pending: [Pending] = []

    public init() {}

    public var currentTimeMs: Int64 { nowMs }

    public func advance(_ deltaMs: Int64) {
        nowMs += deltaMs
        while true {
            guard let nextIndex = pending.enumerated().min(by: { $0.element.fireAt < $1.element.fireAt })?.offset else {
                break
            }
            let next = pending[nextIndex]
            if next.fireAt > nowMs { break }
            pending.remove(at: nextIndex)
            next.block()
        }
    }

    public func schedule(afterMs: Int64, block: @escaping () -> Void) -> BleTransferTimer {
        let handle = SimTimer()
        pending.append(Pending(fireAt: nowMs + afterMs, handle: handle, block: block))
        return handle
    }

    public func cancel(_ timer: BleTransferTimer?) {
        guard let timer else { return }
        pending.removeAll { $0.handle === timer }
    }

    private final class SimTimer: BleTransferTimer {}
}
