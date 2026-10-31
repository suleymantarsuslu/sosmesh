package com.sosmesh.android.feature.relay.system

import android.content.Context
import android.os.Build
import android.os.PowerManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class RelaySystemConstraintsCopy(
    val summary: String,
    val detail: String,
)

@Singleton
class RelaySystemConstraints
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        fun describe(isEnglish: Boolean): RelaySystemConstraintsCopy {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val ignoringBatteryOpts =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    pm.isIgnoringBatteryOptimizations(context.packageName)
                } else {
                    true
                }
            if (isEnglish) {
                val summary =
                    if (ignoringBatteryOpts) {
                        "Android may still pause relay in Doze or after force-stop."
                    } else {
                        "Battery optimization is on; relay may stop in the background."
                    }
                val detail =
                    buildString {
                        append(
                            "Doze and App Standby can delay BLE scans and uploads even with a foreground notification. ",
                        )
                        append(
                            "Some OEMs (Samsung, Xiaomi, Huawei, etc.) apply extra battery limits that can kill background work. ",
                        )
                        if (!ignoringBatteryOpts) {
                            append(
                                "Exempting SOSMesh from battery optimization may help but is not a guarantee. ",
                            )
                        }
                        append("Screen-off, reboot, and force-stop tests are required on a physical device.")
                    }
                return RelaySystemConstraintsCopy(summary, detail)
            }
            val summary =
                if (ignoringBatteryOpts) {
                    "Doze veya zorla kapatma sonrası Android röleyi yine durdurabilir."
                } else {
                    "Pil optimizasyonu açık; arka planda röle durabilir."
                }
            val detail =
                buildString {
                    append(
                        "Doze ve Uygulama Bekleme modu, ön plan bildirimi olsa bile BLE taramasını ve yüklemeyi geciktirebilir. ",
                    )
                    append(
                        "Bazı üreticiler (Samsung, Xiaomi, Huawei vb.) ek pil kısıtları uygular ve arka plan işini sonlandırabilir. ",
                    )
                    if (!ignoringBatteryOpts) {
                        append(
                            "SOSMesh için pil optimizasyonundan muafiyet yardımcı olabilir ancak garanti değildir. ",
                        )
                    }
                    append("Ekran kapalı, yeniden başlatma ve arka plan sonlandırma testleri gerçek cihazda gerekir.")
                }
            return RelaySystemConstraintsCopy(summary, detail)
        }
    }
