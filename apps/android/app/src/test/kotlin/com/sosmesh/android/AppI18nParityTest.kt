package com.sosmesh.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.File
import java.util.Locale

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class AppI18nParityTest {
    @Test
    fun englishAndTurkishStringKeys_match() {
        val moduleRoot = File("src/main/res")
        val enKeys = readStringKeys(moduleRoot.resolve("values/strings.xml"))
        val trKeys = readStringKeys(moduleRoot.resolve("values-tr/strings.xml"))
        assertEquals(enKeys, trKeys)
    }

    @Test
    fun defaultResourceLocale_isEnglish() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        assertEquals("Send SOS", context.getString(R.string.home_sos_cta))
    }

    @Test
    fun turkishResources_loadWhenLocaleIsTr() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val config = context.resources.configuration
        config.setLocale(Locale("tr"))
        val trContext = context.createConfigurationContext(config)
        assertEquals("SOS gönder", trContext.getString(R.string.home_sos_cta))
    }

    private fun readStringKeys(file: File): Set<String> {
        val parser = XmlPullParserFactory.newInstance().newPullParser()
        parser.setInput(file.inputStream(), null)
        val keys = mutableSetOf<String>()
        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.START_TAG && parser.name == "string") {
                keys.add(parser.getAttributeValue(null, "name"))
            }
            event = parser.next()
        }
        return keys
    }
}
