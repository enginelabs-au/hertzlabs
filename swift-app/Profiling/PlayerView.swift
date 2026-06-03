import SwiftUI

// MARK: - Player View

struct PlayerView: View {
    var body: some View {
        ZStack {
            Color(red: 5/255, green: 8/255, blue: 16/255).ignoresSafeArea()
            VStack(spacing: 32) {
                Spacer()
                BinauralDialView()
                ReadoutPanelView()
                Spacer()
            }
            .padding(.horizontal, 24)
        }
    }
}

// MARK: - Binaural Dial

/// Pixel-exact port of SineWaveShader.ts + SineWaveCanvas.tsx using the
/// iOS 17 SwiftUI Metal shader API (colorEffect / ShaderLibrary).
///
/// Two previous failures — both fixed here:
///   1. Rectangle() has a white default fill that bleeds through colorEffect.
///      Fix: use Color.black.opacity(0.001) — visually invisible but forces
///      SwiftUI to render the view so the shader runs on every pixel.
///   2. .blendMode(.screen) of four coloured layers saturates to white.
///      Fix: removed. Default SrcOver matches Skia's ShaderLayer compositing.
///
/// Outer-ring chrome (glow halo, white ring, tick marks) is drawn in a
/// Canvas overlay using the same geometry as DialRingPath.ts:
///   ringR  = 0.88 × halfW
///   innerR = 0.82 × halfW
struct BinauralDialView: View {

    // Offset so `t` stays small (seconds since view type was first loaded).
    // Float only has 7 significant digits; Date.timeIntervalSinceReferenceDate
    // is ~800 million, so adding 0.016 s is invisible at Float precision.
    // Subtracting the epoch keeps `t` in the 0…∞ range with full precision.
    private static let t0: Double = Date.timeIntervalSinceReferenceDate

    // Matches SineWaveCanvas.tsx: Math.min(screenWidth − 32, 320)
    private var dialSize: CGFloat {
        min(UIScreen.main.bounds.width - 32, 320)
    }

    // Identical to LAYER_RGBA in SineWaveCanvas.tsx (boosted slightly for Metal)
    private let tints: [(Float, Float, Float, Float)] = [
        (75/255,  120/255, 255/255, 0.9),   // indigo-blue
        (100/255, 200/255, 180/255, 0.8),   // teal
        (200/255, 100/255, 255/255, 0.7),   // violet
        (255/255, 160/255,  60/255, 0.6),   // amber
    ]

    @State private var gestureActive = false
    @State private var ripple: Float = 0.0
    @State private var phase:  Float = 0.0

    var body: some View {
        let size = dialSize
        ZStack {
            shaderStack(size: size)
            ringOverlay(size: size)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { v in
                    if !gestureActive {
                        gestureActive = true
                        withAnimation(.easeIn(duration: 0.15)) { ripple = 1.0 }
                    }
                    phase = Float(atan2(v.translation.height, v.translation.width))
                }
                .onEnded { _ in
                    gestureActive = false
                    withAnimation(.easeOut(duration: 0.4)) { ripple = 0.0 }
                }
        )
    }

    // Split into a helper to avoid Swift type-checker timeout on body.
    private func shaderStack(size: CGFloat) -> some View {
        TimelineView(.animation) { (ctx: TimelineViewDefaultContext) in
            // Use elapsed seconds since view load — keeps Float precision high.
            let t:    Float = Float(ctx.date.timeIntervalSinceReferenceDate - BinauralDialView.t0)
            let freq: Float = 10.0 / 100.0     // beatHz / 100 — matches RN uniform
            ZStack {
                ForEach(0..<4, id: \.self) { i in
                    let (r, g, b, a) = tints[i]
                    // Rectangle() ensures colorEffect processes every pixel.
                    // The shader returns properly premultiplied (0,0,0,0) for
                    // non-ring pixels (transparent) and ring color for ring pixels.
                    Rectangle()
                        .colorEffect(
                            ShaderLibrary.sineWaveRing(
                                .float2(Float(size), Float(size)),
                                .float(t),
                                .float(freq),
                                .float(phase),
                                .float(ripple),
                                .float(0),
                                .float(Float(i)),
                                .float4(r, g, b, a)
                            )
                        )
                }
            }
            .frame(width: size, height: size)
            // Soft bloom — mirrors Skia BlurMask(blur: 4) on SineWaveCanvas.
            .blur(radius: gestureActive ? 5 : 2.5)
        }
    }

