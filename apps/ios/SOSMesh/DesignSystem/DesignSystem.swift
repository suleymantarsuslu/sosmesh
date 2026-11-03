import SwiftUI

/// SOSMesh design system - colors derived from logo, spacing, typography
enum DesignSystem {
    /// Brand colors derived from SOSMesh logo
    enum Colors {
        /// Primary navy blue from logo background (#070D1D sampled)
        static let primaryNavy = Color(red: 0.027, green: 0.051, blue: 0.114)
        
        /// Accent blue for interactive elements
        static let accentBlue = Color(red: 0.1, green: 0.4, blue: 0.8)
        
        /// Emergency red for SOS actions
        static let emergencyRed = Color(red: 0.9, green: 0.2, blue: 0.15)
        
        /// Success green for confirmations
        static let successGreen = Color(red: 0.2, green: 0.7, blue: 0.3)
        
        /// Warning orange for alerts
        static let warningOrange = Color(red: 1.0, green: 0.6, blue: 0.0)
        
        /// Card backgrounds
        static let cardBackground = Color(.systemBackground)
        static let cardBackgroundSecondary = Color(.secondarySystemBackground)
        
        /// Text colors (system-adaptive)
        static let textPrimary = Color(.label)
        static let textSecondary = Color(.secondaryLabel)
        static let textTertiary = Color(.tertiaryLabel)
    }
    
    /// Typography scale
    enum Typography {
        static let largeTitle = Font.system(size: 34, weight: .bold, design: .rounded)
        static let title1 = Font.system(size: 28, weight: .bold, design: .rounded)
        static let title2 = Font.system(size: 22, weight: .bold, design: .rounded)
        static let title3 = Font.system(size: 20, weight: .semibold, design: .rounded)
        static let headline = Font.system(size: 17, weight: .semibold, design: .rounded)
        static let body = Font.system(size: 17, weight: .regular, design: .rounded)
        static let callout = Font.system(size: 16, weight: .regular, design: .rounded)
        static let subheadline = Font.system(size: 15, weight: .regular, design: .rounded)
        static let footnote = Font.system(size: 13, weight: .regular, design: .rounded)
        static let caption1 = Font.system(size: 12, weight: .regular, design: .rounded)
        static let caption2 = Font.system(size: 11, weight: .regular, design: .rounded)
    }
    
    /// Spacing scale (8pt grid)
    enum Spacing {
        static let xxxs: CGFloat = 2
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
        static let xxxl: CGFloat = 64
    }
    
    /// Corner radii
    enum CornerRadius {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let pill: CGFloat = 999
    }
    
    /// Shadow styles
    enum Shadow {
        static let sm = Color.black.opacity(0.05)
        static let md = Color.black.opacity(0.1)
        static let lg = Color.black.opacity(0.15)
    }
    
    /// Animation durations
    enum Animation {
        static let quick: Double = 0.2
        static let normal: Double = 0.3
        static let slow: Double = 0.5
    }
}

/// View extension for design system colors
extension View {
    func cardBackground() -> some View {
        self.background(DesignSystem.Colors.cardBackground)
    }
    
    func cardBackgroundSecondary() -> some View {
        self.background(DesignSystem.Colors.cardBackgroundSecondary)
    }
}
