import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PlayerScreen} from '../screens/PlayerScreen';
import {MathModeScreen} from '../screens/MathModeScreen';
import {BackgroundAudioScreen} from '../screens/BackgroundAudioScreen';
import {useAudioBackgroundController} from '../hooks/useAudioBackgroundController';
import {HertzTheme} from '../theme/hertzTheme';

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

  useAudioBackgroundController();

  return (
    <View style={styles.root}>
      <View style={styles.screenContainer}>
        {activeTab === 'engines' && <PlayerScreen />}
        {activeTab === 'math' && <MathModeScreen />}
        {activeTab === 'background' && <BackgroundAudioScreen />}
      </View>

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
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
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
