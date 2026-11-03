import SwiftUI

/// Reusable card component following design system
struct SOSCard<Content: View>: View {
    let content: Content
    var highlighted: Bool = false
    var padding: CGFloat = DesignSystem.Spacing.md
    
    init(highlighted: Bool = false, padding: CGFloat = DesignSystem.Spacing.md, @ViewBuilder content: () -> Content) {
        self.highlighted = highlighted
        self.padding = padding
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(highlighted ? DesignSystem.Colors.accentBlue.opacity(0.1) : DesignSystem.Colors.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(highlighted ? DesignSystem.Colors.accentBlue.opacity(0.3) : Color.clear, lineWidth: 1)
            )
            .shadow(color: DesignSystem.Shadow.sm, radius: 2, x: 0, y: 1)
    }
}

/// Status indicator badge
struct StatusBadge: View {
    enum Status {
        case success
        case pending
        case warning
        case error
        
        var color: Color {
            switch self {
            case .success: return DesignSystem.Colors.successGreen
            case .pending: return DesignSystem.Colors.accentBlue
            case .warning: return DesignSystem.Colors.warningOrange
            case .error: return DesignSystem.Colors.emergencyRed
            }
        }
        
        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .pending: return "clock.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            }
        }
    }
    
    let status: Status
    let text: String
    
    var body: some View {
        Label(text, systemImage: status.icon)
            .font(DesignSystem.Typography.caption1)
            .foregroundStyle(status.color)
            .padding(.horizontal, DesignSystem.Spacing.xs)
            .padding(.vertical, DesignSystem.Spacing.xxs)
            .background(
                Capsule()
                    .fill(status.color.opacity(0.15))
            )
    }
}
