package com.sosmesh.android.locale

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class AppLocaleControllerTest {
    private lateinit var context: Context

    @Before
    fun clearPrefs() {
        context = ApplicationProvider.getApplicationContext()
        context
            .getSharedPreferences(AppLocaleController.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
    }

    @Test
    fun defaultPreference_isSystemWithoutStoredOverride() {
        assertEquals(AppLocaleController.TAG_SYSTEM, AppLocaleController.readStoredTag(context))
        assertNull(
            context
                .getSharedPreferences(AppLocaleController.PREFS_NAME, Context.MODE_PRIVATE)
                .getString("language_tag", null),
        )
    }

    @Test
    fun choosingSystem_clearsStoredOverride() {
        AppLocaleController.setApplicationLanguage(context, AppLocaleController.TAG_ENGLISH)
        assertEquals(AppLocaleController.TAG_ENGLISH, AppLocaleController.readStoredTag(context))

        AppLocaleController.setApplicationLanguage(context, AppLocaleController.TAG_SYSTEM)
        assertEquals(AppLocaleController.TAG_SYSTEM, AppLocaleController.readStoredTag(context))
        assertFalse(
            context
                .getSharedPreferences(AppLocaleController.PREFS_NAME, Context.MODE_PRIVATE)
                .contains("language_tag"),
        )
    }

    @Test
    fun applyStoredLocale_doesNotForceEnglishWhenSystemDefault() {
        AppLocaleController.applyStoredLocale(context)
        assertEquals(AppLocaleController.TAG_SYSTEM, AppLocaleController.readStoredTag(context))
    }
}
