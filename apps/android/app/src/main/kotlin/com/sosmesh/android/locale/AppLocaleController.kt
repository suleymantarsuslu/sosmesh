package com.sosmesh.android.locale

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

object AppLocaleController {
    const val PREFS_NAME = "sosmesh_app_locale"
    private const val KEY_TAG = "language_tag"

    /** Follow device locale (values/ fallback for unsupported languages). */
    const val TAG_SYSTEM = "system"
    const val TAG_ENGLISH = "en"
    const val TAG_TURKISH = "tr"

    fun readStoredTag(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_TAG, null) ?: TAG_SYSTEM
    }

    /**
     * Applies only an explicit in-app override. When preference is [TAG_SYSTEM], does not call
     * AppCompat (device locale applies; unsupported → [values/] English resources).
     */
    fun applyStoredLocale(context: Context) {
        when (readStoredTag(context)) {
            TAG_ENGLISH ->
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(TAG_ENGLISH))
            TAG_TURKISH ->
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(TAG_TURKISH))
            else -> Unit
        }
    }

    fun setApplicationLanguage(
        context: Context,
        languageTag: String,
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        when (languageTag) {
            TAG_SYSTEM -> {
                prefs.remove(KEY_TAG).apply()
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.getEmptyLocaleList())
            }
            TAG_TURKISH -> {
                prefs.putString(KEY_TAG, TAG_TURKISH).apply()
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(TAG_TURKISH))
            }
            TAG_ENGLISH -> {
                prefs.putString(KEY_TAG, TAG_ENGLISH).apply()
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(TAG_ENGLISH))
            }
            else -> {
                prefs.remove(KEY_TAG).apply()
                AppCompatDelegate.setApplicationLocales(LocaleListCompat.getEmptyLocaleList())
            }
        }
    }
}
