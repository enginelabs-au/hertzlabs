import AVFoundation
import AudioToolbox
import Foundation

// MARK: - Engine state machine

public enum EngineState: String, Sendable {
    case uninitialized
    case ready
    case starting
    case playing
    case pausing
    case paused
    case stopping
    case stopped
    case interrupted
    case rebuilding
    case error
}

// MARK: - Output route

public enum OutputRoute: String, Sendable {
    case speaker
    case headphones
    case bluetooth
    case airplay
    case unknown
}

// MARK: - HertzAudioEngine

/// Core AVAudioEngine graph + state machine.
/// All state transitions are serialized on `controlQueue` (serial, QoS .userInitiated).
/// The render thread only touches ParameterBox.read() — never this object.
public final class HertzAudioEngine {
    public let parameterBox: ParameterBox

    /// Fires on main queue with (engineState, sampleRate, routeString).
    public var onState: ((EngineState, Double, String) -> Void)?
    public var onPosition: ((Double) -> Void)?
    public var onError: ((_ code: String, _ message: String) -> Void)?
    public var onHighVolumeWarning: (() -> Void)?

    private let controlQueue = DispatchQueue(
        label: "com.hertzlabs.audio.engine",
        qos: .userInitiated
    )
    private let sessionController: AudioSessionController
    private var preferredSampleRate: Double
    private var preferredBufferDurationMs: Double

    private var engine = AVAudioEngine()
    private var oscillatorNode: BinauralOscillatorNode?
    private var limiter = HertzAudioEngine.makeLimiterNode()
    private var engineState: EngineState = .uninitialized
    private var sampleRate: Double
    private var userPlayIntent = false

    // Position timer
    private var positionTimer: DispatchSourceTimer?
    private var sessionStartDate: Date?
    private var routeRebuildWorkItem: DispatchWorkItem?
    private var lastGraphSampleRate: Double = 0

    public init(config: EngineConfig, parameterBox: ParameterBox = ParameterBox()) {
        self.preferredSampleRate = config.preferredSampleRate
        self.preferredBufferDurationMs = config.preferredBufferDurationMs
        self.parameterBox = parameterBox
        self.sessionController = AudioSessionController()
        self.sampleRate = config.preferredSampleRate
        wireSessionCallbacks()
    }

    // MARK: - Public API

    public func configure(sampleRate: Double, bufferDurationMs: Double) {
        controlQueue.async {
            self.preferredSampleRate = sampleRate
            self.preferredBufferDurationMs = bufferDurationMs
            // Session + graph are established on play() so AVAudioSession is active
            // and outputFormat reports a valid sample rate (avoids -10851 on simulator).
            if self.engineState == .uninitialized {
                self.transition(to: .ready)
            }
        }
    }

    public func play() {
        controlQueue.async {
            self.userPlayIntent = true
            self.sessionController.markUserPlayIntent(true)
            var s = self.parameterBox.read()
            s.playIntent = true
            self.parameterBox.write(s)
            do {
                self.sessionController.configure(
                    preferredSampleRate: self.preferredSampleRate,
                    preferredBufferDurationMs: self.preferredBufferDurationMs
                )
                #if os(iOS) && targetEnvironment(simulator)
                self.ensureSimulatorMicPermissionIfNeeded()
                #endif
                // (Re)build graph when uninitialized or after a prior failed start (-10851).
                let needsGraph = self.oscillatorNode == nil
                    || self.engineState == .uninitialized
                    || self.engineState == .error
                    || !self.engine.isRunning
                if needsGraph {
                    self.rebuildGraph()
                    self.transition(to: .ready)
                }
                if !self.engine.isRunning {
                    self.transition(to: .starting)
                    #if targetEnvironment(simulator)
                    // Let CoreAudio publish a valid output route after setActive.
                    usleep(50_000)
                    #endif
                    try self.engine.start()
                }
                self.transition(to: .playing)
                self.sessionStartDate = Date()
                self.startPositionTimer()
            } catch {
                self.fail(code: "ios_engine_start_failed", message: String(describing: error))
            }
        }
    }

