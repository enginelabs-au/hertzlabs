#pragma once

#include <algorithm>
#include <cstdint>

namespace hertz {

class NoiseGenerator {
public:
    void setLevel(float level);
    float nextSample();

private:
    float level_ = 0.0f;
    uint32_t state_ = 0x12345678u;
};

} // namespace hertz
