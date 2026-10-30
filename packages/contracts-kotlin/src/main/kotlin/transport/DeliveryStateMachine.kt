package com.sosmesh.contracts.transport

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class StateTransitionEdge(val from: String, val to: String)

@Serializable
data class StateTransitionsFixture(
    val version: Int,
    val progressOrder: List<String>,
    val terminalStates: List<String>,
    val validTransitions: List<StateTransitionEdge>,
    val uxTimelineKeys: Map<String, String>,
    val defaultRetentionMs: Long,
)

class InvalidStateTransitionException(from: String, to: String) :
    Exception("Invalid state transition: $from -> $to")

class DeliveryStateMachine(fixture: StateTransitionsFixture) {
    private val allowed: Set<String> =
        fixture.validTransitions.map { "${it.from}->${it.to}" }.toSet()
    private val terminal: Set<String> = fixture.terminalStates.toSet()

    constructor() : this(StateTransitionLoader.load())

    fun canTransition(
        from: String,
        to: String,
    ): Boolean = allowed.contains("$from->$to")

    fun transition(
        from: String,
        to: String,
    ): String {
        if (!canTransition(from, to)) {
            throw InvalidStateTransitionException(from, to)
        }
        return to
    }

    fun isTerminal(state: String): Boolean = terminal.contains(state)
}

object StateTransitionLoader {
    private val json = Json { ignoreUnknownKeys = true }

    fun load(): StateTransitionsFixture {
        val path = File("../fixtures/transport/state-transitions.json")
        val text = path.readText()
        return json.decodeFromString<StateTransitionsFixture>(text)
    }
}
