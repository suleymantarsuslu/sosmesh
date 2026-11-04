package com.sosmesh.android.ui.profile

import android.content.Context
import android.location.Geocoder
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sosmesh.android.core.data.profile.SosProfile
import com.sosmesh.android.core.data.profile.SosProfileAddress
import com.sosmesh.android.core.data.profile.SosProfileLatLng
import com.sosmesh.android.core.data.profile.SosProfileStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.Locale
import javax.inject.Inject
import kotlin.coroutines.resume

data class ProfileForm(
    val fullName: String = "",
    val age: String = "",
    val addressLine: String = "",
    val district: String = "",
    val city: String = "",
    val postalCode: String = "",
    val country: String = "TR",
    val floor: String = "",
    val homeLat: Double? = null,
    val homeLng: Double? = null,
    val phone: String = "",
    val email: String = "",
    val householdSize: String = "",
    val loaded: Boolean = false,
    val saving: Boolean = false,
    val geocodeFailed: Boolean = false,
    val locating: Boolean = false,
    val locationFailed: Boolean = false,
    /** True when the user explicitly chose the current GPS fix as home location (address geocoding then does not override it). */
    val homeFromGps: Boolean = false,
)

/** mesh-v2 §7 onboarding profile. Values stay on device (EncryptedSharedPreferences); never logged. */
@HiltViewModel
class ProfileViewModel
    @Inject
    constructor(
        private val store: SosProfileStore,
        private val locationProvider: com.sosmesh.android.feature.sos.location.SosLocationProvider,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        private val _form = MutableStateFlow(ProfileForm())
        val form: StateFlow<ProfileForm> = _form.asStateFlow()

        init {
            viewModelScope.launch {
                val p = withContext(Dispatchers.IO) { runCatching { store.profile() }.getOrNull() }
                _form.value = p?.toForm() ?: ProfileForm(loaded = true)
            }
        }

        fun update(transform: (ProfileForm) -> ProfileForm) = _form.update(transform)

        fun save(onDone: () -> Unit) {
            val f = _form.value
            _form.update { it.copy(saving = true, geocodeFailed = false) }
            viewModelScope.launch {
                val address = SosProfileAddress(f.addressLine, f.district, f.city, f.postalCode, f.country).sanitized()
                val home = if (f.homeFromGps) null else address.geocodeQuery()?.let { geocode(it) }
                val profile =
                    SosProfile(
                        fullName = f.fullName,
                        age = f.age.trim().toIntOrNull(),
                        address = address,
                        floor = f.floor.trim().toIntOrNull(),
                        homeLocation = home ?: f.homeLat?.let { lat -> f.homeLng?.let { SosProfileLatLng(lat, it) } },
                        phone = f.phone,
                        email = f.email,
                        householdSize = f.householdSize.trim().toIntOrNull(),
                    )
                withContext(Dispatchers.IO) { runCatching { store.saveProfile(profile) } }
                _form.update { it.copy(saving = false, geocodeFailed = !f.homeFromGps && address.geocodeQuery() != null && home == null) }
                onDone()
            }
        }

        /** "Use my current location": one GPS fix, kept only in the encrypted profile. */
        fun useCurrentLocation() {
            _form.update { it.copy(locating = true, locationFailed = false) }
            viewModelScope.launch {
                val provider = locationProvider
                val snap =
                    if (provider is com.sosmesh.android.feature.sos.location.AndroidGpsLocationProvider) {
                        provider.requestLocationAsync()
                    } else {
                        withContext(Dispatchers.IO) { provider.currentLocation() }
                    }
                val lat = snap.latitude
                val lng = snap.longitude
                _form.update {
                    if (snap.isKnown && lat != null && lng != null) {
                        it.copy(homeLat = lat, homeLng = lng, homeFromGps = true, locating = false)
                    } else {
                        it.copy(locating = false, locationFailed = true)
                    }
                }
            }
        }

        fun skip(onDone: () -> Unit) {
            viewModelScope.launch {
                withContext(Dispatchers.IO) { runCatching { store.markOnboardingDone() } }
                onDone()
            }
        }

        fun delete(onDone: () -> Unit) {
            viewModelScope.launch {
                withContext(Dispatchers.IO) { runCatching { store.deleteProfile() } }
                _form.value = ProfileForm(loaded = true)
                onDone()
            }
        }

        /** On-device Android Geocoder; result only stored in the encrypted profile. */
        private suspend fun geocode(query: String): SosProfileLatLng? {
            if (!Geocoder.isPresent()) return null
            val geocoder = Geocoder(context, Locale.getDefault())
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    suspendCancellableCoroutine { cont ->
                        geocoder.getFromLocationName(
                            query,
                            1,
                            object : Geocoder.GeocodeListener {
                                override fun onGeocode(addresses: MutableList<android.location.Address>) {
                                    val a = addresses.firstOrNull()
                                    if (cont.isActive) cont.resume(a?.let { SosProfileLatLng(it.latitude, it.longitude) })
                                }

                                override fun onError(errorMessage: String?) {
                                    if (cont.isActive) cont.resume(null)
                                }
                            },
                        )
                    }
                } else {
                    withContext(Dispatchers.IO) { legacyGeocode(geocoder, query) }
                }
            } catch (_: Exception) {
                null
            }
        }

        private fun legacyGeocode(
            geocoder: Geocoder,
            query: String,
        ): SosProfileLatLng? {
            val a = geocoder.getFromLocationName(query, 1)?.firstOrNull() ?: return null
            return SosProfileLatLng(a.latitude, a.longitude)
        }

        private fun SosProfile.toForm() =
            ProfileForm(
                fullName = fullName.orEmpty(),
                age = age?.toString().orEmpty(),
                addressLine = address?.line.orEmpty(),
                district = address?.district.orEmpty(),
                city = address?.city.orEmpty(),
                postalCode = address?.postalCode.orEmpty(),
                country = address?.country ?: "TR",
                floor = floor?.toString().orEmpty(),
                homeLat = homeLocation?.latitude,
                homeLng = homeLocation?.longitude,
                phone = phone.orEmpty(),
                email = email.orEmpty(),
                householdSize = householdSize?.toString().orEmpty(),
                loaded = true,
            )
    }
