import React, {type ReactNode} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {LegalMenuBar} from './LegalMenuBar';
import {HertzTheme} from '../../theme/hertzTheme';

type ScreenScrollLayoutProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Match Engines tab — legal links scroll with page content at the very end. */
  showLegalFooter?: boolean;
  legalShowLayoutToggle?: boolean;
  /** Extra padding below scroll content (tab bar / transport clearance). */
  bottomInset?: number;
};

/**
 * Standard tab screen shell: one vertical scroll area with optional legal footer
 * as the last child (never pinned above the transport bar).
 */
export function ScreenScrollLayout({
  children,
  style,
  contentContainerStyle,
  showLegalFooter = true,
  legalShowLayoutToggle = true,
  bottomInset = 16,
}: ScreenScrollLayoutProps) {
  return (
    <View style={[styles.screen, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: bottomInset},
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled">
        {children}
        {showLegalFooter && (
          <LegalMenuBar showLayoutToggle={legalShowLayoutToggle} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
});
