#pragma once

// ParameterBox.h — lock-free atomic parameter container (header-only).
//
// JNI control threads call store() to publish new targets.
// The Oboe audio render callback calls load() once per quantum.
// No mutexes, no locks, no heap allocations on the render path.

#include <algorithm>
#include <atomic>
#include <cmath>

// Published parameter snapshot. All values are validated and clamped before
// storage; the render thread reads this struct but never writes it.
struct AudioParams {
    double carrierHz = 200.0;  // carrier frequency (Hz)
    double beatHz    = 10.0;   // binaural beat frequency (Hz), clamped in store()
    float  gain      = 0.5f;   // linear gain, clamped [0.0, 0.501187]  (−6 dBFS ceiling)
    float  balance   = 0.0f;   // stereo balance, clamped [−1.0, +1.0]
};

class ParameterBox {
public:
    // Verify pointer atomics are always lock-free so the render path is safe.
    static_assert(std::atomic<AudioParams*>::is_always_lock_free,
                  "std::atomic<AudioParams*> must be lock-free on this platform");

    ParameterBox() {
        slots_[0] = AudioParams{};
        slots_[1] = AudioParams{};
        current_.store(&slots_[0], std::memory_order_relaxed);
    }

    // Write a new parameter set.  Called on JNI / control threads only.
    // Silently ignores non-finite inputs to preserve the last valid snapshot.
    void store(const AudioParams& p) {
        if (!std::isfinite(p.carrierHz) || !std::isfinite(p.beatHz) ||
            !std::isfinite(p.gain)      || !std::isfinite(p.balance)) {
            return;
        }

        // Identify the inactive slot (the one the render thread is NOT reading).
        AudioParams* active   = current_.load(std::memory_order_acquire);
        AudioParams* inactive = (active == &slots_[0]) ? &slots_[1] : &slots_[0];

        // Write clamped values into the inactive slot before publishing.
        inactive->carrierHz = std::clamp(p.carrierHz, 0.001, 1'000'000.0);
        inactive->beatHz    = std::clamp(p.beatHz, 1e-18, 1'000'000.0);
        inactive->gain      = std::clamp(p.gain,   0.0f, 0.501187f);
        inactive->balance   = std::clamp(p.balance, -1.0f, 1.0f);

        // Atomically publish the inactive slot.  Release ensures all writes
        // above are visible to any subsequent acquire-load on the render thread.
        current_.store(inactive, std::memory_order_release);
    }

    // Read the current parameter snapshot.  Called on the audio render thread.
    // Acquire ordering pairs with the release in store().
    AudioParams load() const {
        return *current_.load(std::memory_order_acquire);
    }

private:
    AudioParams              slots_[2];
    std::atomic<AudioParams*> current_{nullptr};  // initialised in constructor
};
