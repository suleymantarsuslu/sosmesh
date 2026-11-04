import CoreLocation
import SwiftUI
import SOSMeshCore

struct SettingsView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            Form {
                Section("profile.title") {
                    NavigationLink {
                        ProfileFormView(isOnboarding: false, onFinish: {})
                    } label: {
                        Label("profile.edit", systemImage: "person.text.rectangle")
                    }
                }
                Section("settings.language.title") {
                    Button {
                        openLanguageSettings()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("settings.language.follows_device")
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(DesignSystem.Colors.textSecondary)
                        }
                    }
                    .accessibilityLabel(Text("settings.language.follows_device"))
                    .accessibilityHint(Text("settings.language.change_hint"))
                }
                
                Section("settings.permissions.title") {
                    Text("settings.permissions.bluetooth")
                    Text("settings.permissions.location")
                }
                Section("settings.radio.title") {
                    Text("settings.radio.high_power_intro")
                        .font(.caption)
                    Toggle("settings.radio.high_power_consent", isOn: $appModel.highPowerRadioConsent)
                }
                Section("ios.background.section") {
                    Text("ios.limitation.background")
                    Text("ios.limitation.force_quit")
                    Text("\(Text("settings.ble_phase")): \(appModel.restorationPhase.rawValue)")
                        .font(.caption)
                        .accessibilityLabel(Text("settings.ble_phase"))
                }
                Section("settings.multihop.title") {
                    Toggle(isOn: Binding(
                        get: { MeshRelayFeatureFlags.isExperimentalMultihopRelayEnabled },
                        set: { MeshRelayFeatureFlags.setExperimentalMultihopRelayEnabled($0) }
                    )) {
                        Text("settings.multihop.toggle")
                    }
                    .accessibilityLabel(Text("settings.multihop.toggle"))
                    Text("settings.multihop.footer")
                        .font(.footnote)
                }
                #if DEBUG
                Section("settings.debug.fault_simulation") {
                    Toggle("settings.debug.use_fault_simulation", isOn: $appModel.useFaultSimulationOverrides)
                        .onChange(of: appModel.useFaultSimulationOverrides) { _, _ in
                            Task { await appModel.refreshPermissionGate() }
                        }
                    Toggle("settings.debug.simulate_bluetooth_off", isOn: $appModel.simulateBluetoothOff)
                    Toggle("settings.debug.simulate_permissions_denied", isOn: $appModel.simulatePermissionsDenied)
                    Toggle("settings.debug.simulate_location_unavailable", isOn: $appModel.simulateLocationUnavailable)
                    
                    Button {
                        Task { @MainActor in
                            await SosNotificationManager.shared.scheduleTestNotification()
                        }
                    } label: {
                        Label("Test Notification (5s delay)", systemImage: "bell.badge")
                    }
                }
                #endif
            }
            .navigationTitle("settings.title")
        }
    }
    
    private func openLanguageSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

