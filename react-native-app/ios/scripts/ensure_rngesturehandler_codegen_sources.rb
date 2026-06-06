#!/usr/bin/env ruby
# Ensures Fabric component .cpp files are in ReactCodegen Compile Sources.
# Run after `pod install` if Xcode reports undefined RNGestureHandler* / Skia* symbols.

require 'xcodeproj'

ios_dir = File.expand_path('..', __dir__)
pods_project = File.join(ios_dir, 'Pods', 'Pods.xcodeproj')
components_root = File.join(
  ios_dir, 'build', 'generated', 'ios', 'ReactCodegen',
  'react', 'renderer', 'components'
)

FABRIC_COMPONENTS = %w[
  rngesturehandler_codegen
  rnskia
  ReactNativeBlurViewSpec
].freeze

FABRIC_CPPS = %w[
  Props.cpp EventEmitters.cpp ShadowNodes.cpp ComponentDescriptors.cpp States.cpp
].freeze

unless File.directory?(components_root)
  warn "Missing codegen dir: #{components_root}"
  warn "Run: cd react-native-app && npm run sync:codegen && cd ios && pod install"
  exit 1
end

proj = Xcodeproj::Project.open(pods_project)
target = proj.targets.find { |t| t.name == 'ReactCodegen' }
abort 'ReactCodegen target not found' unless target

sp = target.source_build_phase
cpp_flags = '-DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -DFOLLY_CFG_NO_COROUTINES=1 ' \
            '-DFOLLY_HAVE_CLOCK_GETTIME=1 -Wno-comma -Wno-shorten-64-to-32 ' \
            '-Wno-documentation -Wno-nullability-completeness -std=c++20'

added = 0
FABRIC_COMPONENTS.each do |component|
  component_dir = File.join(components_root, component)
  next unless File.directory?(component_dir)

  FABRIC_CPPS.each do |fname|
    fpath = File.join(component_dir, fname)
    next unless File.exist?(fpath)
    canonical = File.realpath(fpath)

    in_sources = sp.files.any? do |bf|
      p = bf.file_ref&.real_path&.to_s
      p && File.realpath(p) == canonical
    rescue StandardError
      false
    end
    next if in_sources

    file_ref = proj.files.find do |f|
      p = f.real_path&.to_s
      p && File.realpath(p) == canonical
    rescue StandardError
      false
    end
    file_ref ||= proj.new_file(fpath)
    bf = sp.add_file_reference(file_ref)
    bf.settings = { 'COMPILER_FLAGS' => cpp_flags }
    puts "ReactCodegen + #{component}/#{fname}"
    added += 1
  end
end

# Dedupe by real path (rnskia duplicate rows, etc.)
target.build_phases.each do |phase|
  next unless phase.is_a?(Xcodeproj::Project::Object::PBXSourcesBuildPhase) ||
              phase.is_a?(Xcodeproj::Project::Object::PBXHeadersBuildPhase)
  seen = {}
  phase.files.to_a.each do |build_file|
    path = build_file.file_ref&.real_path&.to_s
    next if path.nil? || path.empty?
    if seen[path]
      phase.files.delete(build_file)
    else
      seen[path] = true
    end
  end
end

proj.save
puts added.zero? ? 'Fabric component sources already present' : "Added #{added} source(s)"
