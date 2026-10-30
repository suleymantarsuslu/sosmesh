package com.sosmesh.android.core.permissions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.ParameterizedRobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(ParameterizedRobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class AndroidManifestPermissionConsistencyTest(
    private val sdkInt: Int,
) {
    @Test
    fun manifestUsesPermissions_matchMatrixUnionAtSdk() {
        val manifestFile = appManifestFile()
        val declared = parseManifestPermissions(manifestFile, sdkInt)
        val expected = BlePermissionMatrix.allDeclaredPermissions(sdkInt).permissions
        assertEquals(expected, declared)
    }

    @Test
    fun legacyBluetoothPermissions_haveMaxSdkVersion30InSourceManifest() {
        val xml = appManifestFile().readText()
        assertTrue(
            xml.contains("android.permission.BLUETOOTH") &&
                xml.contains("android:maxSdkVersion=\"30\""),
        )
        assertTrue(
            xml.contains("android.permission.BLUETOOTH_ADMIN") &&
                xml.contains("android:maxSdkVersion=\"30\""),
        )
    }

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "manifest-consistency sdk={0}")
        fun sdks(): Collection<Array<Any>> =
            listOf(
                arrayOf(26),
                arrayOf(30),
                arrayOf(31),
                arrayOf(33),
                arrayOf(34),
                arrayOf(35),
                arrayOf(36),
            )

        private fun appManifestFile(): File {
            val manifestPath =
                System.getProperty("sosmesh.android.manifest")
                    ?: error("sosmesh.android.manifest system property not set")
            val manifestFile = File(manifestPath)
            assertTrue("App manifest missing: $manifestPath", manifestFile.isFile)
            return manifestFile
        }

        private val usesPermissionBlock =
            Regex(
                """<uses-permission\b([^>]*)/>""",
                setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.MULTILINE),
            )

        private fun parseManifestPermissions(
            manifestFile: File,
            sdkInt: Int,
        ): Set<String> {
            val xml = manifestFile.readText()
            val permissions = linkedSetOf<String>()
            for (match in usesPermissionBlock.findAll(xml)) {
                val attrs = match.groupValues[1]
                val name =
                    Regex("""android:name="([^"]+)"""")
                        .find(attrs)
                        ?.groupValues
                        ?.get(1)
                        ?: continue
                val maxSdk =
                    Regex("""android:maxSdkVersion="(\d+)"""")
                        .find(attrs)
                        ?.groupValues
                        ?.get(1)
                        ?.toIntOrNull()
                val minSdk =
                    Regex("""android:minSdkVersion="(\d+)"""")
                        .find(attrs)
                        ?.groupValues
                        ?.get(1)
                        ?.toIntOrNull()
                if (minSdk != null && sdkInt < minSdk) {
                    continue
                }
                if (maxSdk != null && sdkInt > maxSdk) {
                    continue
                }
                permissions += name
            }
            return permissions
        }
    }
}
