#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@import HertzAudioEngine;

@interface HertzAudioModule : RCTEventEmitter <RCTBridgeModule>
@property(nonatomic, strong) HertzEngineFacade *engine;
@end

@implementation HertzAudioModule

RCT_EXPORT_MODULE(HertzAudio)

- (instancetype)init
{
  if (self = [super init]) {
    _engine = [[HertzEngineFacade alloc] init];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[@"onEngineState", @"onPosition", @"onError"];
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(configure:(double)sampleRate bufferDurationMs:(double)bufferDurationMs)
{
  [self.engine configureWithSampleRate:sampleRate bufferDurationMs:bufferDurationMs];
}

RCT_EXPORT_METHOD(play)
{
  [self.engine play];
}

RCT_EXPORT_METHOD(pause)
{
  [self.engine pause];
}

RCT_EXPORT_METHOD(stop)
{
  [self.engine stop];
}

RCT_EXPORT_METHOD(setBinauralParameters:(double)carrierHz beatHz:(double)beatHz gain:(double)gain balance:(double)balance)
{
  [self.engine setBinauralParametersWithCarrierHz:carrierHz
                                           beatHz:beatHz
                                             gain:(float)gain
                                          balance:(float)balance];
}

RCT_EXPORT_METHOD(setNoise:(NSString *)type level:(double)level)
{
  [self.engine setNoiseWithType:type level:(float)level];
}

RCT_EXPORT_METHOD(fade:(double)toGain durationMs:(double)durationMs)
{
  [self.engine fadeToGain:(float)toGain durationMs:(NSInteger)durationMs];
}

RCT_EXPORT_METHOD(loadPreset:(NSString *)presetJson)
{
  // Presets are decoded on the TypeScript side for this scaffold; native remains authoritative for clamped parameters.
}

@end
