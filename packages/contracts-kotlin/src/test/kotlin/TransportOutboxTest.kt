package com.sosmesh.contracts.transport

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.io.File
import java.nio.file.Files

class DeliveryStateMachineTest {
    private val machine = DeliveryStateMachine()

    @Test
    fun `fixture forward chain is accepted`() {
        val fixture = StateTransitionLoader.load()
        var state = fixture.progressOrder.first()
        for (next in fixture.progressOrder.drop(1)) {
            assertTrue(machine.canTransition(state, next))
            state = machine.transition(state, next)
        }
        assertEquals("CASE_IN_PROGRESS", state)
    }

    @Test
    fun `invalid transition PEER_RECEIVED to OPERATOR_SEEN rejected`() {
        assertFalse(machine.canTransition("PEER_RECEIVED", "OPERATOR_SEEN"))
        assertThrows(InvalidStateTransitionException::class.java) {
            machine.transition("PEER_RECEIVED", "OPERATOR_SEEN")
        }
    }

    @Test
    fun `PEER_RECEIVED does not imply SERVER_ACCEPTED`() {
        val peer = machine.transition("LOCAL_SAVED", "PEER_RECEIVED")
        assertEquals("PEER_RECEIVED", peer)
        assertNotEquals("SERVER_ACCEPTED", peer)
    }
}

class JdbcSqliteOutboxQueueTest {
    private var dbFile: File? = null
    private var openQueue: JdbcSqliteOutboxQueue? = null

    @AfterEach
    fun cleanup() {
        openQueue?.close()
        openQueue = null
        dbFile?.delete()
        dbFile = null
    }

    private fun newQueue(): JdbcSqliteOutboxQueue {
        dbFile = Files.createTempFile("sosmesh-outbox-", ".db").toFile()
        openQueue = JdbcSqliteOutboxQueue(dbFile!!.absolutePath)
        return openQueue!!
    }

    @Test
    fun `duplicate enqueue yields single row`() {
        val queue = newQueue()
        val input =
            EnqueueInput(
                sosId = "dup-kotlin",
                digest = "digest-1",
                origin = "jvm",
                encryptedBlobBase64 = "YQ==",
            )
        queue.enqueue(input, 100)
        queue.enqueue(input, 200)
        assertEquals(1, queue.listAll().size)
    }

    @Test
    fun `reopen database preserves queue after close`() {
        val path = Files.createTempFile("sosmesh-reboot-", ".db").toFile()
        dbFile = path
        val q1 = JdbcSqliteOutboxQueue(path.absolutePath)
        q1.enqueue(
            EnqueueInput("reboot-k", "d", "jvm", "YQ=="),
            1,
        )
        q1.close()
        openQueue = JdbcSqliteOutboxQueue(path.absolutePath)
        assertEquals(1, openQueue!!.listAll().size)
        assertEquals("LOCAL_SAVED", openQueue!!.listAll().first().state)
    }

    @Test
    fun `pause blocks due send count`() {
        val queue = newQueue()
        queue.enqueue(EnqueueInput("p", "d", "jvm", "YQ=="), 10)
        assertEquals(0, queue.countDueForSend(10, paused = true))
        assertEquals(1, queue.countDueForSend(10, paused = false))
    }

    @Test
    fun `purgeExpired removes row after retention`() {
        val queue = newQueue()
        queue.enqueue(
            EnqueueInput("exp", "d", "jvm", "YQ==", retentionMs = 500),
            0,
        )
        assertEquals(1, queue.purgeExpired(501))
        assertTrue(queue.listAll().isEmpty())
    }

    @Test
    fun `clock skew retry_at boundary due count matches shared backoff`() {
        val queue = newQueue()
        queue.enqueue(EnqueueInput("skew-k", "d", "jvm", "YQ=="), 1_000)
        val retryAt = OutboxRetryPolicy.nextRetryAt(1_000, 1)
        assertEquals(61_000L, retryAt)
        queue.setRetryAt("skew-k", "d", retryAt, "offline")
        assertEquals(0, queue.countDueForSend(60_999, paused = false))
        assertEquals(1, queue.countDueForSend(61_000, paused = false))
        val secondRetry = OutboxRetryPolicy.nextRetryAt(62_000, 2)
        assertEquals(182_000L, secondRetry)
        queue.setRetryAt("skew-k", "d", secondRetry, "still-offline")
        assertEquals(0, queue.countDueForSend(181_999, paused = false))
        assertEquals(1, queue.countDueForSend(182_000, paused = false))
    }
}
