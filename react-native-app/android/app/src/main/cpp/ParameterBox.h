#pragma once

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>

namespace hertz {

constexpr float kPeakCeilingLinear = 0.501187f;
constexpr double kDefaultRampMs = 75.0;

struct ParameterSnapshot {
    double targetCarrierHz = 200.0;
    double targetBeatHz = 10.0;
    float targetGain = 0.0f;
    float targetBalance = 0.0f;
    double targetPhaseAngle = 0.0;
    double targetTimingDiffMs = 0.0;
    bool playIntent = false;
    float noiseWhiteGain = 0.0f;
    float noisePinkGain = 0.0f;
    float noiseBrownGain = 0.0f;
    uint64_t generationCounter = 0;
};

class ParameterBox {
public:
    ParameterBox() {
        slots_[0] = ParameterSnapshot{};
        slots_[1] = ParameterSnapshot{};
        publishedIndex_.store(0, std::memory_order_relaxed);
        nextGeneration_.store(1, std::memory_order_relaxed);
    }

    ParameterSnapshot snapshot() const {
        const int idx = publishedIndex_.load(std::memory_order_acquire);
        return slots_[idx];
    }

    bool publish(double carrierHz,
                 double beatHz,
                 float gain,
                 float balance,
                 double /*rampDurationMs*/,
                 bool playIntent) {
        if (!std::isfinite(carrierHz) || !std::isfinite(beatHz) ||
            !std::isfinite(gain) || !std::isfinite(balance)) {
            return false;
        }

        const int currentIdx = publishedIndex_.load(std::memory_order_acquire);
        const int writeIdx = 1 - currentIdx;
        ParameterSnapshot s = slots_[currentIdx];
        s.targetCarrierHz = std::clamp(carrierHz, 0.001, 1'000'000.0);
        s.targetBeatHz = std::clamp(beatHz, 1e-18, 1'000'000.0);
        s.targetGain = std::clamp(gain, 0.0f, 1.0f);
        s.targetBalance = std::clamp(balance, -1.0f, 1.0f);
        s.playIntent = playIntent;
        s.generationCounter = nextGeneration_.fetch_add(1, std::memory_order_relaxed);
        slots_[writeIdx] = s;
        publishedIndex_.store(writeIdx, std::memory_order_release);
        return true;
    }

    void setPlayIntent(bool intent) {
        const int currentIdx = publishedIndex_.load(std::memory_order_acquire);
        const int writeIdx = 1 - currentIdx;
        ParameterSnapshot s = slots_[currentIdx];
        s.playIntent = intent;
        s.generationCounter = nextGeneration_.fetch_add(1, std::memory_order_relaxed);
        slots_[writeIdx] = s;
        publishedIndex_.store(writeIdx, std::memory_order_release);
    }

    void setNoiseLevel(float level) {
        setNoiseLayers(level, 0.0f, 0.0f);
    }

    void setNoiseLayers(float white, float pink, float brown) {
        const int currentIdx = publishedIndex_.load(std::memory_order_acquire);
        const int writeIdx = 1 - currentIdx;
        ParameterSnapshot s = slots_[currentIdx];
        s.noiseWhiteGain = std::clamp(white, 0.0f, kPeakCeilingLinear);
        s.noisePinkGain = std::clamp(pink, 0.0f, kPeakCeilingLinear);
        s.noiseBrownGain = std::clamp(brown, 0.0f, kPeakCeilingLinear);
        s.generationCounter = nextGeneration_.fetch_add(1, std::memory_order_relaxed);
        slots_[writeIdx] = s;
        publishedIndex_.store(writeIdx, std::memory_order_release);
    }

    void setPhaseAndTiming(double phaseAngleDeg, double timingDiffMs) {
        const int currentIdx = publishedIndex_.load(std::memory_order_acquire);
        const int writeIdx = 1 - currentIdx;
        ParameterSnapshot s = slots_[currentIdx];
        s.targetPhaseAngle = std::clamp(phaseAngleDeg, 0.0, 360.0);
        s.targetTimingDiffMs = std::clamp(timingDiffMs, -500.0, 500.0);
        s.generationCounter = nextGeneration_.fetch_add(1, std::memory_order_relaxed);
        slots_[writeIdx] = s;
        publishedIndex_.store(writeIdx, std::memory_order_release);
    }

private:
    ParameterSnapshot slots_[2]{};
    std::atomic<int> publishedIndex_{0};
    std::atomic<uint64_t> nextGeneration_{1};
};

} // namespace hertz
