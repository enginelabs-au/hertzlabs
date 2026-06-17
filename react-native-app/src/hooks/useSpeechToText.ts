import {useCallback, useRef, useState} from 'react';
import {Keyboard, Platform} from 'react-native';
import {useRecognizer, PermissionStatus} from 'react-native-nitro-speech';

type UseSpeechToTextOptions = {
  onTranscript: (text: string) => void;
  /** Called when recognition stops; receives the final transcript if any. */
  onRecordingComplete?: (text: string) => void;
  locale?: string;
};

const SPEECH_CONFIG = {
  iosPreset: 'shortform' as const,
  iosAddPunctuation: true,
  autoFinishRecognitionMs: 12_000,
  autoFinishProgressIntervalMs: 1000,
  resetAutoFinishVoiceSensitivity: 0.35,
};

export function useSpeechToText({
  onTranscript,
  onRecordingComplete,
  locale = 'en-US',
}: UseSpeechToTextOptions) {
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onRecordingCompleteRef.current = onRecordingComplete;
  const lastTranscriptRef = useRef('');

  const [error, setError] = useState<string | null>(null);
  const [pendingListen, setPendingListen] = useState(false);
  // Own state — NOT useRecognizerIsActive() which returns true before any recording starts.
  const [ourIsListening, setOurIsListening] = useState(false);

  const callbacksRef = useRef({
    onReadyForSpeech: () => {
      setError(null);
      setPendingListen(false);
      setOurIsListening(true);
      lastTranscriptRef.current = '';
    },
    onResult: (textBatches: string[]) => {
      const text = textBatches.join(' ').replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        lastTranscriptRef.current = text;
        onTranscriptRef.current(text);
      }
    },
    onRecordingStopped: () => {
      setPendingListen(false);
      setOurIsListening(false);
      const finalText = lastTranscriptRef.current.trim();
      if (finalText.length > 0) {
        onRecordingCompleteRef.current?.(finalText);
      }
      lastTranscriptRef.current = '';
    },
    onError: (err: string) => {
      setPendingListen(false);
      setOurIsListening(false);
      setError(err || 'Speech recognition failed');
    },
    onPermissionDenied: () => {
      setPendingListen(false);
      setOurIsListening(false);
      setError(
        Platform.OS === 'ios'
          ? 'Allow Microphone and Speech Recognition in Settings → Hertz Labs'
          : 'Allow microphone access in Settings',
      );
    },
  });

  const stableCallbacks = useRef({
    onReadyForSpeech: () => callbacksRef.current.onReadyForSpeech(),
    onResult: (textBatches: string[]) => callbacksRef.current.onResult(textBatches),
    onRecordingStopped: () => callbacksRef.current.onRecordingStopped(),
    onError: (err: string) => callbacksRef.current.onError(err),
    onPermissionDenied: () => callbacksRef.current.onPermissionDenied(),
  });

  const {startListening, stopListening, prewarm, getPermissions} = useRecognizer(
    stableCallbacks.current,
    [],
  );

  const isActive = ourIsListening || pendingListen;

  const startSpeech = useCallback(async () => {
    setError(null);
    setPendingListen(true);
    Keyboard.dismiss();

    try {
      const permissions = getPermissions();
      if (permissions === PermissionStatus.DENIED) {
        callbacksRef.current.onPermissionDenied();
        return;
      }

      await prewarm({locale, ...SPEECH_CONFIG}, {requestPermission: true});
      startListening({locale, ...SPEECH_CONFIG});
    } catch (err) {
      setPendingListen(false);
      setError(err instanceof Error ? err.message : 'Could not start speech recognition');
    }
  }, [getPermissions, locale, prewarm, startListening]);

  const stopSpeech = useCallback(() => {
    setPendingListen(false);
    setOurIsListening(false);
    if (ourIsListening) {
      stopListening();
    }
  }, [ourIsListening, stopListening]);

  const toggleSpeech = useCallback(() => {
    if (isActive) {
      stopSpeech();
    } else {
      void startSpeech();
    }
  }, [isActive, startSpeech, stopSpeech]);

  return {
    isListening: isActive,
    error,
    toggleSpeech,
    startSpeech,
    stopSpeech,
  };
}