    public func pause() {
        controlQueue.async {
            self.userPlayIntent = false
            self.sessionController.markUserPlayIntent(false)
            self.parameterBox.setPlayIntent(false)
            self.transition(to: .pausing)
            // Brief delay to let the gain ramp to silence before pausing
            self.controlQueue.asyncAfter(deadline: .now() + .milliseconds(80)) {
                self.engine.pause()
                self.stopPositionTimer()
                self.transition(to: .paused)
            }
        }
    }

    public func stop() {
        controlQueue.async {
            self.userPlayIntent = false
            self.sessionController.markUserPlayIntent(false)
            self.parameterBox.setPlayIntent(false)
            self.transition(to: .stopping)
            self.controlQueue.asyncAfter(deadline: .now() + .milliseconds(80)) {
                self.engine.stop()
                self.stopPositionTimer()
                self.sessionStartDate = nil
                self.transition(to: .stopped)
                DispatchQueue.main.async { self.onPosition?(0) }
            }
        }
    }

    public func setBinauralParameters(
        carrierHz: Double,
        beatHz: Double,
        gain: Float,
        balance: Float,
        noiseWhite: Float = 0,
        noisePink: Float = 0,
        noiseBrown: Float = 0
    ) {
        guard carrierHz.isFinite, beatHz.isFinite, gain.isFinite, balance.isFinite else {
            fail(code: "invalid_audio_parameters", message: "Non-finite audio parameter rejected.")
            return
        }
        parameterBox.setBinaural(
            carrierHz: carrierHz,
            beatHz: beatHz,
            gain: gain,
            balance: balance,
            noiseWhite: noiseWhite,
            noisePink: noisePink,
            noiseBrown: noiseBrown
        )
    }

    public func setPhaseAndTiming(phaseAngle: Double, timingDiffMs: Double) {
        parameterBox.setPhaseAndTiming(phaseAngle: phaseAngle, timingDiffMs: timingDiffMs)
    }

    public func setNoise(type: String, level: Float) {
        let noiseType = NoiseType(rawValue: type) ?? .none
        parameterBox.setNoise(type: noiseType, level: level)
    }

    public func setNoiseLayers(white: Float, pink: Float, brown: Float) {
        parameterBox.setNoiseLayers(white: white, pink: pink, brown: brown)
    }

    public func fade(toGain: Float, durationMs: Int) {
        var s = parameterBox.read()
        s.targetGain = toGain
        parameterBox.write(s)
    }

    public func loadPreset(_ presetJson: String) {
        guard let data = presetJson.data(using: .utf8),
              let preset = try? JSONDecoder().decode(SessionPlan.self, from: data) else {
            fail(code: "preset_decode_failed", message: "Could not decode preset JSON.")
            return
        }
        let noiseType = NoiseType(rawValue: preset.noiseType) ?? .none
        _ = noiseType // noise deferred
        setBinauralParameters(
            carrierHz: preset.carrierHz,
            beatHz: preset.beatHz,
            gain: preset.noiseLevel == 0 ? 0.5 : preset.noiseLevel,
            balance: 0,
            noiseWhite: 0,
            noisePink: 0,
            noiseBrown: 0
        )
    }

    // MARK: - Private helpers

