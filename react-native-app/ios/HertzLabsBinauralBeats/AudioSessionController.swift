import AVFoundation
import UIKit

/// Manages the AVAudioSession lifecycle for background/foreground transitions.
/// - Free tier: stops audio on background.
/// - Premium tier: keeps session active for background audio playback.
@objcMembers
final class AudioSessionController: NSObject {

    static let shared = AudioSessionController()

    /// Premium + user toggle — set from JS when tier or background-audio setting changes.
    var backgroundPlaybackEnabled: Bool = false

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
            #if targetEnvironment(simulator)
            // Playback-only leaves RemoteIO input at 0 Hz on simulator (-10851).
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.defaultToSpeaker, .mixWithOthers, .allowBluetooth]
            )
            #else
            try session.setCategory(.playback, options: [.allowBluetooth, .mixWithOthers])
            #endif
            try session.setActive(true)
            #if targetEnvironment(simulator)
            if AVAudioApplication.shared.recordPermission == .undetermined {
                AVAudioApplication.requestRecordPermission { _ in }
            }
            #endif
        } catch {
            NSLog("[AudioSessionController] configureForPlayback failed: %@", String(describing: error))
        }
    }

    @objc private func didEnterBackground() {
        if !backgroundPlaybackEnabled {
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
