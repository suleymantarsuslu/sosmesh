package com.sosmesh.android.core.data.di

import android.content.Context
import androidx.room.Room
import com.sosmesh.android.core.data.fixtures.AndroidStateTransitionLoader
import com.sosmesh.android.core.data.outbox.OutboxDatabase
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.storage.KeystoreEncryptedStringStore
import com.sosmesh.android.core.data.storage.SecureStringStore
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataModule {
    @Provides
    @Singleton
    fun provideSosSenderContextSource(
        store: com.sosmesh.android.core.data.profile.SosProfileStore,
    ): com.sosmesh.android.core.data.profile.SosSenderContextSource = store

    @Provides
    @Singleton
    fun provideOutboxDatabase(
        @ApplicationContext context: Context,
    ): OutboxDatabase =
        Room.databaseBuilder(context, OutboxDatabase::class.java, "sosmesh-outbox")
            .addMigrations(OutboxDatabase.MIGRATION_1_2)
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    @OutboxDefaultRetention
    fun provideOutboxDefaultRetentionMs(
        @ApplicationContext context: Context,
    ): Long {
        val fixture =
            AndroidStateTransitionLoader.load(
                context.assets.open("transport/state-transitions.json"),
            )
        return fixture.defaultRetentionMs
    }

    @Provides
    @IoDispatcher
    fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

    @Provides
    fun provideOutboxDao(db: OutboxDatabase): com.sosmesh.android.core.data.outbox.OutboxDao = db.outboxDao()

    @Provides
    @Singleton
    fun provideSecureStringStore(store: KeystoreEncryptedStringStore): SecureStringStore = store
}

@Module
@InstallIn(SingletonComponent::class)
abstract class DataBindingModule {
    @Binds
    @Singleton
    abstract fun bindOutboxQueueAdapter(impl: RoomOutboxQueueAdapter): OutboxQueueAdapter
}
