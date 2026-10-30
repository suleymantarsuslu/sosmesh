package com.sosmesh.android.core.data.storage

interface SecureStringStore {
    fun put(
        key: String,
        value: String,
    )

    fun get(key: String): String?
}