struct OnboardingDisclaimerView: View {
    let onAccept: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.xl) {
                VStack(spacing: DesignSystem.Spacing.md) {
                    Image("SOSMeshLogoLarge")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: 100)
                        .accessibilityLabel(Text("app.name"))
                    
                    Text("app.name")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                    
                    Text("app.tagline")
                        .font(DesignSystem.Typography.title3)
                        .foregroundStyle(DesignSystem.Colors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, DesignSystem.Spacing.xxl)
                
                VStack(spacing: DesignSystem.Spacing.md) {
                    let emergencyNumber = EmergencyNumberProvider.getEmergencyNumber()
                    SOSCard {
                        HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(DesignSystem.Colors.warningOrange)
                            Text(String(format: NSLocalizedString("onboarding.not112", comment: ""), emergencyNumber, emergencyNumber))
                                .font(DesignSystem.Typography.headline)
                                .foregroundStyle(DesignSystem.Colors.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    
                    SOSCard {
                        HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "flask.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(DesignSystem.Colors.accentBlue)
                            Text("onboarding.experimental")
                                .font(DesignSystem.Typography.callout)
                                .foregroundStyle(DesignSystem.Colors.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                
                PrimaryButton("onboarding.accept", icon: "checkmark") {
                    onAccept()
                }
                .padding(.top, DesignSystem.Spacing.md)
            }
            .padding(DesignSystem.Spacing.md)
        }
        .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
    }
}

// MARK: - Mesh v2 profile (optional, Keychain only; sent only inside the encrypted SOS payload)

struct ProfileFormView: View {
    @EnvironmentObject private var appModel: AppModel
    let isOnboarding: Bool
    let onFinish: () -> Void

    @State private var fullName = ""
    @State private var age = ""
    @State private var addressLine = ""
    @State private var district = ""
    @State private var city = ""
    @State private var postalCode = ""
    @State private var floor = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var householdSize = ""
    @State private var homeLocation: SosProfile.Coordinate?
    @State private var locating = false
    @State private var saving = false
    @State private var loaded = false

    var body: some View {
        Form {
            Section {
                Text("profile.intro")
                    .font(.footnote)
                    .foregroundStyle(DesignSystem.Colors.textSecondary)
                EmergencyCall112Button()
            }
            Section("profile.section.person") {
                TextField("profile.full_name", text: $fullName)
                    .textContentType(.name)
                TextField("profile.age", text: $age)
                    .keyboardType(.numberPad)
                TextField("profile.household_size", text: $householdSize)
                    .keyboardType(.numberPad)
            }
            Section("profile.section.address") {
                TextField("profile.address_line", text: $addressLine, axis: .vertical)
                    .textContentType(.fullStreetAddress)
                TextField("profile.district", text: $district)
                TextField("profile.city", text: $city)
                    .textContentType(.addressCity)
                TextField("profile.postal_code", text: $postalCode)
                    .textContentType(.postalCode)
                TextField("profile.floor", text: $floor)
                    .keyboardType(.numbersAndPunctuation)
                Button {
                    Task { await useCurrentLocation() }
                } label: {
                    Label(homeLocation == nil ? "profile.location.use_current" : "profile.location.saved", systemImage: homeLocation == nil ? "location" : "checkmark.circle")
                }
                .disabled(locating)
                Text("profile.location.footer")
                    .font(.caption)
                    .foregroundStyle(DesignSystem.Colors.textSecondary)
            }
            Section("profile.section.contact") {
                TextField("profile.phone", text: $phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                TextField("profile.email", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
            }
            Section {
                Button {
                    Task { await save() }
                } label: {
                    Text("profile.save").frame(maxWidth: .infinity)
                }
                .disabled(saving)
                if isOnboarding {
                    Button("profile.skip") { onFinish() }
                        .frame(maxWidth: .infinity)
                } else {
                    Button("profile.delete", role: .destructive) {
                        appModel.deleteProfile()
                        clear()
                    }
                }
            } footer: {
                Text("profile.privacy_footer")
            }
        }
        .navigationTitle("profile.title")
        .onAppear(perform: load)
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let p = appModel.loadProfile() else { return }
        fullName = p.fullName ?? ""
        age = p.age.map(String.init) ?? ""
        addressLine = p.address?.line ?? ""
        district = p.address?.district ?? ""
        city = p.address?.city ?? ""
        postalCode = p.address?.postalCode ?? ""
        floor = p.floor.map(String.init) ?? ""
        phone = p.phone ?? ""
        email = p.email ?? ""
        householdSize = p.householdSize.map(String.init) ?? ""
        homeLocation = p.homeLocation
    }

    private func clear() {
        fullName = ""; age = ""; addressLine = ""; district = ""; city = ""; postalCode = ""
        floor = ""; phone = ""; email = ""; householdSize = ""; homeLocation = nil
    }

    private func useCurrentLocation() async {
        locating = true
        homeLocation = await appModel.currentCoordinate() ?? homeLocation
        locating = false
    }

    private func save() async {
        saving = true
        defer { saving = false }
        var profile = SosProfile(
            fullName: fullName,
            age: Int(age.trimmingCharacters(in: .whitespaces)),
            address: SosProfile.Address(line: addressLine, district: district, city: city, postalCode: postalCode, country: nil),
            floor: Int(floor.trimmingCharacters(in: .whitespaces)),
            homeLocation: homeLocation,
            phone: phone,
            email: email,
            householdSize: Int(householdSize.trimmingCharacters(in: .whitespaces))
        )
        // On-device geocoding of the address (CLGeocoder); falls back to the saved location.
        if let geocoded = await ProfileGeocoder.coordinate(for: profile.address) {
            profile.homeLocation = geocoded
            homeLocation = geocoded
        }
        appModel.saveProfile(profile)
        onFinish()
    }
}

/// Address → coordinate on the device. Address text never leaves the device here except to
/// Apple's geocoder, which CLGeocoder uses by design.
enum ProfileGeocoder {
    static func coordinate(for address: SosProfile.Address?) async -> SosProfile.Coordinate? {
        guard let address, !address.isEmpty else { return nil }
        let text = [address.line, address.district, address.city, address.postalCode]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        guard !text.isEmpty else { return nil }
        let placemarks = try? await CLGeocoder().geocodeAddressString(text)
        guard let location = placemarks?.first?.location else { return nil }
        return SosProfile.Coordinate(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
    }
}

/// Shown once after the permission gate (notifications granted). Every field is optional.
struct ProfileOnboardingView: View {
    let onFinish: () -> Void

    var body: some View {
        NavigationStack {
            ProfileFormView(isOnboarding: true, onFinish: onFinish)
        }
    }
}
