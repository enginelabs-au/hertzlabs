#!/usr/bin/env ruby
# Patch Skia BUILD.gn for Mac Catalyst-only object files (Shopify/react-native-skia#3838).
require 'fileutils'

build_gn = ARGV[0] || abort("usage: patch-skia-build-gn-maccatalyst.rb PATH/TO/BUILD.gn")
sdk = ARGV[1] || `xcrun --sdk macosx --show-sdk-path`.strip

content = File.read(build_gn)
return if content.include?('arm64-apple-ios14.0-macabi')

old = <<~'GN'.strip
  if (is_mac) {
    # If there was a xcode_sysroot set in args or calculated then use it, else don't set anything
    # because the XCode cc/c++ already know all this stuff.
    if (xcode_sysroot != "") {
      asmflags += [
        "-isysroot",
        xcode_sysroot,
      ]
      cflags += [
        "-isysroot",
        xcode_sysroot,
      ]
      ldflags += [
        "-isysroot",
        xcode_sysroot,
      ]
    }

    # Disable linker warnings.  They're usually just annoyances like,
    #   ld: warning: text-based stub file
    #     /System/Library/Frameworks/foo.framework/foo.tbd and library file
    #     /System/Library/Frameworks/foo.framework/foo are out of sync.
    #     Falling back to library file for linking.
    ldflags += [ "-Wl,-w" ]

    # As of 11/2020, gn is an x86 binary and defaults the host_cpu to x86_64.
    # This allows you to build arm64 mac binaries by setting target_cpu = "arm64"
    if (current_cpu == "arm64") {
      asmflags += [
        "-target",
        "arm64-apple-macos11",
      ]
      cflags += [
        "-target",
        "arm64-apple-macos11",
      ]
      ldflags += [
        "-target",
        "arm64-apple-macos11",
      ]
    } else {
      asmflags += [
        "-target",
        "x86_64-apple-macos11",
      ]
      cflags += [
        "-target",
        "x86_64-apple-macos11",
      ]
      ldflags += [
        "-target",
        "x86_64-apple-macos11",
      ]
    }
  }
GN

new_block = <<~GN
  if (is_mac) {
    if (current_cpu == "arm64") {
      _catalyst_target = "arm64-apple-ios14.0-macabi"
    } else {
      _catalyst_target = "x86_64-apple-ios14.0-macabi"
    }
    asmflags += [
      "-target", _catalyst_target,
      "-isysroot", "#{sdk}",
    ]
    cflags += [
      "-target", _catalyst_target,
      "-isysroot", "#{sdk}",
      "-isystem", "#{sdk}/System/iOSSupport/usr/include",
      "-iframework", "#{sdk}/System/iOSSupport/System/Library/Frameworks",
    ]
    cflags_cc += [ "-stdlib=libc++" ]
    ldflags += [
      "-target", _catalyst_target,
      "-isysroot", "#{sdk}",
      "-iframework", "#{sdk}/System/iOSSupport/System/Library/Frameworks",
      "-stdlib=libc++",
      "-Wl,-w",
    ]
  }
GN

unless content.include?(old)
  abort "BUILD.gn layout changed — manual patch required (#{build_gn})"
end

File.write(build_gn, content.sub(old, new_block.strip))
puts "  [skia patch] BUILD.gn → Mac Catalyst (#{sdk})"
