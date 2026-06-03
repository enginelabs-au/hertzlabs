cmake_minimum_required(VERSION 3.22.1)

project(hertz_audio CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# Oboe
# The Oboe AAR exposes a CMake package config; Gradle passes the location via
# the externalNativeBuild > cmake > arguments block in build.gradle.
# ---------------------------------------------------------------------------
find_package(oboe REQUIRED CONFIG)

# ---------------------------------------------------------------------------
# Native shared library
# ---------------------------------------------------------------------------
add_library(
    hertz_audio
    SHARED
    BinauralOscillator.cpp
    HertzAudioEngine.cpp
    NoiseGenerator.cpp
    jni/HertzAudioJni.cpp
)

target_include_directories(hertz_audio PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# ---------------------------------------------------------------------------
# Compiler flags
# -O3              : maximum scalar optimisation (safe on well-defined C++)
# -fno-exceptions  : eliminate EH overhead in the render path (no throws in
#                    audio callbacks; JNI layer catches at the Java boundary)
# -fno-rtti        : no dynamic_cast / typeid in the audio path
# ---------------------------------------------------------------------------
target_compile_options(hertz_audio PRIVATE
    -O3
    -fno-exceptions
    -fno-rtti
)

# ---------------------------------------------------------------------------
# System library dependencies
#   oboe::oboe  — Oboe audio abstraction (wraps AAudio / OpenSL ES)
#   android     — NDK Android platform APIs
#   log         — __android_log_print (used outside the render path only)
#   OpenSLES    — Oboe's OpenSL ES backend on older API levels
# ---------------------------------------------------------------------------
target_link_libraries(
    hertz_audio
    oboe::oboe
    android
    log
    OpenSLES
)
