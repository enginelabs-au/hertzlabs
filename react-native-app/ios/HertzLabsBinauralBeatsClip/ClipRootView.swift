import StoreKit
import SwiftUI

struct ClipRootView: View {
  @StateObject private var audio = ClipBinauralEngine()
  @State private var showAppStoreOverlay = true

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [Color(red: 0.04, green: 0.05, blue: 0.09), .black],
        startPoint: .top,
        endPoint: .bottom
      )
      .ignoresSafeArea()

      VStack(spacing: 28) {
        Spacer()

        Text("HERTZ LABS")
          .font(.system(size: 14, weight: .semibold, design: .monospaced))
          .kerning(4)
          .foregroundStyle(Color.white.opacity(0.72))

        Text("Theta Focus")
          .font(.system(size: 34, weight: .light, design: .default))
          .foregroundStyle(.white)

        Text("6 Hz binaural demo")
          .font(.system(size: 15, weight: .regular, design: .monospaced))
          .foregroundStyle(Color.cyan.opacity(0.85))

        Button(action: { audio.togglePlayback() }) {
          Text(audio.isPlaying ? "Pause" : "Play Demo")
            .font(.system(size: 17, weight: .semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.white.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 32)
        .padding(.top, 8)

        Text("Use headphones for the binaural effect.")
          .font(.footnote)
          .foregroundStyle(Color.white.opacity(0.45))
          .multilineTextAlignment(.center)
          .padding(.horizontal, 28)

        Spacer()

        Text("Install the full app for all brainwave bands, presets, and premium features.")
          .font(.caption)
          .foregroundStyle(Color.white.opacity(0.4))
          .multilineTextAlignment(.center)
          .padding(.horizontal, 24)
          .padding(.bottom, 12)
      }
    }
    .appStoreOverlay(isPresented: $showAppStoreOverlay) {
      SKOverlay.AppClipConfiguration(position: .bottom)
    }
    .onDisappear { audio.stop() }
  }
}
