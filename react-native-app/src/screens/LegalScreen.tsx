import React from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  LEGAL_HUB_URL,
  PRIVACY_URL,
  SUPPORT_URL,
  TERMS_URL,
} from '../constants/legalUrls';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

function LegalLinkRow({label, description, url}: {label: string; description: string; url: string}) {
  return (
    <Pressable
      style={styles.linkCard}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link">
      <Text style={styles.linkTitle}>{label}</Text>
      <Text style={styles.linkDesc}>{description}</Text>
      <Text style={styles.linkUrl}>{url}</Text>
    </Pressable>
  );
}

export function LegalScreen() {
  const scrollInsets = useModalScrollInsets(32);
  const setActiveModal = useHertzStore(s => s.setActiveModal);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Legal</Text>
          <Pressable
            onPress={() => setActiveModal(null)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close legal information">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Hertz Labs legal documents and support resources. Tap a link to open it in your browser.
          </Text>

          <LegalLinkRow
            label="Terms of Service"
            description="Subscription terms, acceptable use, and liability."
            url={TERMS_URL}
          />
          <LegalLinkRow
            label="Privacy Policy"
            description="How we handle data, permissions, and third-party services."
            url={PRIVACY_URL}
          />
          <LegalLinkRow
            label="Support"
            description="Contact, FAQs, and troubleshooting."
            url={SUPPORT_URL}
          />
          <LegalLinkRow
            label="Legal hub (web)"
            description="All policies and product information in one place."
            url={LEGAL_HUB_URL}
          />

          <Text style={styles.disclaimer}>
            Binaural beats are for personal wellness only — not medical advice. See the safety notice
            on first launch for full warnings.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: HertzTheme.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: HertzTheme.glassBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: HertzTheme.glassBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: HertzTheme.text.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    fontSize: 14,
    color: HertzTheme.text.secondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: HertzTheme.text.secondary,
    marginBottom: 4,
  },
  linkCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
    padding: 14,
    gap: 4,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.neon.cyan,
  },
  linkDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: HertzTheme.text.secondary,
  },
  linkUrl: {
    fontFamily: HertzTheme.mono,
    fontSize: 10,
    color: HertzTheme.text.muted,
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    color: HertzTheme.text.muted,
    marginTop: 8,
  },
});
