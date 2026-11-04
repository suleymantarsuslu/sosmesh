# iOS SOSWidget - Manual Xcode Setup Required

The widget extension files have been created, but the Xcode project target must be added manually on a Mac with Xcode installed.

## Files Created

- `SOSWidget/SOSWidgetBundle.swift` - Widget bundle entry point
- `SOSWidget/SOSWidget.swift` - Widget implementation
- `SOSWidget/Info.plist` - Widget extension Info.plist
- `SOSWidget/en.lproj/Localizable.strings` - English localizations
- `SOSWidget/tr.lproj/Localizable.strings` - Turkish localizations

## Manual Steps in Xcode

1. Open `SOSMesh.xcodeproj` in Xcode on a Mac

2. Add a new **Widget Extension** target:
   - File → New → Target
   - Choose "Widget Extension"
   - Product Name: `SOSWidget`
   - Bundle Identifier: `com.suleymantarsuslu.sosmesh.SOSWidget`
   - Starting Configuration: Delete the auto-generated files

3. Replace the auto-generated widget files with the created files:
   - Delete the auto-generated `SOSWidget` group/folder
   - Add the existing `SOSWidget` folder to the project:
     - Right-click on project root → "Add Files to SOSMesh"
     - Select the `SOSWidget` folder
     - Check "Create groups"
     - Add to `SOSWidget` target only

4. Configure the `SOSWidget` target:
   - **General** tab:
     - Deployment Target: Match main app (16.0+)
     - Frameworks: Add `WidgetKit` and `SwiftUI`
   - **Build Settings** tab:
     - Set `DEVELOPMENT_TEAM` to match main app target
     - Ensure `PRODUCT_BUNDLE_IDENTIFIER` is `com.suleymantarsuslu.sosmesh.SOSWidget`
     - Set `INFOPLIST_FILE` to `SOSWidget/Info.plist`

5. Embed the widget extension in the main app:
   - Select main app target (`SOSMesh-iOS`)
   - **General** tab → **Frameworks, Libraries, and Embedded Content**
   - If `SOSWidget.appex` is not already listed, Xcode should handle embedding automatically
   - Verify the widget target is listed under **Build Phases** → **Embed Foundation Extensions**

6. Build and test:
   - Build the main app
   - Run on a simulator or device
   - Long-press on home screen → Add widget → SOSMesh → SOS
   - Tap the widget to verify it opens the SOS compose screen

## Verification

- The widget should show a red SOS button with "Emergency Network" / "Acil Durum Ağı" text
- Tapping should open the main app to the SOS compose screen (or follow-up screen if there's an open case)
- The widget must NOT send an SOS by itself (it only opens the app)

## URL Scheme

The widget uses `sosmesh://sos` to open the app. This scheme has been added to the main app's `Info.plist` and is handled in `SOSMeshApp.swift` via `onOpenURL`.
