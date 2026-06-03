#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@protocol HertzAudioEventSink <NSObject>

- (void)emitEngineStateWithState:(NSString *)state
                     sampleRate:(double)sampleRate
                          route:(NSString *)route;
- (void)emitPositionWithElapsedSec:(double)elapsedSec;
- (void)emitErrorWithCode:(NSString *)code message:(NSString *)message;

@end

NS_ASSUME_NONNULL_END
