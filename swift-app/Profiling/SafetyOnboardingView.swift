import SwiftUI

// MARK: - Safety Onboarding Gate

/// Mandatory legal gate screen (Plan 05 §3).
/// Persists acceptance via @AppStorage (UserDefaults "hasAcceptedSafetyTerms").
/// Shown on first launch only; unmounts and yields to PlayerView on acceptance.
struct SafetyOnboardingView: View {
    @AppStorage("hasAcceptedSafetyTerms") private var hasAcceptedSafetyTerms = false
    @State private var checkedTerms = false
    @State private var checkedMedical = false

    private var ctaEnabled: Bool { checkedTerms && checkedMedical }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                headerSection
                OnboardingDivider().padding(.vertical, 20)
                disclaimerSection
                OnboardingDivider().padding(.vertical, 20)
                checkboxSection
                ctaButton
                Spacer(minLength: 20)
            }
            .padding(.horizontal, 24)
            .padding(.top, 64)
            .padding(.bottom, 40)
        }
        .background(Color(red: 5/255, green: 8/255, blue: 16/255).ignoresSafeArea())
    }

    // MARK: Sections

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Before You Begin")
                .font(.system(size: 28, weight: .bold))
                .foregroundColor(.white)
            Text("Please read the following carefully.")
                .font(.system(size: 15))
                .foregroundColor(.white.opacity(0.55))
        }
        .padding(.bottom, 24)
    }

    private var disclaimerSection: some View {
        VStack(spacing: 0) {
            DisclaimerCard(
                title: "Medical Disclaimer",
                titleColor: .white.opacity(0.6),
                borderColor: .white.opacity(0.08),
                bgColor: .white.opacity(0.04),
                content:
                    Text("Binaural beats and audio-frequency stimulation are intended for relaxation, focus, and personal wellness only. They are ")
                    + Text("not").bold()
                    + Text(" a substitute for medical diagnosis, treatment, therapy, or professional medical advice. Do not use this app to self-treat any medical condition.")
            )

            DisclaimerCard(
                title: "⚠ Seizure & Photosensitivity Warning",
                titleColor: Color(red: 251/255, green: 191/255, blue: 36/255),
                borderColor: Color(red: 251/255, green: 191/255, blue: 36/255).opacity(0.3),
                bgColor: Color(red: 251/255, green: 191/255, blue: 36/255).opacity(0.05),
                content:
                    Text("Audio entrainment may affect brain wave activity. Do ")
                    + Text("not").bold()
                    + Text(" use this app if you have epilepsy, photosensitivity disorder, or any condition that makes you susceptible to seizures. If you are unsure of your sensitivity, consult a licensed physician before use.")
            )

            DisclaimerCard(
                title: "Hearing Safety",
                titleColor: .white.opacity(0.6),
                borderColor: .white.opacity(0.08),
                bgColor: .white.opacity(0.04),
                content:
                    Text("Use headphones or speakers at a comfortable, moderate volume. Prolonged exposure to high-volume audio may cause permanent hearing damage. Hertz Labs recommends a maximum session duration of ")
                    + Text("60 minutes").bold()
                    + Text(" and a minimum break of ")
                    + Text("15 minutes").bold()
                    + Text(" between sessions.")
            )

            DisclaimerCard(
                title: "Age Requirement",
                titleColor: .white.opacity(0.6),
                borderColor: .white.opacity(0.08),
                bgColor: .white.opacity(0.04),
                content:
                    Text("This app is intended for users ")
                    + Text("13 years of age or older").bold()
                    + Text(". If you are under 13, do not use this app.")
            )
        }
    }

    private var checkboxSection: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                ToggleBox(checked: checkedTerms) { checkedTerms.toggle() }
                    .padding(.top, 1)
                (
                    Text("I have read and agree to the ")
                    + Text("Terms of Service").foregroundColor(Color(red: 74/255, green: 222/255, blue: 128/255))
                    + Text(" and ")
                    + Text("Privacy Policy").foregroundColor(Color(red: 74/255, green: 222/255, blue: 128/255))
                    + Text(".")
                )
                .font(.system(size: 14))
                .foregroundColor(.white.opacity(0.8))
                .lineSpacing(3)
                .onTapGesture { checkedTerms.toggle() }
            }
            .padding(.bottom, 16)

            HStack(alignment: .top, spacing: 12) {
                ToggleBox(checked: checkedMedical) { checkedMedical.toggle() }
                    .padding(.top, 1)
                Text("I understand that Hertz Labs does not provide medical advice and I will not use it as a substitute for professional medical care.")
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.8))
                    .lineSpacing(3)
                    .onTapGesture { checkedMedical.toggle() }
            }
            .padding(.bottom, 24)
        }
    }

    private var ctaButton: some View {
        Button(action: { if ctaEnabled { hasAcceptedSafetyTerms = true } }) {
            Text("Acknowledge & Enter")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(ctaEnabled ? .black : .white.opacity(0.25))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    ctaEnabled
                        ? Color(red: 74/255, green: 222/255, blue: 128/255)
                        : Color.white.opacity(0.08)
                )
                .cornerRadius(14)
        }
        .disabled(!ctaEnabled)
        .padding(.bottom, 8)
    }
}

// MARK: - Subcomponents

private struct OnboardingDivider: View {
    var body: some View {
        Rectangle().frame(height: 1).foregroundColor(.white.opacity(0.08))
    }
}

private struct DisclaimerCard: View {
    let title: String
    let titleColor: Color
    let borderColor: Color
    let bgColor: Color
    let content: Text

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(titleColor)
                .tracking(0.8)
                .textCase(.uppercase)
            content
                .font(.system(size: 14))
                .foregroundColor(.white.opacity(0.75))
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bgColor)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(borderColor, lineWidth: 1))
        .padding(.bottom, 12)
    }
}

private struct ToggleBox: View {
    let checked: Bool
    let action: () -> Void
    private let accent = Color(red: 74/255, green: 222/255, blue: 128/255)

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(checked ? accent : Color.clear)
                RoundedRectangle(cornerRadius: 6)
                    .stroke(checked ? accent : Color.white.opacity(0.3), lineWidth: 1.5)
                if checked {
                    Text("✓")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.black)
                }
            }
            .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
    }
}
