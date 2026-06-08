#import <ReactCommon/RCTTurboModule.h>
#import <HertzLabsBinauralBeatsSpec/HertzLabsBinauralBeatsSpec.h>
#import <CoreMotion/CoreMotion.h>

static inline double HLClamp01(double v)
{
  return fmin(fmax(v, 0.0), 1.0);
}

static inline double HLNormalizeGyro(double radS)
{
  return HLClamp01((radS + M_PI) / (2.0 * M_PI));
}

static inline double HLNormalizeRoll(double rad)
{
  return HLClamp01((rad + M_PI) / (2.0 * M_PI));
}

static inline double HLNormalizePitch(double rad)
{
  return HLClamp01((rad + (M_PI / 2.0)) / M_PI);
}

static inline double HLNormalizeYaw(double rad)
{
  return HLClamp01(rad / (2.0 * M_PI));
}

@interface HertzTelemetryModule : NativeHertzTelemetrySpecBase <NativeHertzTelemetrySpec>
@property (nonatomic, strong) CMMotionManager *motionManager;
@property (nonatomic, strong) NSOperationQueue *motionQueue;
@property (nonatomic, assign) BOOL eventEmitterReady;
@property (nonatomic, assign) BOOL sensorsRunning;
@end

@implementation HertzTelemetryModule

RCT_EXPORT_MODULE(HertzTelemetry)

- (instancetype)init
{
  if (self = [super init]) {
    _motionManager = [[CMMotionManager alloc] init];
    _motionQueue = [[NSOperationQueue alloc] init];
    _motionQueue.maxConcurrentOperationCount = 1;
    _motionQueue.qualityOfService = NSQualityOfServiceUserInteractive;
  }
  return self;
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
  return std::make_shared<facebook::react::NativeHertzTelemetrySpecJSI>(params);
}

- (void)emitMotion:(CMDeviceMotion *)motion
{
  if (!self.eventEmitterReady || motion == nil) {
    return;
  }

  const double ax = motion.userAcceleration.x;
  const double ay = motion.userAcceleration.y;
  const double az = motion.userAcceleration.z;
  const double accelMagG = sqrt(ax * ax + ay * ay + az * az);
  const double accelNorm = HLClamp01((accelMagG + 2.0) / 4.0);

  [self emitOnTelemetryUpdate:@{
    @"gyroX" : @(HLNormalizeGyro(motion.rotationRate.x)),
    @"gyroY" : @(HLNormalizeGyro(motion.rotationRate.y)),
    @"gyroZ" : @(HLNormalizeGyro(motion.rotationRate.z)),
    @"accelX" : @(accelNorm),
    @"accelY" : @(accelNorm),
    @"accelZ" : @(accelNorm),
    @"roll" : @(HLNormalizeRoll(motion.attitude.roll)),
    @"pitch" : @(HLNormalizePitch(motion.attitude.pitch)),
    @"yaw" : @(HLNormalizeYaw(motion.attitude.yaw)),
    @"heading" : @(0),
    @"cadenceBpm" : @(0),
    @"shakeDetected" : @(accelMagG > 2.5),
  }];
}

- (void)startSensors:(double)intervalMs
{
  if (self.sensorsRunning) {
    return;
  }
  if (!self.motionManager.deviceMotionAvailable) {
    NSLog(@"[HertzTelemetry] device motion unavailable");
    return;
  }

  const NSTimeInterval intervalSec = fmax(intervalMs / 1000.0, 0.02);
  self.motionManager.deviceMotionUpdateInterval = intervalSec;
  self.sensorsRunning = YES;

  __weak HertzTelemetryModule *weakSelf = self;
  [self.motionManager startDeviceMotionUpdatesToQueue:self.motionQueue
                                         withHandler:^(CMDeviceMotion *motion, NSError *error) {
    if (error != nil) {
      NSLog(@"[HertzTelemetry] motion error: %@", error);
      return;
    }
    HertzTelemetryModule *strongSelf = weakSelf;
    if (strongSelf == nil) {
      return;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      [strongSelf emitMotion:motion];
    });
  }];

  NSLog(@"[HertzTelemetry] startSensors intervalMs=%.0f", intervalMs);
}

- (void)stopSensors
{
  if (!self.sensorsRunning) {
    return;
  }
  [self.motionManager stopDeviceMotionUpdates];
  self.sensorsRunning = NO;
  if (self.eventEmitterReady) {
    [self emitOnTelemetrySleep];
  }
  NSLog(@"[HertzTelemetry] stopSensors");
}

@end
