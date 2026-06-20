#!/usr/bin/env ruby
# Fix RN 0.84+ prebuilt xcframework bundle layout for Mac Catalyst builds.
# See: https://github.com/facebook/react-native/issues/55540

require 'fileutils'

IOS_ROOT = File.expand_path('..', __dir__)

def fix_versioned_framework!(framework_dir, binary_name)
  return unless File.directory?(framework_dir)

  versions_dir = File.join(framework_dir, 'Versions')
  return unless File.directory?(versions_dir)

  current_link = File.join(versions_dir, 'Current')
  a_dir = File.join(versions_dir, 'A')
  if File.directory?(a_dir)
    ok = File.symlink?(current_link) && File.readlink(current_link) == 'A'
    unless ok
      FileUtils.rm_rf(current_link)
      FileUtils.ln_s('A', current_link)
    end
  end

  resources_link = File.join(framework_dir, 'Resources')
  unless File.symlink?(resources_link)
    FileUtils.rm_rf(resources_link) if File.exist?(resources_link)
    FileUtils.ln_s('Versions/Current/Resources', resources_link)
  end

  binary_link = File.join(framework_dir, binary_name)
  unless File.symlink?(binary_link)
    FileUtils.rm_f(binary_link) if File.exist?(binary_link)
    FileUtils.ln_s("Versions/Current/#{binary_name}", binary_link)
  end

  resources_target = File.join(framework_dir, 'Versions', 'Current', 'Resources')
  FileUtils.mkdir_p(resources_target)
  Dir[File.join(framework_dir, "#{binary_name}_*.bundle")].each do |bundle|
    dest = File.join(resources_target, File.basename(bundle))
    next if File.exist?(dest)

    FileUtils.mv(bundle, dest)
    puts "  [maccatalyst fix] Moved #{File.basename(bundle)} → Resources/"
  end
end

# Do not rewrite React.framework headers — flatten duplicate Versions/ tree so codesign
# does not fail with "bundle format is ambiguous" during [CP] Embed Pods Frameworks.
frameworks = [
  [
    File.join(
      IOS_ROOT, 'Pods', 'React-Core-prebuilt', 'React.xcframework',
      'ios-arm64_x86_64-maccatalyst', 'React.framework'
    ),
    'React',
    :normalize_versioned,
  ],
  [
    File.join(
      IOS_ROOT, 'Pods', 'ReactNativeDependencies', 'framework', 'packages', 'react-native',
      'ReactNativeDependencies.xcframework', 'ios-arm64_x86_64-maccatalyst',
      'ReactNativeDependencies.framework'
    ),
    'ReactNativeDependencies',
    :normalize_versioned,
  ],
]

def normalize_maccatalyst_framework!(framework_dir, binary_name)
  return unless File.directory?(framework_dir)

  versions_dir = File.join(framework_dir, 'Versions')
  a_dir = File.join(versions_dir, 'A')
  unless File.directory?(a_dir)
    flatten_versioned_tree!(framework_dir, binary_name)
    return
  end

  root_binary = File.join(framework_dir, binary_name)
  version_binary = File.join(a_dir, binary_name)
  if File.exist?(root_binary) && !File.symlink?(root_binary)
    FileUtils.rm_f(root_binary)
  end

  root_resources = File.join(framework_dir, 'Resources')
  if File.directory?(root_resources) && !File.symlink?(root_resources)
    FileUtils.rm_rf(root_resources)
  end

  FileUtils.rm_f(File.join(framework_dir, 'Info.plist'))

  fix_versioned_framework!(framework_dir, binary_name)
end

frameworks.each do |path, binary, mode|
  next unless File.directory?(path)

  puts "  [maccatalyst fix] #{File.basename(path)} (#{mode})"
  if mode == :normalize_versioned
    normalize_maccatalyst_framework!(path, binary)
  else
    fix_versioned_framework!(path, binary)
  end
end

if ARGV[0] == '--framework' && ARGV[1]
  path = File.expand_path(ARGV[1])
  if File.directory?(path)
    puts "  [maccatalyst fix] #{path}"
    normalize_maccatalyst_framework!(path, File.basename(path, '.framework'))
  end
elsif ARGV[0] == '--embedded' && ARGV[1]
  embedded_root = File.expand_path(ARGV[1])
  react = File.join(embedded_root, 'React.framework')
  if File.directory?(react)
    puts "  [maccatalyst fix] embedded React.framework"
    normalize_maccatalyst_framework!(react, 'React')
  end
  rdep = File.join(embedded_root, 'ReactNativeDependencies.framework')
  if File.directory?(rdep)
    puts "  [maccatalyst fix] embedded ReactNativeDependencies.framework"
    normalize_maccatalyst_framework!(rdep, 'ReactNativeDependencies')
  end
end
