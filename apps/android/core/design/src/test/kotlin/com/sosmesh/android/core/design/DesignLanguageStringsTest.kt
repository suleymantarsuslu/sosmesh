package com.sosmesh.android.core.design

import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class DesignLanguageStringsTest {
    @Test
    fun systemDefaultLabel_existsInEnglishAndTurkish() {
        val en = readStringValue(File("src/main/res/values/strings.xml"), "design_language_system")
        val tr = readStringValue(File("src/main/res/values-tr/strings.xml"), "design_language_system")
        assertTrue(en.contains("System", ignoreCase = true))
        assertTrue(tr.contains("Sistem", ignoreCase = true))
    }

    private fun readStringValue(file: File, name: String): String {
        val parser = XmlPullParserFactory.newInstance().newPullParser()
        parser.setInput(file.inputStream(), null)
        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.START_TAG && parser.name == "string") {
                if (parser.getAttributeValue(null, "name") == name) {
                    return parser.nextText()
                }
            }
            event = parser.next()
        }
        return ""
    }
}
