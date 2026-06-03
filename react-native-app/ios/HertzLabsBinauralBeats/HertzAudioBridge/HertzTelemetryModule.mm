#import <ReactCommon/RCTTurboModule.h>
#import <HertzLabsBinauralBeatsSpec/HertzLabsBinauralBeatsSpec.h>

@interface HertzTelemetryModule : NativeHertzTelemetrySpecBase <NativeHertzTelemetrySpec>
@end

@implementation HertzTelemetryModule

RCT_EXPORT_MODULE(HertzTelemetry)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHertzTelemetrySpecJSI>(params);
}

- (void)startSensors:(double)intervalMs
{
  NSLog(@"[HertzTelemetry] startSensors intervalMs=%.0f", intervalMs);
}

- (void)stopSensors
{
  NSLog(@"[HertzTelemetry] stopSensors");
}

@end
