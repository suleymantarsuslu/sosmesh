package com.sosmesh.android.feature.relay.upload

import com.sosmesh.android.core.data.outbox.RelayOutboxReader
import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshot
import com.sosmesh.android.feature.relay.battery.RelayPauseReason
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import com.sosmesh.android.feature.relay.settings.RelaySettingsPort
import com.sosmesh.android.feature.relay.uplink.RelayIngestResult
import com.sosmesh.android.feature.relay.uplink.RelayIngestUplink
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min

data class RelayUploadRunSummary(
    val attempted: Int,
    val uploaded: Int,
    val deferredReason: RelayPauseReason?,
    val scheduledRetryMs: Long?,
    val dueCount: Int = 0,
)

@Singleton
class RelayUploadExecutor
    @Inject
    constructor(
        private val settings: RelaySettingsPort,
        private val batteryPolicy: RelayBatteryPolicy,
        private val hourlyBudget: RelayHourlyDataBudget,
        private val outboxReader: RelayOutboxReader,
        private val outbox: OutboxQueueAdapter,
        private val uplink: RelayIngestUplink,
    ) {
        fun runUploadCycle(
            nowMs: Long,
            networkConnected: Boolean,
            battery: RelayBatterySnapshot,
        ): RelayUploadRunSummary {
            if (!settings.isRelayEnabled()) {
                return RelayUploadRunSummary(0, 0, RelayPauseReason.UserDisabled, null, 0)
            }
            val due = outboxReader.listDueRelayUpload(nowMs)
            if (due.isEmpty()) {
                return RelayUploadRunSummary(0, 0, null, null, 0)
            }
            val firstPayloadBytes = due.first().encryptedBlobBase64.length
            val eval =
                batteryPolicy.evaluate(
                    battery,
                    relayEnabled = true,
                    nowMs = nowMs,
                    nextUploadPayloadBytes = firstPayloadBytes,
                )
            if (!eval.mayRunRelay) {
                return RelayUploadRunSummary(0, 0, eval.pauseReason, null)
            }
            if (eval.pauseReason == RelayPauseReason.HourlyDataLimit) {
                val retryAt = nowMs + HOURLY_LIMIT_BACKOFF_MS
                due.forEach { entry ->
                    outbox.setRetryAt(entry.sosId, entry.digest, retryAt, "hourly_data_limit")
                }
                return RelayUploadRunSummary(0, 0, RelayPauseReason.HourlyDataLimit, retryAt)
            }
            if (!networkConnected) {
                val retryAt = nowMs + NO_NETWORK_BACKOFF_MS
                due.forEach { entry ->
                    outbox.setRetryAt(entry.sosId, entry.digest, retryAt, "no_network")
                }
                return RelayUploadRunSummary(0, 0, null, retryAt)
            }
            var uploaded = 0
            var attempted = 0
            var retryMs: Long? = null
            var deferred: RelayPauseReason? = null
            for (entry in due) {
                val payloadBytes = entry.encryptedBlobBase64.length
                if (!hourlyBudget.canSend(payloadBytes, settings.hourlyDataLimitBytes(), nowMs)) {
                    deferred = RelayPauseReason.HourlyDataLimit
                    retryMs = nowMs + HOURLY_LIMIT_BACKOFF_MS
                    outbox.setRetryAt(entry.sosId, entry.digest, retryMs, "hourly_data_limit")
                    break
                }
                attempted++
                when (
                    val result =
                        uplink.uploadOutboxEntry(
                            entry.sosId,
                            entry.digest,
                            entry.encryptedBlobBase64,
                        )
                ) {
                    is RelayIngestResult.Success -> {
                        outbox.updateState(
                            entry.sosId,
                            entry.digest,
                            "SERVER_ACCEPTED",
                            nowMs,
                            null,
                        )
                        hourlyBudget.recordSent(payloadBytes, nowMs)
                        uploaded++
                    }
                    is RelayIngestResult.InvalidReceipt -> {
                        retryMs = nowMs + HTTP_ERROR_BACKOFF_MS
                        outbox.setRetryAt(entry.sosId, entry.digest, retryMs, "invalid_receipt")
                        break
                    }
                    is RelayIngestResult.MessageIdConflict -> {
                        outbox.setRetryAt(
                            entry.sosId,
                            entry.digest,
                            NEEDS_REVIEW_RETRY_AT_MS,
                            "needs_review",
                        )
                        break
                    }
                    is RelayIngestResult.NoNetwork -> {
                        retryMs = nowMs + NO_NETWORK_BACKOFF_MS
                        outbox.setRetryAt(entry.sosId, entry.digest, retryMs, "no_network")
                        break
                    }
                    is RelayIngestResult.RateLimited -> {
                        retryMs = nowMs + min(result.retryAfterMs, RATE_LIMIT_MAX_BACKOFF_MS)
                        outbox.setRetryAt(entry.sosId, entry.digest, retryMs, "http_429")
                        break
                    }
                    is RelayIngestResult.HttpError -> {
                        retryMs = nowMs + HTTP_ERROR_BACKOFF_MS
                        outbox.setRetryAt(
                            entry.sosId,
                            entry.digest,
                            retryMs,
                            "http_${result.code}",
                        )
                        break
                    }
                }
            }
            return RelayUploadRunSummary(attempted, uploaded, deferred, retryMs, due.size)
        }

        companion object {
            const val NO_NETWORK_BACKOFF_MS = 60_000L
            const val HOURLY_LIMIT_BACKOFF_MS = 300_000L
            const val HTTP_ERROR_BACKOFF_MS = 120_000L
            const val RATE_LIMIT_MAX_BACKOFF_MS = 900_000L
            const val NEEDS_REVIEW_RETRY_AT_MS = 9_223_372_036_854_775L
        }
    }
