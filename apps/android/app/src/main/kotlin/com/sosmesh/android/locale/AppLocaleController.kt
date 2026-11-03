package com.sosmesh.android.locale

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

object AppLocaleController {
    const val PREFS_NAME = "sosmesh_app_locale"
    private const val KEY_TAG = "language_tag"
    const val TAG_ENGLISH = "en"
    const val TAG_TURKISH = "tr"

    fun readStoredTag(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_TAG, TAG_ENGLISH) ?: TAG_ENGLISH
    }

    fun applyStoredLocale(context: Context) {
        val tag = readStoredTag(context)
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
    }

    fun setApplicationLanguage(context: Context, languageTag: String) {
        val normalized =
            when (languageTag) {
                TAG_TURKISH -> TAG_TURKISH
                else -> TAG_ENGLISH
            }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TAG, normalized)
            .apply()
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(normalized))
    }
}
