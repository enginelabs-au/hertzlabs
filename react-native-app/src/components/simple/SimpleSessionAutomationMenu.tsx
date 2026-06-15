import React from 'react';
import {type ViewStyle} from 'react-native';
import {SimpleCollapsibleSection} from './SimpleCollapsibleSection';
import {SimpleSessionAutomation} from './SimpleSessionAutomation';
import {useHertzStore} from '../../state/store';

type SimpleSessionAutomationMenuProps = {
  style?: ViewStyle;
};

/** Session automation collapsed into a menu for Simple Mode. */
export function SimpleSessionAutomationMenu({style}: SimpleSessionAutomationMenuProps) {
  const protocolRunning = useHertzStore(s => s.protocolRunning);

  return (
    <SimpleCollapsibleSection
      title="Session Automation"
      subtitle="Sleep timer, fade point, transition speed, progress ring"
      isActive={protocolRunning}
      style={style}>
      <SimpleSessionAutomation compact />
    </SimpleCollapsibleSection>
  );
}