    #if os(iOS) && targetEnvironment(simulator)
    private func ensureSimulatorMicPermissionIfNeeded() {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            return
        case .undetermined:
            let sem = DispatchSemaphore(value: 0)
            AVAudioApplication.requestRecordPermission { _ in sem.signal() }
            _ = sem.wait(timeout: .now() + 2.0)
        default:
            break
        }
    }
    #endif

    private func rebuildGraph() {
        let probeEngine = AVAudioEngine()
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        let sessionRate = session.sampleRate
        let outputRate = probeEngine.outputNode.inputFormat(forBus: 0).sampleRate
        let resolvedRate = [sessionRate, outputRate, preferredSampleRate].first { $0 > 0 && $0.isFinite } ?? 44_100
        #else
        let resolvedRate = preferredSampleRate
        #endif
        let newRate = (resolvedRate > 0 && resolvedRate.isFinite) ? resolvedRate : 44_100

        // Route notifications can fire often; rebuilding the graph causes audible crackle.
        if oscillatorNode != nil,
           abs(newRate - lastGraphSampleRate) < 1.0,
           engine.isRunning || engineState == .playing || engineState == .ready {
            sampleRate = newRate
            return
        }

        engine.stop()
        engine = AVAudioEngine()
        sampleRate = newRate
        lastGraphSampleRate = newRate

        let sourceFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
        let oscillator = BinauralOscillatorNode(parameterBox: parameterBox, format: sourceFormat)
        oscillatorNode = oscillator

        engine.attach(oscillator.sourceNode)
        #if targetEnvironment(simulator)
        // Peak limiter can pump/click on Simulator; soft limiting is already in the source node.
        engine.connect(oscillator.sourceNode, to: engine.mainMixerNode, format: sourceFormat)
        #else
        limiter = Self.makeLimiterNode()
        engine.attach(limiter)
        engine.connect(oscillator.sourceNode, to: limiter, format: sourceFormat)
        engine.connect(limiter, to: engine.mainMixerNode, format: sourceFormat)
        #endif
        engine.mainMixerNode.outputVolume = 1.0
        engine.prepare()
    }

    private func wireSessionCallbacks() {
        sessionController.onInterruptionBegan = { [weak self] in
            self?.controlQueue.async {
                guard let self else { return }
                self.parameterBox.setPlayIntent(false)
                self.engine.pause()
                self.stopPositionTimer()
                self.transition(to: .interrupted)
            }
        }
        sessionController.onInterruptionEnded = { [weak self] shouldResume in
            self?.controlQueue.async {
                guard let self else { return }
                if shouldResume && self.userPlayIntent {
                    self.rebuildGraph()
                    self.play()
                } else {
                    self.transition(to: .paused)
                }
            }
        }
        sessionController.onRouteChanged = { [weak self] in
            self?.controlQueue.async {
                guard let self else { return }
                self.routeRebuildWorkItem?.cancel()
                let work = DispatchWorkItem { [weak self] in
                    guard let self else { return }
                    let wasRunning = self.engine.isRunning
                    self.rebuildGraph()
                    guard self.userPlayIntent, wasRunning else {
                        if !self.userPlayIntent {
                            self.transition(to: .ready)
                        }
                        return
                    }
                    do {
                        try self.engine.start()
                        self.transition(to: .playing)
                    } catch {
                        self.fail(code: "ios_engine_route_restart_failed", message: String(describing: error))
                    }
                }
                self.routeRebuildWorkItem = work
                self.controlQueue.asyncAfter(deadline: .now() + .milliseconds(500), execute: work)
            }
        }
        sessionController.onMediaServicesReset = { [weak self] in
            self?.controlQueue.async {
                guard let self else { return }
                self.transition(to: .rebuilding)
                self.rebuildGraph()
                if self.userPlayIntent { self.play() } else { self.transition(to: .ready) }
            }
        }
        sessionController.onHighVolumeWarning = { [weak self] in
            DispatchQueue.main.async { self?.onHighVolumeWarning?() }
        }
    }

    private func transition(to newState: EngineState) {
        engineState = newState
        let sr = sampleRate
        let route = sessionController.outputRoute.rawValue
        DispatchQueue.main.async { [weak self] in
            self?.onState?(newState, sr, route)
        }
    }

    private func fail(code: String, message: String) {
        engineState = .error
        DispatchQueue.main.async { [weak self] in
            self?.onError?(code, message)
        }
    }

    private func startPositionTimer() {
        stopPositionTimer()
        let timer = DispatchSource.makeTimerSource(queue: controlQueue)
        timer.schedule(deadline: .now() + 1, repeating: 1.0)
        timer.setEventHandler { [weak self] in
            guard let self, let start = self.sessionStartDate else { return }
            let elapsed = Date().timeIntervalSince(start)
            DispatchQueue.main.async { self.onPosition?(elapsed) }
        }
        timer.resume()
        positionTimer = timer
    }

    private func stopPositionTimer() {
        positionTimer?.cancel()
        positionTimer = nil
    }

    private static func makeLimiterNode() -> AVAudioUnitEffect {
        let desc = AudioComponentDescription(
            componentType: kAudioUnitType_Effect,
            componentSubType: kAudioUnitSubType_PeakLimiter,
            componentManufacturer: kAudioUnitManufacturer_Apple,
            componentFlags: 0,
            componentFlagsMask: 0
        )
        return AVAudioUnitEffect(audioComponentDescription: desc)
    }
}
