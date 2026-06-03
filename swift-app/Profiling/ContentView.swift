import SwiftUI
import HertzAudioEngine

// MARK: - Root view

struct ContentView: View {
    @StateObject private var profiler = AudioProfiler()

    var body: some View {
        NavigationStack {
            Form {
                engineSection
                parametersSection
                noiseSection
                controlsSection
            }
            .navigationTitle("Hertz Labs Profiler")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: Engine state

    private var engineSection: some View {
        Section("Engine") {
            LabeledContent("State") {
                Text(profiler.engineState)
                    .foregroundStyle(stateColor(profiler.engineState))
                    .font(.body.monospacedDigit())
            }
            LabeledContent("Route", value: profiler.outputRoute)
            LabeledContent("L channel") {
                Text(String(format: "%.2f Hz", profiler.leftHz))
                    .font(.body.monospacedDigit())
            }
            LabeledContent("R channel") {
                Text(String(format: "%.2f Hz", profiler.rightHz))
                    .font(.body.monospacedDigit())
            }
            if profiler.highVolumeWarning {
                Label("High volume — use headphones carefully", systemImage: "ear.trianglebadge.exclamationmark")
                    .foregroundStyle(.orange)
                    .font(.caption)
            }
        }
    }

    // MARK: Parameters

    private var parametersSection: some View {
        Section("Parameters") {
            SliderRow(
                label: "Carrier",
                value: $profiler.carrierHz,
                range: 80...500,
                format: "%.1f Hz"
            )
            SliderRow(
                label: "Beat Freq",
                value: $profiler.beatHz,
                range: 1...40,
                format: "%.1f Hz"
            )
            SliderRow(
                label: "Gain",
                value: $profiler.gain,
                range: 0...1,
                format: "%.2f"
            )
            SliderRow(
                label: "Balance",
                value: $profiler.balance,
                range: -1...1,
                format: "%.2f"
            )
        }
    }

    // MARK: Noise

    private var noiseSection: some View {
        Section("Noise") {
            Picker("Type", selection: $profiler.noiseType) {
                Text("None").tag("none")
                Text("White").tag("white")
                Text("Pink").tag("pink")
                Text("Brown").tag("brown")
            }
            .pickerStyle(.segmented)
            if profiler.noiseType != "none" {
                SliderRow(
                    label: "Level",
                    value: $profiler.noiseLevel,
                    range: 0...1,
                    format: "%.2f"
                )
            }
        }
    }

    // MARK: Transport controls

    private var controlsSection: some View {
        Section {
            HStack(spacing: 16) {
                Button {
                    profiler.play()
                } label: {
                    Label("Play", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(profiler.engineState == "playing" || profiler.engineState == "starting")

                Button {
                    profiler.pause()
                } label: {
                    Label("Pause", systemImage: "pause.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(profiler.engineState != "playing")

                Button {
                    profiler.stop()
                } label: {
                    Label("Stop", systemImage: "stop.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(profiler.engineState == "stopped" || profiler.engineState == "uninitialized")
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: Helpers

    private func stateColor(_ state: String) -> Color {
        switch state {
        case "playing": return .green
        case "paused", "pausing": return .orange
        case "error": return .red
        case "interrupted": return .yellow
        default: return .secondary
        }
    }
}

// MARK: - Slider row

private struct SliderRow: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let format: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                Spacer()
                Text(String(format: format, value))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: range)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - View model

@MainActor
final class AudioProfiler: ObservableObject {

    // Published UI state
    @Published var engineState  = "uninitialized"
    @Published var outputRoute  = "unknown"
    @Published var highVolumeWarning = false

    // Audio parameters — each change immediately pushes to the engine
    @Published var carrierHz: Double = 220  { didSet { push() } }
    @Published var beatHz:    Double = 10   { didSet { push() } }
    @Published var gain:      Double = 0.7  { didSet { push() } }
    @Published var balance:   Double = 0    { didSet { push() } }
    @Published var noiseType: String = "none" { didSet { pushNoise() } }
    @Published var noiseLevel: Double = 0.2  { didSet { pushNoise() } }

    var leftHz:  Double { max(0.001, carrierHz - beatHz / 2) }
    var rightHz: Double { carrierHz + beatHz / 2 }

    // Private engine objects
    private let facade: HertzEngineFacade
    private let callbackDelegate = CallbackDelegate()

    init() {
        facade = HertzEngineFacade()
        callbackDelegate.onEngineState = { [weak self] state, route in
            guard let self else { return }
            self.engineState = state
            self.outputRoute = route
        }
        callbackDelegate.onVolumeWarning = { [weak self] in
            self?.highVolumeWarning = true
        }
        callbackDelegate.onError = { [weak self] _, _ in
            self?.engineState = "error"
        }
        facade.delegate = callbackDelegate
        facade.configure(sampleRate: 48_000, bufferDurationMs: 5)
        push()
        pushNoise()
    }

    func play()  { facade.play() }
    func pause() { facade.pause() }
    func stop()  { facade.stop() }

    // MARK: Private

    private func push() {
        facade.setBinauralParameters(
            carrierHz: carrierHz,
            beatHz: beatHz,
            gain: Float(gain),
            balance: Float(balance)
        )
    }

    private func pushNoise() {
        facade.setNoise(type: noiseType, level: Float(noiseLevel))
    }
}

// MARK: - Delegate bridge (off-main callbacks → main actor)

private final class CallbackDelegate: HertzEngineDelegate {
    var onEngineState: ((String, String) -> Void)?
    var onVolumeWarning: (() -> Void)?
    var onError: ((String, String) -> Void)?

    func onEngineState(_ state: String, sampleRate: Double, route: String) {
        DispatchQueue.main.async { self.onEngineState?(state, route) }
    }
    func onPosition(elapsedSec: Double) {}
    func onError(code: String, message: String) {
        DispatchQueue.main.async { self.onError?(code, message) }
    }
    func onAIStatus(_ status: String) {}
    func onHighVolumeWarning() {
        DispatchQueue.main.async { self.onVolumeWarning?() }
    }
    func onIdleAutoSleep() {}
    func onRouteChanged(route: String) {
        DispatchQueue.main.async { self.onEngineState?("playing", route) }
    }
}
