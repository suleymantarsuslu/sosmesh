package com.sosmesh.android.core.permissions

enum class PermissionRequestOutcome {
    GRANTED,
    DENIED_CAN_RETRY,
    PERMANENTLY_DENIED,
}

interface PermissionStatusReader {
    fun isGranted(permission: String): Boolean

    fun shouldShowRationale(permission: String): Boolean
}

class PermissionFlowCoordinator(
    private val sdkInt: Int,
    private val statusReader: PermissionStatusReader,
) {
    private val matrix = BlePermissionMatrix.runtimePermissions(sdkInt).permissions

    fun missingPermissions(): List<String> = matrix.filterNot { statusReader.isGranted(it) }

    fun allGranted(): Boolean = missingPermissions().isEmpty()

    fun classifyOutcome(
        permission: String,
        grantResults: Map<String, Int>,
    ): PermissionRequestOutcome {
        val granted = grantResults[permission] == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (granted) {
            return PermissionRequestOutcome.GRANTED
        }
        return if (statusReader.shouldShowRationale(permission)) {
            PermissionRequestOutcome.DENIED_CAN_RETRY
        } else {
            PermissionRequestOutcome.PERMANENTLY_DENIED
        }
    }

    fun nextMissingPermission(): String? = missingPermissions().firstOrNull()
}
