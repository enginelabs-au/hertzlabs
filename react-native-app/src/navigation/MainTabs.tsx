import React, {useEffect, useRef, useState} from 'react';
import {Animated, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PlayerScreen} from '../screens/PlayerScreen';
import {MathModeScreen} from '../screens/MathModeScreen';
import {BackgroundAudioScreen} from '../screens/BackgroundAudioScreen';
import {AIParserScreen} from '../screens/AIParserScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {TransportBar} from '../components/layout/TransportBar';
import {useAudioBackgroundController} from '../hooks/useAudioBackgroundController';
import {useHertzStore} from '../state/store';
import {HertzTheme} from '../theme/hertzTheme';

type AdvancedTabId = 'engines' | 'math' | 'background' | 'ai';
type SimpleTabId = 'home' | 'engines' | 'ai';
type TabId = AdvancedTabId | SimpleTabId;

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

const ADVANCED_TABS: TabConfig[] = [
  {id: 'engines', label: 'Engines', icon: '◉'},
  {id: 'math', label: 'Math Mode', icon: '∑'},
  {id: 'background', label: 'Background', icon: '♪'},
  {id: 'ai', label: 'AI', icon: '✦'},
];

const SIMPLE_TABS: TabConfig[] = [
  {id: 'home', label: 'Home', icon: '◎'},
  {id: 'engines', label: 'Engines', icon: '◉'},
  {id: 'ai', label: 'AI Assistant', icon: '✦'},
];

type ScreenForTabProps = {
  tab: TabId;
  isAdvancedMode: boolean;
};

/** Exactly one screen mounted — no stacked hidden routes. */
function ScreenForTab({tab, isAdvancedMode}: ScreenForTabProps) {
  if (!isAdvancedMode) {
    switch (tab) {
      case 'home':
        return <HomeScreen />;
      case 'engines':
        return <PlayerScreen />;
      case 'ai':
        return <AIParserScreen />;
      default:
        return <HomeScreen />;
    }
  }

  switch (tab) {
    case 'engines':
      return <PlayerScreen />;
    case 'math':
      return <MathModeScreen />;
    case 'background':
      return <BackgroundAudioScreen />;
    case 'ai':
      return <AIParserScreen />;
    default:
      return <PlayerScreen />;
  }
}

export function MainTabs() {
  const isAdvancedMode = useHertzStore(s => s.isAdvancedMode);
  const tabs = isAdvancedMode ? ADVANCED_TABS : SIMPLE_TABS;
  const defaultTab: TabId = isAdvancedMode ? 'engines' : 'home';

  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const {bottom: bottomInset} = useSafeAreaInsets();
  // useWindowDimensions subscribes to display-size / orientation changes — this
  // ensures the layout recomputes when the user changes Android's Display Size
  // accessibility setting while the app is running.
  const {fontScale} = useWindowDimensions();

  useAudioBackgroundController();

  // Simple mode always opens on Home after launch or when toggling off Advanced.
  useEffect(() => {
    if (!isAdvancedMode) {
      setActiveTab('home');
    }
  }, [isAdvancedMode]);

  useEffect(() => {
    setActiveTab(defaultTab);
    fadeAnim.setValue(1);
  }, [isAdvancedMode, defaultTab, fadeAnim]);

  const onSelectTab = (tab: TabId) => {
    if (tab === activeTab) {
      return;
    }
    if (!isAdvancedMode && tab === 'home') {
      setActiveTab(tab);
      fadeAnim.setValue(1);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      // Always switch the tab regardless of whether the animation completed —
      // an interrupted animation (e.g. rapid double-tap) must not silently drop
      // the navigation request.
      setActiveTab(tab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const isSimpleHome = !isAdvancedMode && activeTab === 'home';
  const screenKey = `${isAdvancedMode ? 'adv' : 'simple'}-${activeTab}`;

  return (
    <View style={styles.root}>
      {isSimpleHome ? (
        <View key={screenKey} style={styles.screenContainer}>
          <HomeScreen />
        </View>
      ) : (
        <Animated.View
          key={screenKey}
          style={[styles.screenContainer, {opacity: fadeAnim}]}
          collapsable={false}>
          <ScreenForTab tab={activeTab} isAdvancedMode={isAdvancedMode} />
        </Animated.View>
      )}

      <TransportBar />

      <View style={[styles.tabBar, {paddingBottom: Math.max(bottomInset, 4)}]}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          // Scale up tab item padding when system font scale is large so labels
          // don't clip on accessibility-zoomed displays.
          const extraPad = fontScale > 1.2 ? Math.round((fontScale - 1.2) * 10) : 0;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tabItem, extraPad > 0 && {paddingTop: 10 + extraPad, paddingBottom: 6 + extraPad}]}
              onPress={() => onSelectTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{selected: isActive}}
              accessibilityLabel={tab.label}>
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]} maxFontSizeMultiplier={1.0}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} maxFontSizeMultiplier={1.0}>{tab.label}</Text>
              {isActive && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HertzTheme.bg,
  },
  screenContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: HertzTheme.bg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,14,23,0.98)',
    borderTopWidth: 1,
    borderTopColor: HertzTheme.glassBorder,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    position: 'relative',
  },
  tabIcon: {
    fontSize: 20,
    color: HertzTheme.text.muted,
    lineHeight: 24,
  },
  tabIconActive: {
    color: HertzTheme.neon.cyan,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: HertzTheme.text.muted,
    letterSpacing: 0.4,
    marginTop: 3,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: HertzTheme.neon.cyan,
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: HertzTheme.neon.cyan,
    borderRadius: 1,
  },
});
