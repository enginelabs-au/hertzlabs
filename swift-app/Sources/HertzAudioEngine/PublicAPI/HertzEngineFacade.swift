import Foundation

// MARK: - HertzEngineFacade

/// The ONLY public surface of the HertzAudioEngine package.
/// The RN bridge instantiates this class and calls its methods.
/// All other types in this package are internal or private.
@objc(HertzEngineFacade)
public final class HertzEngineFacade: NSObject {

    public weak var delegate: HertzEngineDelegate?

    // Private subsystem references
    private let engine: HertzAudioEngine
    private let telemetry: TelemetryManager
    private let gemini: GeminiClient
    // Strong reference keeps the adapter alive for the telemetry delegate weak var
    private var telemetryAdapter: TelemetryDelegateAdapter?

    // MARK: - Init

    public init(config: EngineConfig) {
        self.engine = HertzAudioEngine(config: config)
        self.telemetry = TelemetryManager()
        self.gemini = GeminiClient()
        super.init()
        wireEngineCallbacks()
        wireTelemetryCallbacks()
    }

    @objc public convenience override init() {
        self.init(config: EngineConfig())
    }

    @objc public convenience init(sampleRate: Double, bufferDurationMs: Double) {
        self.init(config: EngineConfig(
            preferredSampleRate: sampleRate,
            preferredBufferDurationMs: bufferDurationMs
        ))
    }

    // MARK: - Audio control

    @objc(configureWithSampleRate:bufferDurationMs:)
    public func configure(sampleRate: Double, bufferDurationMs: Double) {
        engine.configure(sampleRate: sampleRate, bufferDurationMs: bufferDurationMs)
    }

    @objc public func play() {
        engine.play()
    }

    @objc public func pause() {
        engine.pause()
    }

    @objc public func stop() {
        engine.stop()
        telemetry.stop()
    }

    @objc(setBinauralParametersWithCarrierHz:beatHz:gain:balance:noiseWhite:noisePink:noiseBrown:)
    public func setBinauralParameters(
        carrierHz: Double,
        beatHz: Double,
        gain: Float,
        balance: Float,
        noiseWhite: Float,
        noisePink: Float,
        noiseBrown: Float
    ) {
        engine.setBinauralParameters(
            carrierHz: carrierHz,
            beatHz: beatHz,
            gain: gain,
            balance: balance,
            noiseWhite: noiseWhite,
            noisePink: noisePink,
            noiseBrown: noiseBrown
        )
    }

    @objc(setPhaseAngle:timingDiffMs:)
    public func setPhaseAndTiming(phaseAngle: Double, timingDiffMs: Double) {
        engine.setPhaseAndTiming(phaseAngle: phaseAngle, timingDiffMs: timingDiffMs)
    }

    @objc(setNoiseWithType:level:)
    public func setNoise(type: String, level: Float) {
        engine.setNoise(type: type, level: level)
    }

    @objc(setNoiseLayersWithWhite:pink:brown:)
    public func setNoiseLayers(white: Float, pink: Float, brown: Float) {
        engine.setNoiseLayers(white: white, pink: pink, brown: brown)
    }

    @objc(fadeToGain:durationMs:)
    public func fade(toGain: Float, durationMs: Int) {
        engine.fade(toGain: toGain, durationMs: durationMs)
    }

    @objc public func loadPreset(_ presetJson: String) {
        engine.loadPreset(presetJson)
    }

    // MARK: - AI

    /// Generates a session plan from a free-text prompt via Gemini.
    /// Falls back to RegexFallback on any network/parse failure.
    public func generateSession(prompt: String) async throws -> SessionPlan {
        DispatchQueue.main.async { self.delegate?.onAIStatus("loading") }
        do {
            let plan = try await gemini.generateSession(prompt: prompt)
            DispatchQueue.main.async { self.delegate?.onAIStatus("done") }
            return plan
        } catch {
            DispatchQueue.main.async { self.delegate?.onAIStatus("error") }
            // Last-resort offline fallback
            return try RegexFallback.extract(from: prompt)
        }
    }

    // MARK: - Telemetry

    public func startTelemetry() {
        telemetry.start()
    }

    public func stopTelemetry() {
        telemetry.stop()
    }

    // MARK: - Private wiring

    private func wireEngineCallbacks() {
        engine.onState = { [weak self] state, sampleRate, route in
            // Already dispatched to main by HertzAudioEngine
            self?.delegate?.onEngineState(state.rawValue, sampleRate: sampleRate, route: route)
        }
        engine.onPosition = { [weak self] elapsedSec in
            self?.delegate?.onPosition(elapsedSec: elapsedSec)
        }
        engine.onError = { [weak self] code, message in
            self?.delegate?.onError(code: code, message: message)
        }
        engine.onHighVolumeWarning = { [weak self] in
            self?.delegate?.onHighVolumeWarning()
        }
    }

    private func wireTelemetryCallbacks() {
        let adapter = TelemetryDelegateAdapter(facade: self)
        telemetryAdapter = adapter
        telemetry.delegate = adapter
    }
}

// MARK: - Telemetry delegate adapter (internal bridge)

/// Thin internal class so TelemetryManager can call back without a public dependency on HertzEngineFacade.
private final class TelemetryDelegateAdapter: TelemetryManagerDelegate {
    weak var facade: HertzEngineFacade?

    init(facade: HertzEngineFacade) {
        self.facade = facade
    }

    func telemetryDidUpdate(_ reading: SensorReading) {
        // Forward raw reading to engine for AI orchestration if needed.
        // Delegate callbacks for individual sensor channels are handled by the RN bridge layer.
        _ = reading
    }

    func telemetryDidEnterSleep() {
        DispatchQueue.main.async { [weak self] in
            self?.facade?.delegate?.onIdleAutoSleep()
        }
    }
}
