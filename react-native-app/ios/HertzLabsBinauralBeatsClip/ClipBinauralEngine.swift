import AVFoundation
import Foundation

@MainActor
final class ClipBinauralEngine: ObservableObject {
  @Published private(set) var isPlaying = false

  private let engine = AVAudioEngine()
  private nonisolated(unsafe) static var phaseLeft = 0.0
  private nonisolated(unsafe) static var phaseRight = 0.0

  private let stereoSource = AVAudioSourceNode { _, _, frameCount, audioBufferList -> OSStatus in
    let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
    guard abl.count >= 2,
          let leftPtr = abl[0].mData?.assumingMemoryBound(to: Float32.self),
          let rightPtr = abl[1].mData?.assumingMemoryBound(to: Float32.self)
    else { return noErr }

    let carrierHz = 200.0
    let beatHz = 6.0
    let sampleRate = 48_000.0
    let leftHz = carrierHz - beatHz / 2
    let rightHz = carrierHz + beatHz / 2
    let leftStep = 2 * Double.pi * leftHz / sampleRate
    let rightStep = 2 * Double.pi * rightHz / sampleRate
    var leftPhase = ClipBinauralEngine.phaseLeft
    var rightPhase = ClipBinauralEngine.phaseRight

    for frame in 0..<Int(frameCount) {
      leftPtr[frame] = Float32(sin(leftPhase) * 0.22)
      rightPtr[frame] = Float32(sin(rightPhase) * 0.22)
      leftPhase += leftStep
      rightPhase += rightStep
    }

    ClipBinauralEngine.phaseLeft = leftPhase
    ClipBinauralEngine.phaseRight = rightPhase
    return noErr
  }

  init() {
    let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)!
    engine.attach(stereoSource)
    engine.connect(stereoSource, to: engine.mainMixerNode, format: format)
    engine.mainMixerNode.outputVolume = 0.85
  }

  func togglePlayback() {
    if isPlaying {
      engine.pause()
      isPlaying = false
      return
    }
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
      try AVAudioSession.sharedInstance().setActive(true)
      if !engine.isRunning {
        try engine.start()
      }
      engine.mainMixerNode.outputVolume = 0.85
      isPlaying = true
    } catch {
      isPlaying = false
    }
  }

  func stop() {
    engine.pause()
    isPlaying = false
  }
}
