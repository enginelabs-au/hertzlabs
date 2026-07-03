import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import {scienceTabsData} from '../constants/scienceTabsData';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

function ScienceAccordionTab({
  tabId,
  thesisTitle,
  summary,
  references,
  expanded,
  onPress,
}: {
  tabId: string;
  thesisTitle: string;
  summary: string;
  references: {citation: string}[];
  expanded: boolean;
  onPress: (id: string) => void;
}) {
  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      <Pressable
        style={styles.header}
        onPress={() => onPress(tabId)}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
        <View style={styles.textCol}>
          <Text style={styles.thesisTitle}>{thesisTitle}</Text>
          {expanded && (
            <>
              <Text style={styles.summary}>{summary}</Text>
              <View style={styles.bibliography}>
                {references.map((ref, idx) => (
                  <Text key={`${tabId}-ref-${idx}`} style={styles.citation}>
                    {ref.citation}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

export function TheScienceScreen() {
  const scrollInsets = useModalScrollInsets(32);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onTabPress = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.headerBar}>
          <Text style={styles.title}>The Science</Text>
          <Pressable
            onPress={() => setActiveModal(null)}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close science reference">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Evidence summaries behind Hertz Labs entrainment modes. Tap a thesis to expand citations
            and methodology notes.
          </Text>

          {scienceTabsData.map(tab => (
            <ScienceAccordionTab
              key={tab.id}
              tabId={tab.id}
              thesisTitle={tab.thesisTitle}
              summary={tab.summary}
              references={tab.references}
              expanded={expandedId === tab.id}
              onPress={onTabPress}
            />
          ))}

          <Text style={styles.disclaimer}>
            Summaries are educational — not medical advice. Consult a clinician before using photic
            stimulation if you have photosensitive epilepsy or related conditions.
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
    maxHeight: '88%',
    backgroundColor: HertzTheme.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: HertzTheme.glassBorder,
  },
  headerBar: {
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
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: HertzTheme.text.secondary,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HertzTheme.glassBorder,
    backgroundColor: HertzTheme.glassFill,
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: HertzTheme.neon.cyan,
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  chevron: {
    fontSize: 18,
    color: HertzTheme.text.muted,
    marginTop: 2,
    width: 12,
  },
  chevronOpen: {
    transform: [{rotate: '90deg'}],
    color: HertzTheme.neon.cyan,
  },
  textCol: {
    flex: 1,
    gap: 8,
  },
  thesisTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HertzTheme.text.primary,
    lineHeight: 21,
  },
  summary: {
    fontSize: 14,
    lineHeight: 21,
    color: HertzTheme.text.secondary,
  },
  bibliography: {
    marginTop: 4,
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
  },
  citation: {
    fontSize: 11,
    lineHeight: 16,
    color: HertzTheme.text.muted,
    fontStyle: 'italic',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    color: HertzTheme.text.muted,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
