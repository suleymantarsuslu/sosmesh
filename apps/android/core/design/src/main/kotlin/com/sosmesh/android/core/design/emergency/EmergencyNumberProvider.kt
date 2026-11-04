package com.sosmesh.android.core.design.emergency

import android.content.Context
import android.telephony.TelephonyManager
import java.util.Locale

object EmergencyNumberProvider {
    private val emergencyNumberMap = mapOf(
        "US" to "911",
        "CA" to "911",
        "MX" to "911",
        "GB" to "999",
        "AU" to "000",
        "NZ" to "111",
        "JP" to "110",
        "CN" to "110",
        "IN" to "112",
        "BR" to "190",
        "AR" to "911",
        "CL" to "133",
        "CO" to "123",
        "PE" to "105",
        "MY" to "999",
        "SG" to "999",
        "TH" to "191",
        "VN" to "113",
        "PH" to "911",
        "ID" to "112",
        "ZA" to "10111",
        "EG" to "122",
        "IL" to "100",
        "SA" to "999",
        "AE" to "999",
        "RU" to "112",
        "UA" to "112",
        "KR" to "112",
        "TR" to "112",
        "AT" to "112",
        "BE" to "112",
        "BG" to "112",
        "HR" to "112",
        "CY" to "112",
        "CZ" to "112",
        "DK" to "112",
        "EE" to "112",
        "FI" to "112",
        "FR" to "112",
        "DE" to "112",
        "GR" to "112",
        "HU" to "112",
        "IE" to "112",
        "IT" to "112",
        "LV" to "112",
        "LT" to "112",
        "LU" to "112",
        "MT" to "112",
        "NL" to "112",
        "PL" to "112",
        "PT" to "112",
        "RO" to "112",
        "SK" to "112",
        "SI" to "112",
        "ES" to "112",
        "SE" to "112",
        "NO" to "112",
        "IS" to "112",
        "LI" to "112",
        "CH" to "112",
        "AL" to "112",
        "BA" to "112",
        "ME" to "112",
        "MK" to "112",
        "RS" to "112",
        "XK" to "112",
    )

    fun getEmergencyNumber(context: Context): String {
        val countryCode = detectCountryCode(context)
        return emergencyNumberMap[countryCode] ?: "112"
    }

    private fun detectCountryCode(context: Context): String? {
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        telephonyManager?.let {
            it.networkCountryIso?.uppercase(Locale.ROOT)?.takeIf { code -> code.isNotBlank() }?.let { return it }
            it.simCountryIso?.uppercase(Locale.ROOT)?.takeIf { code -> code.isNotBlank() }?.let { return it }
        }
        Locale.getDefault().country.uppercase(Locale.ROOT).takeIf { it.isNotBlank() }?.let { return it }
        return null
    }
}
