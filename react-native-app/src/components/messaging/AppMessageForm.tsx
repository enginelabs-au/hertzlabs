import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {HELLO_EMAIL, SUPPORT_EMAIL} from '../../constants/appInfo';
import {
  sendAppMessage,
  type AppMessageRecipient,
} from '../../services/sendAppMessage';
import {promoCodeNoun} from '../../monetization/storePromoCopy';
import {HertzTheme} from '../../theme/hertzTheme';
import {isValidEmail} from '../../utils/email';

const FORM_INPUT_ANDROID = Platform.select({
  android: {includeFontPadding: false} as const,
  default: {},
});

const RECIPIENT_LABEL: Record<AppMessageRecipient, string> = {
  hello: HELLO_EMAIL,
  support: SUPPORT_EMAIL,
};

export type AppMessageFormProps = {
  to: AppMessageRecipient;
  subject: string;
  category: string;
  placeholder?: string;
  prompt?: string;
  showFromEmail?: boolean;
  fromEmailPlaceholder?: string;
  requireFromEmail?: boolean;
  sentMessage?: string;
  formFooterNote?: string;
  sendLabel?: string;
  onSent?: () => void;
  variant?: 'default' | 'promo';
  style?: ViewStyle;
};

export function AppMessageForm({
  to,
  subject,
  category,
  placeholder = 'Write your message…',
  prompt,
  showFromEmail = true,
  fromEmailPlaceholder = 'Your email (optional, for a reply)',
  requireFromEmail = false,
  sendLabel = 'Send message',
  sentMessage,
  formFooterNote,
  onSent,
  variant = 'default',
  style,
}: AppMessageFormProps) {
  const [message, setMessage] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isPromo = variant === 'promo';
  const accent = isPromo ? '#FBBF24' : HertzTheme.neon.cyan;
  const trimmedMessage = message.trim();
  const trimmedEmail = fromEmail.trim();
  const emailOk = !requireFromEmail || isValidEmail(trimmedEmail);
  const canSend = trimmedMessage.length >= 8 && emailOk && !sending && !sent;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    const result = await sendAppMessage({
      to,
      subject,
      message: trimmedMessage,
      category,
      fromEmail: trimmedEmail || undefined,
    });
    setSending(false);
    if (result.ok) {
      setSent(true);
      setMessage('');
      setFromEmail('');
      onSent?.();
      Alert.alert('Sent', result.message, [{text: 'OK'}]);
    } else {
      Alert.alert('Could not send', result.message, [{text: 'OK'}]);
    }
  }, [canSend, to, subject, trimmedMessage, category, trimmedEmail, onSent]);

  if (sent) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={[styles.sentText, isPromo && styles.sentTextPromo]}>
          {sentMessage ??
            (isPromo
              ? `Message sent to ${RECIPIENT_LABEL[to]}. We will review your request and reply by email with an ${promoCodeNoun()} when approved.`
              : `Message sent to ${RECIPIENT_LABEL[to]}. We aim to reply within two business days.`)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {prompt != null && <Text style={styles.prompt}>{prompt}</Text>}
      {showFromEmail && (
        <TextInput
          style={[styles.input, isPromo && styles.inputPromo]}
          placeholder={fromEmailPlaceholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={fromEmail}
          onChangeText={setFromEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          {...FORM_INPUT_ANDROID}
        />
      )}
      <TextInput
        style={[styles.input, styles.inputMulti, isPromo && styles.inputPromo]}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        {...FORM_INPUT_ANDROID}
      />
      <Pressable
        style={[
          styles.sendBtn,
          {borderColor: `${accent}55`, backgroundColor: `${accent}18`},
          !canSend && styles.sendBtnDisabled,
        ]}
        onPress={() => void handleSend()}
        disabled={!canSend}>
        {sending ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={[styles.sendBtnText, {color: accent}]}>{sendLabel}</Text>
        )}
      </Pressable>
      <Text style={styles.note}>
        {requireFromEmail && trimmedEmail.length > 0 && !emailOk
          ? 'Enter a valid email address.'
          : trimmedMessage.length < 8
            ? `Message needs at least 8 characters (${trimmedMessage.length}/8).`
            : `Sends to ${RECIPIENT_LABEL[to]} via Hertz Labs.`}
      </Text>
      {formFooterNote != null && <Text style={styles.footerNote}>{formFooterNote}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: 4,
  },
  prompt: {
    fontSize: 12,
    lineHeight: 17,
    color: HertzTheme.text.secondary,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: HertzTheme.text.primary,
    minHeight: 44,
  },
  inputPromo: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputMulti: {
    minHeight: 96,
    paddingTop: 10,
  },
  sendBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    fontSize: 11,
    lineHeight: 15,
    color: HertzTheme.text.muted,
  },
  footerNote: {
    fontSize: 11,
    lineHeight: 16,
    color: HertzTheme.text.muted,
    marginTop: 2,
  },
  sentText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#34D399',
  },
  sentTextPromo: {
    color: '#34D399',
  },
});
