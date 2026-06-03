import AVFoundation
import UIKit

/// Manages the AVAudioSession lifecycle for background/foreground transitions.
/// - Free tier: stops audio on background.
/// - Premium tier: keeps session active for background audio playback.
final class AudioSessionController: NSObject {

    static let shared = AudioSessionController()

    /// Set by the bridge/module when subscription state changes.
    var isPremium: Bool = false

    private override init() {
        super.init()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(willEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func configureForPlayback() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playback,
                options: [.allowBluetooth, .defaultToSpeaker, .mixWithOthers]
            )
            try session.setActive(true)
        } catch {
            // Silently swallow; audio state will self-recover on next play attempt.
        }
    }

    @objc private func didEnterBackground() {
        if !isPremium {
            engineStop()
            do {
                try AVAudioSession.sharedInstance().setActive(
                    false,
                    options: .notifyOthersOnDeactivation
                )
            } catch {
                // No-op: deactivation best-effort
            }
        }
        // Premium: session stays alive; background audio continues.
    }

    @objc private func willEnterForeground() {
        configureForPlayback()
    }

    /// Posts a notification that the native audio module observes to stop playback.
    private func engineStop() {
        NotificationCenter.default.post(
            name: NSNotification.Name("HertzAudioShouldStop"),
            object: nil
        )
    }
}
