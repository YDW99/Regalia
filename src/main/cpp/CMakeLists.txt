# Copyright (C) 2026 Regalia
#
# Build configuration for the engine JNI bridge shared library.
# This CMake file is original — not derived from DroidFish or any GPL v3 source.
# Note: engine_jni.cpp (built by this file) contains DroidFish-derived code under GPL v3.
#
# AI-GEN: AI assisted
# This code was AI-assisted and has been reviewed for AGPL v3 compliance.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

cmake_minimum_required(VERSION 3.22.1)

project("engine_bridge")

# Build the engine JNI bridge as a shared library
add_library(engine_bridge SHARED
    engine_jni.cpp
)

# v1.0.2 REDUNDANCY (audit): removed `dl` link — the dlopen/dlsym engine-loading
# code was deleted from engine_jni.cpp in v1.0.2 (dead since v18.5.0 removed
# engine import). Only nativeChmod and nativeRenice remain, which use only
# libc (sys/stat.h, sys/resource.h) and liblog.
target_link_libraries(engine_bridge
    android
    log
)

# Set C++ standard
target_compile_features(engine_bridge PRIVATE cxx_std_17)

# 16KB page alignment for Android 15+ compatibility
if(ANDROID)
    target_link_options(engine_bridge PRIVATE
        -Wl,--no-warn-mismatch
    )
endif()
