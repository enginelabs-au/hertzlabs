#import "HertzAudioEventSink.h"
#import "HertzAudioNativeEngine.h"

#import <ReactCommon/RCTTurboModule.h>
#import <HertzLabsBinauralBeatsSpec/HertzLabsBinauralBeatsSpec.h>

static NSString *const kHertzAudioShouldStopNotification = @"HertzAudioShouldStop";

@interface HertzAudioModule : NativeHertzAudioSpecBase <NativeHertzAudioSpec, HertzAudioEventSink>
@property(nonatomic, strong) HertzAudioNativeEngine *nativeEngine;
@property(nonatomic, assign) BOOL eventEmitterReady;
@end

@implementation HertzAudioModule

RCT_EXPORT_MODULE(HertzAudio)

- (instancetype)init
{
  if (self = [super init]) {
    _nativeEngine = [[HertzAudioNativeEngine alloc] init];
    _nativeEngine.eventSink = self;
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleShouldStop:)
                                                 name:kHertzAudioShouldStopNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleShouldStop:(NSNotification *)notification
{
  (void)notification;
  [self pause];
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)eventEmitterCallbackWrapper
{
  [super setEventEmitterCallback:eventEmitterCallbackWrapper];
  self.eventEmitterReady = YES;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHertzAudioSpecJSI>(params);
}

#pragma mark - NativeHertzAudioSpec

- (void)configure:(double)sampleRate bufferDurationMs:(double)bufferDurationMs
{
  NSLog(@"[HertzAudioModule] configure %.0f %.1f", sampleRate, bufferDurationMs);
  [self.nativeEngine configureWithSampleRate:sampleRate bufferDurationMs:bufferDurationMs];
}

- (void)play
{
  NSLog(@"[HertzAudioModule] play");
  [self.nativeEngine play];
}

- (void)pause
{
  [self.nativeEngine pause];
}

- (void)stop
{
  [self.nativeEngine stop];
}

- (void)setBinauralParameters:(double)carrierHz
                       beatHz:(double)beatHz
                         gain:(double)gain
                      balance:(double)balance
                   noiseWhite:(double)noiseWhite
                    noisePink:(double)noisePink
                   noiseBrown:(double)noiseBrown
{
  [self.nativeEngine setBinauralParametersWithCarrierHz:carrierHz
                                                 beatHz:beatHz
                                                   gain:(float)gain
                                                balance:(float)balance
                                              noiseWhite:(float)noiseWhite
                                               noisePink:(float)noisePink
                                              noiseBrown:(float)noiseBrown];
}

- (void)setNoise:(NSString *)type level:(double)level
{
  [self.nativeEngine setNoiseWithType:type level:(float)level];
}

- (void)setNoiseLayers:(double)white pink:(double)pink brown:(double)brown
{
  [self.nativeEngine setNoiseLayersWithWhite:(float)white pink:(float)pink brown:(float)brown];
}

- (void)fade:(double)toGain durationMs:(double)durationMs
{
  [self.nativeEngine fadeToGain:(float)toGain durationMs:(NSInteger)durationMs];
}

- (void)loadPreset:(NSString *)presetJson
{
  (void)presetJson;
}

- (void)setPhaseAndTiming:(double)phase timingMs:(double)timingMs
{
  [self.nativeEngine setPhaseAndTimingWithPhase:phase timingMs:timingMs];
}

#pragma mark - HertzAudioEventSink

- (void)emitEngineStateWithState:(NSString *)state
                     sampleRate:(double)sampleRate
                          route:(NSString *)route
{
  if (!self.eventEmitterReady) {
    return;
  }
  [self emitOnEngineState:@{
    @"state" : state,
    @"sampleRate" : @(sampleRate),
    @"route" : route,
  }];
}

- (void)emitPositionWithElapsedSec:(double)elapsedSec
{
  if (!self.eventEmitterReady) {
    return;
  }
  [self emitOnPosition:@{@"elapsedSec" : @(elapsedSec)}];
}

- (void)emitErrorWithCode:(NSString *)code message:(NSString *)message
{
  if (!self.eventEmitterReady) {
    NSLog(@"[HertzAudioModule] error (no emitter): %@ %@", code, message);
    return;
  }
  [self emitOnError:@{@"code" : code, @"message" : message}];
}

@end
