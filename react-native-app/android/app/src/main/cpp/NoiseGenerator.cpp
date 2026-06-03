#include "NoiseGenerator.h"
#include "ParameterBox.h"

namespace hertz {

void NoiseGenerator::setLevel(float level) {
    level_ = std::clamp(level, 0.0f, kPeakCeilingLinear);
}

float NoiseGenerator::nextSample() {
    state_ = state_ * 1664525u + 1013904223u;
    const auto normalized = static_cast<float>((state_ >> 8) & 0x00FFFFFFu) / 8388607.5f - 1.0f;
    return std::clamp(normalized * level_, -kPeakCeilingLinear, kPeakCeilingLinear);
}

} // namespace hertz
