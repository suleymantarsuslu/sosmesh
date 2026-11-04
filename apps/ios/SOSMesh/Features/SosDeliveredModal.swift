import SwiftUI

struct SosDeliveredModal: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(DesignSystem.Colors.successGreen)
                        .accessibilityHidden(true)
                    
                    Text("sos.delivered.title")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundStyle(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                        .accessibilityAddTraits(.isHeader)
                    
                    SOSCard {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                            HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 20))
                                    .foregroundStyle(DesignSystem.Colors.emergencyRed)
                                    .accessibilityHidden(true)
                                
                                Text("sos.delivered.message")
                                    .font(DesignSystem.Typography.callout)
                                    .foregroundStyle(DesignSystem.Colors.textPrimary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .accessibilityElement(children: .combine)
                    
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Link(destination: URL(string: "tel:112")!) {
                            HStack(spacing: DesignSystem.Spacing.xs) {
                                Image(systemName: "phone.fill")
                                Text("gate.action.call112")
                            }
                            .font(DesignSystem.Typography.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, DesignSystem.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                                    .fill(DesignSystem.Colors.emergencyRed)
                            )
                        }
                        .accessibilityLabel(Text("gate.action.call112"))
                        .accessibilityHint(Text("gate.action.call112.hint"))
                        
                        PrimaryButton("sos.sent.action.ok", icon: "checkmark") {
                            dismiss()
                        }
                    }
                }
                .padding(DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.cardBackgroundSecondary.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(DesignSystem.Colors.textSecondary)
                    }
                    .accessibilityLabel(Text("Close"))
                }
            }
        }
    }
}
