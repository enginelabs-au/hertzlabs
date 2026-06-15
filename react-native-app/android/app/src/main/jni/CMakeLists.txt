cmake_minimum_required(VERSION 3.13)

# RN New Architecture entrypoint — produces libappmodules.so
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Oboe binaural engine — separate .so loaded via System.loadLibrary("hertz_audio")
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../cpp ${CMAKE_BINARY_DIR}/hertz_audio)
