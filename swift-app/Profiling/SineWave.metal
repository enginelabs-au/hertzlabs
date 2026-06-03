// SineWave.metal
// Exact port of SineWaveShader.ts (SkSL) → Metal Shading Language.
// Used as a SwiftUI colorEffect shader (iOS 17+).
//
// Math is identical to the SkSL original:
//   wave = sin(angle × frequency × freqMult + phase × phaseMult + time × timeScale)
//   dist = |radius − (0.35 + wave×0.04 + rippleWave + warp)|
//   alpha = smoothstep(0.012, 0.002, dist)

#include <metal_stdlib>
#include <SwiftUI/SwiftUI.h>
using namespace metal;

[[stitchable]] half4 sineWaveRing(
    float2      position,   // view-local pixel coords (0…size)
    half4       color,      // existing pixel color from base view
    float2      resolution, // canvas width & height in logical points
    float       time,
    float       frequency,
    float       phase,
    float       ripple,
    float       warpAmount,
    float       layerIndex,
    float4      tintColor
) {
    // Normalise using whichever coordinate scale colorEffect provides.
    // If resolution matches the view's logical size, uv is in [0,1].
    float2 uv     = position / resolution;
    float2 center = float2(0.5, 0.5);
    float2 p      = uv - center;
    float  angle  = atan2(p.y, p.x);
    float  radius = length(p);

    float freqMult  = 1.0 + layerIndex * 0.5;
    float phaseMult = 1.0 - layerIndex * 0.25;

    float wave = sin(
        angle    * frequency * freqMult
        + phase  * phaseMult
        + time   * (1.0 + layerIndex * 0.3)
    );

    float rippleWave = sin(radius * 20.0 - time * 4.0) * ripple * 0.15;
    float warp       = sin(uv.x * 6.2832 + warpAmount) * 0.02;

    float dist     = abs(radius - (0.35 + wave * 0.04 + rippleWave + warp));
    float ringMask = smoothstep(0.012, 0.002, dist);

    // Properly premultiplied output: RGB = straight_color × alpha, A = alpha.
    // Non-ring pixels → (0,0,0,0) transparent; ring pixels → colored.
    float outAlpha = ringMask * tintColor.a;
    return half4(
        half(tintColor.r * outAlpha),
        half(tintColor.g * outAlpha),
        half(tintColor.b * outAlpha),
        half(outAlpha)
    );
}
