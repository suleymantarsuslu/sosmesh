import SwiftUI

/// Primary large SOS button with modern styling
struct SOSButton: View {
    let action: () -> Void
    @State private var isPressing = false
    @AccessibilityFocusState private var isFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 28, weight: .bold))
                Text("SOS")
                    .font(DesignSystem.Typography.largeTitle)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                    .fill(
                        LinearGradient(
                            colors: [
                                DesignSystem.Colors.emergencyRed,
                                DesignSystem.Colors.emergencyRed.opacity(0.85)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .shadow(color: DesignSystem.Colors.emergencyRed.opacity(0.4), radius: 12, x: 0, y: 6)
            .scaleEffect(isPressing && !reduceMotion ? 0.98 : 1.0)
            .animation(.easeInOut(duration: DesignSystem.Animation.quick), value: isPressing)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressing = true }
                .onEnded { _ in isPressing = false }
        )
        .accessibilityLabel(Text("sos.button.label"))
        .accessibilityHint(Text("sos.button.aria"))
        .accessibilityFocused($isFocused)
    }
}

/// Modern primary button
struct PrimaryButton: View {
    let title: LocalizedStringKey
    let icon: String?
    let action: () -> Void
    var isDestructive: Bool = false
    
    init(_ title: LocalizedStringKey, icon: String? = nil, isDestructive: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.isDestructive = isDestructive
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                if let icon {
                    Image(systemName: icon)
                }
                Text(title)
            }
            .font(DesignSystem.Typography.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(isDestructive ? DesignSystem.Colors.emergencyRed : DesignSystem.Colors.accentBlue)
            )
        }
    }
}

/// Secondary button style
struct SecondaryButton: View {
    let title: LocalizedStringKey
    let icon: String?
    let action: () -> Void
    
    init(_ title: LocalizedStringKey, icon: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                if let icon {
                    Image(systemName: icon)
                }
                Text(title)
            }
            .font(DesignSystem.Typography.callout)
            .foregroundStyle(DesignSystem.Colors.accentBlue)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(DesignSystem.Colors.accentBlue, lineWidth: 2)
            )
        }
    }
}
