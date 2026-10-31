package com.sosmesh.android.core.protocol

interface BleTransferClock {
    fun nowMs(): Long

    fun schedule(
        delayMs: Long,
        block: () -> Unit,
    ): BleTransferTimer

    fun cancel(timer: BleTransferTimer?)
}

interface BleTransferTimer

interface BleTransferRng {
    fun nextUnit(): Double
}

class SystemBleTransferClock : BleTransferClock {
    override fun nowMs(): Long = System.currentTimeMillis()

    override fun schedule(
        delayMs: Long,
        block: () -> Unit,
    ): BleTransferTimer {
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        val runnable = Runnable { block() }
        handler.postDelayed(runnable, delayMs)
        return object : BleTransferTimer {}
    }

    override fun cancel(timer: BleTransferTimer?) {
        // Handler-based timers are fire-and-forget for production; tests use SimulatedBleTransferClock.
    }
}

class SimulatedBleTransferClock : BleTransferClock {
    private var currentMs: Long = 0L

    private data class Pending(val fireAt: Long, val block: () -> Unit)

    private val timers = mutableListOf<Pending>()

    fun now(): Long = currentMs

    fun advance(ms: Long) {
        val target = currentMs + ms
        while (true) {
            val next = timers.filter { it.fireAt <= target }.minByOrNull { it.fireAt } ?: break
            currentMs = next.fireAt
            timers.remove(next)
            next.block()
        }
        currentMs = target
    }

    fun hasPendingTimers(): Boolean = timers.any { it.fireAt > currentMs }

    override fun nowMs(): Long = currentMs

    override fun schedule(
        delayMs: Long,
        block: () -> Unit,
    ): BleTransferTimer {
        timers.add(Pending(currentMs + delayMs, block))
        return object : BleTransferTimer {}
    }

    override fun cancel(timer: BleTransferTimer?) {
        // Simulated tests recreate senders; no-op cancel is sufficient for JVM tests.
    }
}

class SeededBleTransferRng(
    seed: Int,
) : BleTransferRng {
    private var state = seed.toLong() and 0xffffffffL

    override fun nextUnit(): Double {
        val a = 1664525L
        val c = 1013904223L
        val m = 1L shl 32
        state = (a * state + c) % m
        return state.toDouble() / m.toDouble()
    }
}

class SystemBleTransferRng : BleTransferRng {
    override fun nextUnit(): Double = kotlin.random.Random.nextDouble()
}
