#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Forward declaration — actual implementation provided by HertzAudioEngine.xcframework
@protocol TelemetryBridgeDelegate
- (void)telemetryDidUpdateWithGyroY:(float)gyroY
                      accelMagnitude:(float)accelMagnitude
                                roll:(float)roll
                               pitch:(float)pitch
                                 yaw:(float)yaw
                             heading:(float)heading
                        stepCadence:(float)stepCadence
                       shakeDetected:(BOOL)shakeDetected
                        sensorActive:(BOOL)sensorActive;
- (void)telemetryDidEnterSleep;
@end

@interface HertzTelemetryModule : RCTEventEmitter <RCTBridgeModule>
@end

@implementation HertzTelemetryModule {
    BOOL _hasListeners;
}

RCT_EXPORT_MODULE(HertzTelemetry)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onTelemetryUpdate", @"onTelemetrySleep"];
}

- (void)startObserving { _hasListeners = YES; }
- (void)stopObserving  { _hasListeners = NO; }

RCT_EXPORT_METHOD(startSensors:(double)intervalMs) {
    // Delegates to the HertzEngineFacade singleton (set at app init)
    // HertzEngineFacade.shared.startTelemetry(intervalMs: intervalMs)
    // Placeholder until xcframework is linked:
    NSLog(@"[HertzTelemetry] startSensors intervalMs=%.0f", intervalMs);
}

RCT_EXPORT_METHOD(stopSensors) {
    NSLog(@"[HertzTelemetry] stopSensors");
}

// Called by TelemetryManagerDelegate (via HertzEngineFacade) on main thread
- (void)emitTelemetryUpdate:(NSDictionary *)payload {
    if (_hasListeners) {
        [self sendEventWithName:@"onTelemetryUpdate" body:payload];
    }
}

- (void)emitTelemetrySleep {
    if (_hasListeners) {
        [self sendEventWithName:@"onTelemetrySleep" body:@{}];
    }
}

@end
