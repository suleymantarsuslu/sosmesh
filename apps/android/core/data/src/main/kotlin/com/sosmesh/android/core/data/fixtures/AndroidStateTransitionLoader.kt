package com.sosmesh.android.core.data.fixtures

import com.sosmesh.contracts.transport.StateTransitionsFixture
import kotlinx.serialization.json.Json
import java.io.InputStream

object AndroidStateTransitionLoader {
    private val json = Json { ignoreUnknownKeys = true }

    fun load(stream: InputStream): StateTransitionsFixture {
        val text = stream.bufferedReader().readText()
        return json.decodeFromString<StateTransitionsFixture>(text)
    }
}
