import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PlayerScreen} from '../screens/PlayerScreen';
import {MathModeScreen} from '../screens/MathModeScreen';
import {BackgroundAudioScreen} from '../screens/BackgroundAudioScreen';
import {useAudioBackgroundController} from '../hooks/useAudioBackgroundController';

const BG = '#000000';
const ACCENT = '#4ADE80';
const MUTED = 'rgba(255,255,255,0.38)';
const TAB_BG = 'rgba(10,10,10,0.96)';
const TAB_BORDER = 'rgba(255,255,255,0.07)';

type TabId = 'engines' | 'math' | 'background';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  {id: 'engines', label: 'Engines', icon: '◉'},
  {id: 'math', label: 'Math Mode', icon: '∑'},
  {id: 'background', label: 'Background', icon: '♪'},
];

export function MainTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('engines');

  // Background audio controller always active while app is running
  useAudioBackgroundController();

  return (
    <View style={styles.root}>
      {/* Screen container */}
      <View style={styles.screenContainer}>
        {activeTab === 'engines' && <PlayerScreen />}
        {activeTab === 'math' && <MathModeScreen />}
        {activeTab === 'background' && <BackgroundAudioScreen />}
      </View>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{selected: isActive}}
              accessibilityLabel={tab.label}>
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
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
    backgroundColor: BG,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: TAB_BG,
    borderTopWidth: 1,
    borderTopColor: TAB_BORDER,
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
    color: MUTED,
    lineHeight: 24,
  },
  tabIconActive: {
    color: ACCENT,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.4,
    marginTop: 3,
  },
  tabLabelActive: {
    color: ACCENT,
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
});
