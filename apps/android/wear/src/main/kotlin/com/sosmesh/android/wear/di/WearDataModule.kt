package com.sosmesh.android.wear.di

import android.content.Context
import androidx.room.Room
import com.sosmesh.android.core.data.SosDatabase
import com.sosmesh.android.core.data.outbox.OutboxDao
import com.sosmesh.android.core.data.outbox.RoomOutboxQueueAdapter
import com.sosmesh.android.core.data.outbox.SosOutboxReader
import com.sosmesh.android.core.data.di.IoDispatcher
import com.sosmesh.contracts.transport.OutboxQueueAdapter
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineDispatcher
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object WearDataModule {
    @Provides
    @Singleton
    fun provideSosDatabase(
        @ApplicationContext context: Context,
    ): SosDatabase =
        Room.databaseBuilder(
            context,
            SosDatabase::class.java,
            "wear_sos_db",
        ).build()

    @Provides
    @Singleton
    fun provideOutboxDao(db: SosDatabase): OutboxDao = db.outboxDao()

    @Provides
    @Singleton
    fun provideOutboxQueueAdapter(
        dao: OutboxDao,
        @IoDispatcher ioDispatcher: CoroutineDispatcher,
    ): OutboxQueueAdapter =
        RoomOutboxQueueAdapter(
            dao = dao,
            defaultRetentionMs = 30L * 24 * 3600 * 1000,
            ioDispatcher = ioDispatcher,
        )

    @Provides
    @Singleton
    fun provideSosOutboxReader(
        dao: OutboxDao,
        @IoDispatcher ioDispatcher: CoroutineDispatcher,
    ): SosOutboxReader =
        SosOutboxReader(
            dao = dao,
            ioDispatcher = ioDispatcher,
        )
}
