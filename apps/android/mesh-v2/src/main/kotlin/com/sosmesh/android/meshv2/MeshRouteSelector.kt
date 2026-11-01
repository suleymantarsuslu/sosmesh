package com.sosmesh.android.meshv2

data class MeshPeerCandidate(
    val peerId: String,
    val hasInternetCapability: Boolean,
    val batteryPercent: Int,
    val queuePressure: Int,
)

data class MeshRouteSelection(
    val peerId: String,
    val score: Int,
)

/**
 * Picks a forward target without exposing SOS plaintext — uses capability heuristics only.
 */
class MeshRouteSelector {
    fun selectBestPeer(candidates: List<MeshPeerCandidate>): MeshRouteSelection? {
        if (candidates.isEmpty()) {
            return null
        }
        val ranked =
            candidates
                .map { candidate ->
                    var score = 0
                    if (candidate.hasInternetCapability) {
                        score += 100
                    }
                    score += candidate.batteryPercent
                    score -= candidate.queuePressure * 5
                    candidate to score
                }.sortedByDescending { it.second }
        val best = ranked.first()
        return MeshRouteSelection(peerId = best.first.peerId, score = best.second)
    }
}
