package com.sosmesh.android.core.ble.di

import android.os.Build
import com.sosmesh.android.core.ble.BleAdvertiser
import com.sosmesh.android.core.ble.BleMeshRadio
import com.sosmesh.android.core.ble.BleMeshRadioImpl
import com.sosmesh.android.core.ble.BleRadioCoordinator
import com.sosmesh.android.core.ble.BleScanner
import com.sosmesh.android.core.ble.EphemeralIdGenerator
import com.sosmesh.android.core.ble.GattClientSession
import com.sosmesh.android.core.ble.GattServer
import com.sosmesh.android.core.ble.PeerRegistry
import com.sosmesh.android.core.ble.PeerRole
import com.sosmesh.android.core.ble.PermissionAndAdapterGuard
import com.sosmesh.android.core.ble.android.AndroidBleAdvertiserPort
import com.sosmesh.android.core.ble.android.AndroidBleScannerPort
import com.sosmesh.android.core.ble.android.AndroidBluetoothAdapterPort
import com.sosmesh.android.core.ble.android.AndroidGattClientPort
import com.sosmesh.android.core.ble.android.AndroidGattServerPort
import com.sosmesh.android.core.ble.android.AndroidLocationServicesPort
import com.sosmesh.android.core.ble.platform.BleAdvertiserPort
import com.sosmesh.android.core.ble.platform.BleScannerPort
import com.sosmesh.android.core.ble.platform.BluetoothAdapterPort
import com.sosmesh.android.core.ble.platform.GattClientPort
import com.sosmesh.android.core.ble.platform.GattServerPort
import com.sosmesh.android.core.ble.platform.LocationServicesPort
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BleModule {
    @Provides
    @Singleton
    fun providePeerRegistry(): PeerRegistry = PeerRegistry()

    @Provides
    @Singleton
    fun provideEphemeralIdGenerator(): EphemeralIdGenerator = EphemeralIdGenerator()

    @Provides
    @Singleton
    fun providePermissionAndAdapterGuard(
        permissionFlowCoordinator: PermissionFlowCoordinator,
        bluetoothAdapter: BluetoothAdapterPort,
        locationServices: LocationServicesPort,
    ): PermissionAndAdapterGuard =
        PermissionAndAdapterGuard(
            sdkInt = Build.VERSION.SDK_INT,
            permissionFlowCoordinator = permissionFlowCoordinator,
            bluetoothAdapter = bluetoothAdapter,
            locationServices = locationServices,
        )

    @Provides
    @Singleton
    fun provideBleScanner(
        scannerPort: BleScannerPort,
        guard: PermissionAndAdapterGuard,
        peerRegistry: PeerRegistry,
    ): BleScanner {
        return BleScanner(scannerPort, guard) { payload ->
            peerRegistry.recordDiscovery(payload, PeerRole.BOTH)
        }
    }

    @Provides
    @Singleton
    fun provideBleRadioCoordinator(
        guard: PermissionAndAdapterGuard,
        scanner: BleScanner,
        advertiser: BleAdvertiser,
        gattServer: GattServer,
        gattSession: GattClientSession,
        peerRegistry: PeerRegistry,
        permissionFlowCoordinator: PermissionFlowCoordinator,
        bluetoothAdapter: BluetoothAdapterPort,
        locationServices: LocationServicesPort,
    ): BleRadioCoordinator =
        BleRadioCoordinator(
            guard = guard,
            scanner = scanner,
            advertiser = advertiser,
            gattServer = gattServer,
            gattSession = gattSession,
            peerRegistry = peerRegistry,
            permissionFlowCoordinator = permissionFlowCoordinator,
            bluetoothAdapter = bluetoothAdapter,
            locationServices = locationServices,
        )

    @Provides
    @Singleton
    fun provideBleAdvertiser(
        advertiserPort: BleAdvertiserPort,
        guard: PermissionAndAdapterGuard,
        ephemeralIdGenerator: EphemeralIdGenerator,
    ): BleAdvertiser = BleAdvertiser(advertiserPort, guard, ephemeralIdGenerator)

    @Provides
    @Singleton
    fun provideGattServer(serverPort: GattServerPort): GattServer = GattServer(serverPort)

    @Provides
    @Singleton
    fun provideGattClientSession(
        clientPort: GattClientPort,
        peerRegistry: PeerRegistry,
    ): GattClientSession = GattClientSession(clientPort, peerRegistry)

    @Provides
    @Singleton
    fun provideBleMeshRadio(impl: BleMeshRadioImpl): BleMeshRadio = impl

    @Provides
    @Singleton
    fun provideBluetoothAdapterPort(port: AndroidBluetoothAdapterPort): BluetoothAdapterPort = port

    @Provides
    @Singleton
    fun provideLocationServicesPort(port: AndroidLocationServicesPort): LocationServicesPort = port

    @Provides
    @Singleton
    fun provideBleScannerPort(port: AndroidBleScannerPort): BleScannerPort = port

    @Provides
    @Singleton
    fun provideBleAdvertiserPort(port: AndroidBleAdvertiserPort): BleAdvertiserPort = port

    @Provides
    @Singleton
    fun provideGattServerPort(port: AndroidGattServerPort): GattServerPort = port

    @Provides
    @Singleton
    fun provideGattClientPort(port: AndroidGattClientPort): GattClientPort = port
}
