import AVFoundation
import Foundation

// MARK: - AudioSessionController

/// Manages AVAudioSession lifecycle and routes all notifications to the main queue.
/// KVO on outputVolume fires onHighVolumeWarning when volume > 0.75.
public final class AudioSessionController: NSObject {
    public private(set) var isHighVolumeWarningActive = false
    public private(set) var outputRoute: OutputRoute = .unknown
    public private(set) var isStereoRoute = true

    // All callbacks dispatched on the main queue.
    public var onInterruptionBegan: (() -> Void)?
    public var onInterruptionEnded: ((_ shouldResume: Bool) -> Void)?
    public var onRouteChanged: (() -> Void)?
    public var onMediaServicesReset: (() -> Void)?
    public var onHighVolumeWarning: (() -> Void)?
    public var onMediaServicesLost: (() -> Void)?

    private var hadPlayIntentBeforeInterruption = false
    #if os(iOS)
    private var isObservingOutputVolume = false
    #endif

    public override init() {
        super.init()
    }

    deinit {
        stopObserving()
    }

    // MARK: - Public

    public func configure(preferredSampleRate: Double, preferredBufferDurationMs: Double) {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
            try session.setPreferredSampleRate(preferredSampleRate)
            try session.setPreferredIOBufferDuration(preferredBufferDurationMs / 1000.0)
            try session.setActive(true)
            refreshRouteState(session: session)
            refreshVolumeState(session: session)
            startObserving()
        } catch {
            outputRoute = .unknown
        }
        #endif
    }

    public func deactivate() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        #endif
    }

    public func markUserPlayIntent(_ isPlaying: Bool) {
        hadPlayIntentBeforeInterruption = isPlaying
    }

    // MARK: - KVO

    #if os(iOS)
    public override func observeValue(
        forKeyPath keyPath: String?,
        of object: Any?,
        change: [NSKeyValueChangeKey: Any]?,
        context: UnsafeMutableRawPointer?
    ) {
        guard keyPath == "outputVolume" else { return }
        DispatchQueue.main.async {
            self.refreshVolumeState(session: AVAudioSession.sharedInstance())
        }
    }
    #endif

    // MARK: - Private

    #if os(iOS)
    private func startObserving() {
        stopObserving()
        let center = NotificationCenter.default
        let session = AVAudioSession.sharedInstance()
        center.addObserver(self, selector: #selector(handleInterruption(_:)),
                           name: AVAudioSession.interruptionNotification, object: session)
        center.addObserver(self, selector: #selector(handleRouteChange(_:)),
                           name: AVAudioSession.routeChangeNotification, object: session)
        center.addObserver(self, selector: #selector(handleMediaServicesLost(_:)),
                           name: AVAudioSession.mediaServicesWereLostNotification, object: session)
        center.addObserver(self, selector: #selector(handleMediaServicesReset(_:)),
                           name: AVAudioSession.mediaServicesWereResetNotification, object: session)
        session.addObserver(self, forKeyPath: "outputVolume", options: [.new], context: nil)
        isObservingOutputVolume = true
    }

    private func stopObserving() {
        NotificationCenter.default.removeObserver(self)
        if isObservingOutputVolume {
            AVAudioSession.sharedInstance().removeObserver(self, forKeyPath: "outputVolume", context: nil)
            isObservingOutputVolume = false
        }
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard
            let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else { return }

        DispatchQueue.main.async {
            switch type {
            case .began:
                self.onInterruptionBegan?()
            case .ended:
                let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
                let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
                let shouldResume = options.contains(.shouldResume) && self.hadPlayIntentBeforeInterruption
                self.onInterruptionEnded?(shouldResume)
            @unknown default:
                self.onInterruptionEnded?(false)
            }
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        DispatchQueue.main.async {
            self.refreshRouteState(session: AVAudioSession.sharedInstance())
            self.onRouteChanged?()
        }
    }

    @objc private func handleMediaServicesLost(_ notification: Notification) {
        DispatchQueue.main.async {
            self.onMediaServicesLost?()
        }
    }

    @objc private func handleMediaServicesReset(_ notification: Notification) {
        DispatchQueue.main.async {
            self.onMediaServicesReset?()
        }
    }

    private func refreshVolumeState(session: AVAudioSession) {
        if session.outputVolume > 0.75 {
            isHighVolumeWarningActive = true
            onHighVolumeWarning?()
        } else {
            isHighVolumeWarningActive = false
        }
    }

    private func refreshRouteState(session: AVAudioSession) {
        let outputs = session.currentRoute.outputs
        isStereoRoute = outputs.contains { ($0.channels?.count ?? 2) >= 2 }

        if outputs.contains(where: { $0.portType == .headphones || $0.portType == .headsetMic }) {
            outputRoute = .headphones
        } else if outputs.contains(where: {
            $0.portType == .bluetoothA2DP || $0.portType == .bluetoothLE || $0.portType == .bluetoothHFP
        }) {
            outputRoute = .bluetooth
        } else if outputs.contains(where: { $0.portType == .airPlay }) {
            outputRoute = .airplay
        } else if outputs.contains(where: { $0.portType == .builtInSpeaker }) {
            outputRoute = .speaker
        } else {
            outputRoute = .unknown
        }
    }
    #else
    private func stopObserving() {}
    #endif
}