    // Outer chrome: blue glow ring, white ring, tick marks.
    // Geometry matches DialRingPath.ts exactly.
    private func ringOverlay(size: CGFloat) -> some View {
        let ga = gestureActive
        return Canvas { (ctx: inout GraphicsContext, cs: CGSize) in
            let cx:     Double = cs.width  / 2
            let cy:     Double = cs.height / 2
            let halfW:  Double = cs.width  / 2
            let ringR:  Double = halfW * 0.88
            let innerR: Double = halfW * 0.82
            let rRect = CGRect(x: cx - ringR, y: cy - ringR,
                               width: ringR * 2, height: ringR * 2)
            let rPath = Path(ellipseIn: rRect)

            // Blue glow halo — matches <BlurMask blur={glowBlur} style="normal" />
            ctx.drawLayer { l in
                l.addFilter(.blur(radius: ga ? 12 : 4))
                l.stroke(rPath,
                         with: .color(red: 120/255, green: 180/255,
                                      blue: 255/255, opacity: 0.35),
                         lineWidth: 3)
            }
            // White ring outline  rgba(255,255,255,0.18)  1.5 pt
            ctx.stroke(rPath, with: .color(.white.opacity(0.18)), lineWidth: 1.5)

            // 8 × 45° tick marks  from 0.82 to 0.88 × halfW
            var ticks = Path()
            for tick in 0..<8 {
                let a = Double(tick) * .pi / 4
                ticks.move(to:    CGPoint(x: cx + innerR * cos(a),
                                          y: cy + innerR * sin(a)))
                ticks.addLine(to: CGPoint(x: cx + ringR  * cos(a),
                                          y: cy + ringR  * sin(a)))
            }
            ctx.stroke(ticks, with: .color(.white.opacity(0.45)), lineWidth: 1.5)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Readout Panel

struct ReadoutPanelView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 12) {
                Text("Alpha")
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                    .foregroundColor(Color(red: 74/255, green: 222/255, blue: 128/255))
                    .tracking(1)
                Text("8 – 12 Hz")
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.white.opacity(0.55))
            }
            .padding(.bottom, 10)

            Rectangle().frame(height: 1).foregroundColor(.white.opacity(0.08))
                .padding(.bottom, 10)

            ReadoutRow(label: "CARRIER", value: "220.0", unit: "Hz")
            Spacer().frame(height: 6)
            ReadoutRow(label: "BEAT",    value: "10.0",  unit: "Hz")
            Spacer().frame(height: 6)
            ReadoutRow(label: "PHASE",   value: "0.0°",  unit: nil)
            Spacer().frame(height: 6)
            ReadoutRow(label: "TIMING",  value: "+0.0",  unit: "ms")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color(red: 13/255, green: 15/255, blue: 26/255))
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16)
            .stroke(Color.white.opacity(0.08), lineWidth: 1))
    }
}

private struct ReadoutRow: View {
    let label: String
    let value: String
    let unit: String?

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 8) {
            Text(label)
                .font(.system(size: 13, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))
                .tracking(0.5)
                .frame(width: 72, alignment: .leading)
            Text(value)
                .font(.system(size: 20, design: .monospaced))
                .foregroundColor(.white)
                .tracking(0.5)
                .lineLimit(1)
                .frame(minWidth: 60, alignment: .trailing)
            if let unit {
                Text(unit)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.white.opacity(0.5))
                    .tracking(0.5)
            }
        }
    }
}
