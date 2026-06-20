import React, {useCallback} from 'react';
import {SimpleTopControls} from '../components/simple/SimpleTopControls';
import {SimpleEngineCarousel} from '../components/simple/SimpleEngineCarousel';
import {BackgroundAudioToggle} from '../components/simple/BackgroundAudioToggle';
import {SimpleSessionAutomationMenu} from '../components/simple/SimpleSessionAutomationMenu';
import {ScreenScrollLayout} from '../components/layout/ScreenScrollLayout';
import {useHertzStore} from '../state/store';

/** Streamlined Engines dashboard for Simple Mode. */
export function SimplePlayerScreen() {
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const openPaywall = useCallback(() => setActiveModal('paywall'), [setActiveModal]);

  return (
    <ScreenScrollLayout>
      <SimpleTopControls />
      <SimpleEngineCarousel onUpgrade={openPaywall} />
      <BackgroundAudioToggle />
      <SimpleSessionAutomationMenu />
    </ScreenScrollLayout>
  );
}
