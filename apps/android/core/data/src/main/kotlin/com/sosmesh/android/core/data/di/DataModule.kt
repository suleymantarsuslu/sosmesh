package com.sosmesh.android.core.data.di

import android.content.Context
import androidx.room.Room
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.storage.KeystoreEncryptedStringStore
import com.sosmesh.android.core.data.storage.SecureStringStore
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataModule {
    @Provides
    @Singleton
    fun provideOutboxDatabase(
        @ApplicationContext context: Context,
    ): OutboxDatabase =
        Room.databaseBuilder(context, OutboxDatabase::class.java, "sosmesh-outbox")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    fun provideOutboxQueueAdapter(
        db: OutboxDatabase,
        @ApplicationContext context: Context,
    ): OutboxQueueAdapter {
        val fixture =
            AndroidStateTransitionLoader.load(
                context.assets.open("transport/state-transitions.json"),
            )
        return RoomOutboxQueueAdapter(db.outboxDao(), fixture.defaultRetentionMs)
    }

    @Provides
    fun provideOutboxDao(db: OutboxDatabase): com.sosmesh.android.core.data.outbox.OutboxDao = db.outboxDao()

    @Provides
    @Singleton
    fun provideSecureStringStore(store: KeystoreEncryptedStringStore): SecureStringStore = store
}
