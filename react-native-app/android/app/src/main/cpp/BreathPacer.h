#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace hertz {

enum class BreathSegmentKind : uint8_t {
    Inhale = 0,
    HoldPeak = 1,
    Exhale = 2,
    HoldTrough = 3,
};

struct BreathSegmentDef {
    BreathSegmentKind kind;
    float durationSec;
};

class BreathPacer {
public:
    void configure(bool enabled, int patternId, float deltaDb, double sampleRate) {
        const float clampedDelta = std::clamp(deltaDb, 3.0f, 6.0f);
        const bool configChanged =
            enabled != enabled_ || patternId != patternId_ ||
            std::abs(clampedDelta - deltaDb_) > 0.001f;
        enabled_ = enabled;
        patternId_ = std::clamp(patternId, 0, 2);
        deltaDb_ = clampedDelta;
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 48000.0;
        if (configChanged) {
            phaseIndex_ = 0;
            phaseSample_ = 0;
            rebuildSegmentDuration();
        }
    }

    /** Per-sample gain multiplier centered at 1.0 (±deltaDb/2 swing). */
    float advance() {
        if (!enabled_ || segmentCount_ == 0 || phaseDurationSamples_ <= 0) {
            return 1.0f;
        }

        const float progress =
            static_cast<float>(phaseSample_) / static_cast<float>(phaseDurationSamples_);
        const float mult = envelopeAt(currentKind(), progress);

        phaseSample_ += 1;
        if (phaseSample_ >= phaseDurationSamples_) {
            phaseSample_ = 0;
            phaseIndex_ = (phaseIndex_ + 1) % segmentCount_;
            rebuildSegmentDuration();
        }
        return mult;
    }

    void reset() {
        phaseIndex_ = 0;
        phaseSample_ = 0;
        rebuildSegmentDuration();
    }

private:
    static float dbToLinear(float db) {
        return std::pow(10.0f, db / 20.0f);
    }

    static float smooth01(float t) {
        const float x = std::clamp(t, 0.0f, 1.0f);
        return 0.5f - 0.5f * std::cos(x * 3.14159265f);
    }

    BreathSegmentKind currentKind() const {
        return segmentsForPattern(patternId_)[phaseIndex_].kind;
    }

    const BreathSegmentDef *segmentsForPattern(int id) const {
        switch (id) {
        case 1:
            return kPattern478;
        case 2:
            return kPatternResonant;
        case 0:
        default:
            return kPatternBox;
        }
    }

    int segmentCountForPattern(int id) const {
        switch (id) {
        case 1:
            return 3;
        case 2:
            return 2;
        default:
            return 4;
        }
    }

    void rebuildSegmentDuration() {
        segmentCount_ = segmentCountForPattern(patternId_);
        const auto *segments = segmentsForPattern(patternId_);
        const float durSec = segments[phaseIndex_].durationSec;
        phaseDurationSamples_ =
            std::max(1, static_cast<int32_t>(std::lround(durSec * sampleRate_)));
    }

    float envelopeAt(BreathSegmentKind kind, float t) const {
        const float peak = dbToLinear(deltaDb_ * 0.5f);
        const float trough = dbToLinear(-deltaDb_ * 0.5f);
        switch (kind) {
        case BreathSegmentKind::Inhale:
            return trough + (peak - trough) * smooth01(t);
        case BreathSegmentKind::HoldPeak:
            return peak;
        case BreathSegmentKind::Exhale:
            return peak + (trough - peak) * smooth01(t);
        case BreathSegmentKind::HoldTrough:
        default:
            return trough;
        }
    }

    static constexpr BreathSegmentDef kPatternBox[4] = {
        {BreathSegmentKind::Inhale, 4.0f},
        {BreathSegmentKind::HoldPeak, 4.0f},
        {BreathSegmentKind::Exhale, 4.0f},
        {BreathSegmentKind::HoldTrough, 4.0f},
    };

    static constexpr BreathSegmentDef kPattern478[3] = {
        {BreathSegmentKind::Inhale, 4.0f},
        {BreathSegmentKind::HoldPeak, 7.0f},
        {BreathSegmentKind::Exhale, 8.0f},
    };

    static constexpr BreathSegmentDef kPatternResonant[2] = {
        {BreathSegmentKind::Inhale, 5.5f},
        {BreathSegmentKind::Exhale, 5.5f},
    };

    bool enabled_ = false;
    int patternId_ = 0;
    float deltaDb_ = 4.5f;
    double sampleRate_ = 48000.0;
    int phaseIndex_ = 0;
    int32_t phaseSample_ = 0;
    int32_t phaseDurationSamples_ = 1;
    int segmentCount_ = 4;
};

inline constexpr BreathSegmentDef BreathPacer::kPatternBox[4];
inline constexpr BreathSegmentDef BreathPacer::kPattern478[3];
inline constexpr BreathSegmentDef BreathPacer::kPatternResonant[2];

} // namespace hertz
