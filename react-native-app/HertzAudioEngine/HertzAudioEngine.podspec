Pod::Spec.new do |s|
  s.name = 'HertzAudioEngine'
  s.version = '0.1.0'
  s.summary = 'Native iOS audio engine for Hertz Labs binaural synthesis.'
  s.homepage = 'https://hertzlabs.local'
  s.license = { :type => 'Proprietary' }
  s.author = { 'Hertz Labs' => 'engineering@hertzlabs.local' }
  s.platform = :ios, '15.0'
  s.vendored_frameworks = 'build/HertzAudioEngine.xcframework'
end
