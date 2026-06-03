#import <Foundation/Foundation.h>
#import "HertzAudioEventSink.h"

NS_ASSUME_NONNULL_BEGIN

@interface HertzAudioNativeEngine : NSObject

@property(nonatomic, weak, nullable) id<HertzAudioEventSink> eventSink;

- (void)configureWithSampleRate:(double)sampleRate bufferDurationMs:(double)bufferDurationMs;
- (void)play;
- (void)pause;
- (void)stop;
- (void)setBinauralParametersWithCarrierHz:(double)carrierHz
                                   beatHz:(double)beatHz
                                     gain:(float)gain
                                  balance:(float)balance;
- (void)setNoiseWithType:(NSString *)type level:(float)level;
- (void)fadeToGain:(float)toGain durationMs:(NSInteger)durationMs;
- (void)setPhaseAndTimingWithPhase:(double)phase timingMs:(double)timingMs;

@end

NS_ASSUME_NONNULL_END
