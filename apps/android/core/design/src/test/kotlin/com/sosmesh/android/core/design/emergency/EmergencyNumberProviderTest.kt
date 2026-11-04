package com.sosmesh.android.core.design.emergency

import android.content.Context
import android.telephony.TelephonyManager
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.MockitoJUnitRunner
import java.util.Locale

@RunWith(MockitoJUnitRunner::class)
class EmergencyNumberProviderTest {

    @Mock
    private lateinit var mockContext: Context

    @Mock
    private lateinit var mockTelephonyManager: TelephonyManager

    @Before
    fun setup() {
        `when`(mockContext.getSystemService(Context.TELEPHONY_SERVICE)).thenReturn(mockTelephonyManager)
    }

    @Test
    fun `getEmergencyNumber returns 911 for US network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("us")
        assertEquals("911", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 911 for CA network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("ca")
        assertEquals("911", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 999 for GB network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("gb")
        assertEquals("999", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 000 for AU network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("au")
        assertEquals("000", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 111 for NZ network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("nz")
        assertEquals("111", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 110 for JP network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("jp")
        assertEquals("110", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 112 for TR network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("tr")
        assertEquals("112", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 112 for DE network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("de")
        assertEquals("112", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 112 for FR network`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("fr")
        assertEquals("112", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber falls back to SIM country when network country unavailable`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("")
        `when`(mockTelephonyManager.simCountryIso).thenReturn("us")
        assertEquals("911", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 112 for unknown country`() {
        `when`(mockTelephonyManager.networkCountryIso).thenReturn("")
        `when`(mockTelephonyManager.simCountryIso).thenReturn("")
        Locale.setDefault(Locale("en", "XX"))
        assertEquals("112", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }

    @Test
    fun `getEmergencyNumber returns 112 when TelephonyManager unavailable`() {
        `when`(mockContext.getSystemService(Context.TELEPHONY_SERVICE)).thenReturn(null)
        assertEquals("112", EmergencyNumberProvider.getEmergencyNumber(mockContext))
    }
}
