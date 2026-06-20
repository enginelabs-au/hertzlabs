#!/usr/bin/env ruby
# Merge libs/maccatalyst/*.xcframework slices into libs/ios/*.xcframework for Mac Catalyst linking.
# Run after building Skia with: yarn build-skia apple-maccatalyst (MACCATALYST=true).
require 'fileutils'

SKIA_ROOT = ARGV[0] || File.expand_path('../../node_modules/@shopify/react-native-skia', __dir__)
IOS_LIBS = if File.basename(SKIA_ROOT) == 'react-native-skia-apple-ios'
             File.join(SKIA_ROOT, 'libs')
           else
             File.join(SKIA_ROOT, 'libs', 'ios')
           end
MAC_LIBS = if File.directory?(File.join(SKIA_ROOT, 'libs', 'maccatalyst'))
             File.join(SKIA_ROOT, 'libs', 'maccatalyst')
           else
             File.expand_path('../../build/skia-maccatalyst-src/packages/skia/libs/maccatalyst', __dir__)
           end
CATALYST_ID = 'ios-arm64_x86_64-maccatalyst'

unless File.directory?(MAC_LIBS)
  abort <<~MSG
    ERROR: #{MAC_LIBS} not found.
    Build Mac Catalyst Skia first:
      bash scripts/build-skia-maccatalyst.sh
  MSG
end

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

Dir.glob(File.join(MAC_LIBS, '*.xcframework')).each do |mac_xcfw|
  name = File.basename(mac_xcfw, '.xcframework')
  ios_xcfw = File.join(IOS_LIBS, "#{name}.xcframework")
  next unless File.directory?(ios_xcfw)

  mac_lib = File.join(mac_xcfw, CATALYST_ID, "#{name}.a")
  mac_lib = File.join(mac_xcfw, 'maccatalyst', "#{name}.a") unless File.exist?(mac_lib)
  unless File.exist?(mac_lib)
    mac_lib = Dir.glob(File.join(mac_xcfw, '**', "#{name}.a")).find { |p| !p.include?('simulator') }
  end
  unless mac_lib && File.exist?(mac_lib)
    warn "  [skip] no maccatalyst binary for #{name}"
    next
  end

  dst_dir = File.join(ios_xcfw, CATALYST_ID)
  FileUtils.rm_rf(dst_dir)
  FileUtils.mkdir_p(dst_dir)
  FileUtils.cp(mac_lib, File.join(dst_dir, "#{name}.a"))
  add_catalyst_entry(File.join(ios_xcfw, 'Info.plist'), name)
  puts "  [skia merge] #{name}.xcframework + #{CATALYST_ID}"
end

puts 'Done merging Mac Catalyst Skia into iOS xcframeworks.'
