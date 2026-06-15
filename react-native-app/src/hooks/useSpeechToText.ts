import {useCallback, useEffect, useRef, useState} from 'react';
import {Keyboard, Platform} from 'react-native';
import {useRecognizer, useRecognizerIsActive, PermissionStatus} from 'react-native-nitro-speech';

type UseSpeechToTextOptions = {
  onTranscript: (text: string) => void;
  locale?: string;
};

const SPEECH_CONFIG = {
  iosPreset: 'shortform' as const,
  iosAddPunctuation: true,
  autoFinishRecognitionMs: 12_000,
  autoFinishProgressIntervalMs: 1000,
  resetAutoFinishVoiceSensitivity: 0.35,
};

export function useSpeechToText({onTranscript, locale = 'en-US'}: UseSpeechToTextOptions) {
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const [error, setError] = useState<string | null>(null);
  const [pendingListen, setPendingListen] = useState(false);

  const callbacksRef = useRef({
    onReadyForSpeech: () => {
      setError(null);
      setPendingListen(false);
    },
    onResult: (textBatches: string[]) => {
      const text = textBatches.join(' ').replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        onTranscriptRef.current(text);
      }
    },
    onRecordingStopped: () => {
      setPendingListen(false);
    },
    onError: (err: string) => {
      setPendingListen(false);
      setError(err || 'Speech recognition failed');
    },
    onPermissionDenied: () => {
      setPendingListen(false);
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

  const isListening = useRecognizerIsActive();
  const isActive = isListening || pendingListen;

  useEffect(() => {
    if (isListening) {
      setPendingListen(false);
    }
  }, [isListening]);

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
    stopListening();
  }, [stopListening]);

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
