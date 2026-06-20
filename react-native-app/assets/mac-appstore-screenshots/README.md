# Mac App Store screenshots

**Size:** 2880 × 1800 px (16:10 landscape) — Mac App Store Connect requirement.

These are Mac-window marketing mockups matching the scenes in `../appstore-screenshots/` (iPhone portrait), adapted to landscape 16:10.

| File | Scene |
|------|-------|
| `ai_guide_neural_brain.jpg` | AI Guide + neural brain graphic |
| `auditory_physics_dichotic_nexus.jpg` | Dichotic nexus explainer |
| `background_audio_connected_suite.jpg` | Connected Sound Suite |
| `background_audio_spotify_soon.jpg` | Background Audio / Spotify |
| `cognitive_frequencies_left_hemisphere.jpg` | Left-hemisphere frequency bands |
| `engines_acoustic_monaural_waveform.jpg` | Acoustic engine dashboard |
| `math_mode_lissajous_burst.jpg` | Math mode Lissajous |
| `music_integration_right_hemisphere.jpg` | Right-hemisphere music integration |
| `peak_flow_state_focus_coding.jpg` | Peak flow / coding lifestyle |
| `target_brainwave_sync_dual_hemisphere.jpg` | Dual-hemisphere brain sync |

## Regenerate 2880×1800 from current Mac art

```bash
python3 scripts/resize-mac-appstore-screenshots.py
```

Center cover-crop scales to fill 2880×1800 without letterboxing.

## Alternative: convert iPhone portrait sources

If Mac-window art is unavailable, derive landscape gutters from iOS portrait:

```bash
python3 scripts/convert-appstore-screenshots-macos.py
```

Outputs multiple sizes under `2880x1800/`, `2560x1600/`, etc.
