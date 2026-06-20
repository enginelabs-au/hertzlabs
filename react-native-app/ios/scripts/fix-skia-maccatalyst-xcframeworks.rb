#!/usr/bin/env ruby
# Add Mac Catalyst slices to react-native-skia xcframeworks (npm prebuilts ship iOS-only).
require 'fileutils'

SKIA_LIBS = %w[
  libskia libsvg libskshaper libskparagraph libskunicode_core
  libskunicode_libgrapheme libskottie libsksg
].freeze

SKIA_ROOT = File.expand_path('../../node_modules/@shopify/react-native-skia/libs/ios', __dir__)
CATALYST_ID = 'ios-arm64_x86_64-maccatalyst'
SOURCE_ID = 'ios-arm64_arm64e'

def add_catalyst_entry(plist_path, lib_name)
  content = File.read(plist_path)
  return if content.include?(CATALYST_ID)

  catalyst_dict = <<~PLIST
\t\t<dict>
\t\t\t<key>BinaryPath</key>
\t\t\t<string>#{lib_name}.a</string>
\t\t\t<key>LibraryIdentifier</key>
\t\t\t<string>#{CATALYST_ID}</string>
\t\t\t<key>LibraryPath</key>
\t\t\t<string>#{lib_name}.a</string>
\t\t\t<key>SupportedArchitectures</key>
\t\t\t<array>
\t\t\t\t<string>arm64</string>
\t\t\t\t<string>x86_64</string>
\t\t\t</array>
\t\t\t<key>SupportedPlatform</key>
\t\t\t<string>ios</string>
\t\t\t<key>SupportedPlatformVariant</key>
\t\t\t<string>maccatalyst</string>
\t\t</dict>
  PLIST

  marker = "\t</array>\n\t<key>CFBundlePackageType</key>"
  unless content.include?(marker)
    raise "Unexpected Info.plist layout in #{plist_path}"
  end

  File.write(plist_path, content.sub(marker, "#{catalyst_dict}\t</array>\n\t<key>CFBundlePackageType</key>"))
end

SKIA_LIBS.each do |name|
  xcfw = File.join(SKIA_ROOT, "#{name}.xcframework")
  next unless File.directory?(xcfw)

  src_dir = File.join(xcfw, SOURCE_ID)
  dst_dir = File.join(xcfw, CATALYST_ID)
  next unless File.directory?(src_dir)

  FileUtils.rm_rf(dst_dir) if File.directory?(dst_dir)
  FileUtils.cp_r(src_dir, dst_dir)
  add_catalyst_entry(File.join(xcfw, 'Info.plist'), name)
  puts "  [skia catalyst] #{name}.xcframework + #{CATALYST_ID}"
end
