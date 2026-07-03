export type ScienceReference = {
  citation: string;
};

export type ScienceTab = {
  id: string;
  thesisTitle: string;
  summary: string;
  references: ScienceReference[];
};

/** Peer-reviewed summaries for The Science menu (footer). */
export const scienceTabsData: ScienceTab[] = [
  {
    id: 'assr',
    thesisTitle: 'Auditory Entrainment & ASSR (Binaural & Isochronic)',
    summary:
      'Neural entrainment relies on Steady-State Auditory Responses (ASSRs). When the ears are presented with dichotic or amplitude-modulated acoustic beats, the auditory brainstem and cortex attempt to phase-align their electrical firing to match the external rhythm. This allows precise external control over cortical oscillations, pushing the brain toward targeted states of arousal or relaxation.',
    references: [
      {
        citation:
          'Chaieb, L., et al. (2015). "Auditory Beat Stimulation and its Effects on Cognition and Mood States." Frontiers in Psychiatry.',
      },
      {
        citation: 'Oster, G. (1973). "Auditory Beats in the Brain." Scientific American.',
      },
    ],
  },
  {
    id: 'gamma',
    thesisTitle: 'Gamma & Supra-Gamma Driving (40Hz+)',
    summary:
      'High-frequency entrainment—specifically at exactly 40 Hz—induces widespread neural synchronization. Known clinically as Gamma Entrainment Using Sensory Stimuli (GENUS), this frequency has been documented to activate microglia (the brain’s immune cells), increase glymphatic clearance, and protect neural network connectivity.',
    references: [
      {
        citation:
          'Martorell, A. J., et al., MIT Picower Institute (2019). "Multi-sensory Gamma Stimulation Ameliorates Alzheimer’s-Associated Pathology." Cell.',
      },
      {
        citation:
          'Iaccarino, H. F., et al., Tsai Laboratory (2016). "Gamma frequency entrainment attenuates amyloid load and modifies microglia." Nature.',
      },
    ],
  },
  {
    id: 'isf-epsilon',
    thesisTitle: 'Infra-Slow Fluctuations & Epsilon (0.01 – 0.5 Hz)',
    summary:
      'Extremely slow neural rhythms, known as Infra-Slow Fluctuations (ISFs), operate below the standard Delta sleep band. These massive waves correlate directly with the brain’s Default Mode Network (DMN) resting states and deep autonomic regulation. Targeting this range supports profound nervous system recovery and vagal reset.',
    references: [
      {
        citation:
          'Palva, J. M., & Palva, S. (2012). "Infra-slow fluctuations in electrophysiological recordings, blood-oxygenation-level-dependent signals, and psychophysical time series." NeuroImage.',
      },
    ],
  },
  {
    id: 'hrv',
    thesisTitle: 'Resonant Frequency Breathing (HRV Biofeedback)',
    summary:
      'Cardiovascular resonance occurs when an individual breathes at a precise rate (typically 5.5 to 6 breaths per minute, or ~0.1 Hz). Pacing breath to this mathematical rhythm aligns respiratory sinus arrhythmia with the body\'s baroreflex, triggering massive oscillations in Heart Rate Variability (HRV) and suppressing the sympathetic nervous system.',
    references: [
      {
        citation:
          'Lehrer, P. M., & Gevirtz, R. (2014). "Heart rate variability biofeedback: how and why does it work?" Frontiers in Psychology.',
      },
    ],
  },
  {
    id: 'ave-photic',
    thesisTitle: 'Audio-Visual Entrainment (AVE) & Photic Driving',
    summary:
      'Combining rhythmic auditory tones with synchronized visual flashing (photic driving) produces a significantly stronger neural entrainment response than audio alone. By utilizing a device screen to strobe in exact phase-alignment with the audio frequency, the visual cortex and auditory pathways simultaneously synchronize. Recent clinical trials confirm that visual driving—particularly using intense white or red spectrums at high frequencies like 40Hz to 60Hz—induces widespread, robust neuroplasticity.',
    references: [
      {
        citation:
          'Siever, D., & Collura, T. (2017). "Audio–visual entrainment: physiological mechanisms and clinical outcomes." Rhythmic Stimulation Procedures in Neuromodulation.',
      },
      {
        citation:
          'Lee, J., et al. (2021). "Optimal flickering light stimulation for entraining gamma waves in the human brain." Scientific Reports.',
      },
    ],
  },
];
