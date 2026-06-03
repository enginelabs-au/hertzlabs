import SwiftUI

@main
struct HertzLabsProfilerApp: App {
    @AppStorage("hasAcceptedSafetyTerms") private var hasAcceptedSafetyTerms = false

    var body: some Scene {
        WindowGroup {
            if hasAcceptedSafetyTerms {
                PlayerView()
            } else {
                SafetyOnboardingView()
            }
        }
    }
}
