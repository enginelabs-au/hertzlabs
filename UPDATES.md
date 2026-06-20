# Updates — Version 2.0 (build 1)

Target release: **Version 2.0 · build 1** (`versionName` 2.0, `versionCode` 10).

Simple checklist for **issues** (bugs/regressions) and **features** (new work) before the next store build.

## How CI uses this file

| Marker | Meaning |
|--------|---------|
| `- [ ]` | **Open — blocks push/merge** until checked off |
| `- [x]` | Resolved — does not block |
| `- [~]` | Feature placeholder (not scoped yet) — does not block |

When an issue is fixed or a feature is shipped, change `- [ ]` → `- [x]` and add a one-line **Fix / Shipped:** note.

Local commits can be gated too: run `./scripts/install-git-hooks.sh` once (uses `.githooks/pre-commit`).

---

## Issues

- [x] **Issue 1 — Onboarding terms screen scroll (step 3)**  
  **Report:** After checking "I understand", users could not scroll lower or reach **Acknowledge & Enter** on the third onboarding page.  
  **Fix / Shipped:** Moved terms checkboxes + CTA into the main `ScrollView`; added bottom safe-area padding on `LegalMenuBar`; hid layout toggle on the safety gate.  
  **Release:** v1.0 (pre–2.0).

- [x] **Issue 2 — Simple mode home mic does not submit**  
  **Report:** In simple mode, the home screen microphone does not submit text once input is captured.  
  **Fix / Shipped:** `useSpeechToText` now fires `onRecordingComplete` with the final transcript; Simple Home (`homeInline` AI guide) auto-submits the prompt when voice capture ends.  
  **Release:** **2.0 (build 1)**.

- [x] **Issue 3 — AI chat inconsistent output**  
  **Report:** AI chatbox did not always produce the requested output — silent fallback to keyword matching when Gemini failed; Hz capped at 50 so lambda/epsilon requests returned wrong values.  
  **Fix / Shipped:** Upgraded model to `gemini-2.0-flash`; added one retry on 429/5xx and network errors before local fallback; rewrote all three system prompts with explicit "JSON object only" instruction and no markdown; extended `targetFrequencyHz` range to 0.1–500 Hz across all code paths; added Epsilon and Lambda intent profiles to local fallback; full band reference (epsilon → supra-gamma) included in system prompt.  
  **Release:** **2.0 (build 1)**.

- [ ] **Issue 4 — Android audible pop on first play**  
  **Report:** Android only — a single audible pop less than one second after pressing play, regardless of how long the app was open first.  
  **Fix / Shipped:** _pending_

- [ ] **Issue 5 — Android kinetic mode broken**  
  **Report:** Kinetic mode does not work on Android.  
  **Fix / Shipped:** _pending_

- [x] **Issue 6 — Engines page frequency band indicators clipped**  
  **Report:** On the Engines screen the vertical coloured frequency band indicator rail is cut off — brainwave bands above Cognition (e.g. Lambda, Supra-Gamma, Hyper-Gamma) are not visible.  
  **Expected:** All frequency band labels and their colour indicators are fully visible in the rail without clipping, regardless of device height or number of bands.  
  **Fix guidance:** Check the container height / `ScrollView` vs fixed-height constraint on the band indicator component; ensure the rail either sizes to content or scrolls, and that no parent `overflow: hidden` clips tall lists.  
  **Fix / Shipped:** `HubBandRail.tsx` — replaced the fixed-height `View` cell layout with a `ScrollView` (inner `flex: 1`, `contentContainerStyle` carries the padding + gap). Removed `flex: 1` from cells; cells now use `minHeight: 28` so all 11 bands are reachable by scrolling rather than clipped by the `overflow: hidden` GlassCard frame. Root cause: 11 bands × 36 px minHeight + gaps = 424 px, but `frameH` is 272–308 px — excess was silently clipped.

- [x] **Issue 7 — Payment plan pricing update**  
  **Report:** Update store plans — **Annual** → **$29.99 USD / year** (keep 7-day free trial); **Lifetime Ultra** → **$59.99 USD**.  
  **Fix / Shipped (2026-06-18):**
  - **Code:** `loadPaywallPackages.ts` fallback prices updated ($24.99→$29.99 annual, $19.99→$59.99 lifetime). `setup-asc-iap.mjs`, `setup-play-iap.mjs`, `.env` comments synced. Script `npm run update:pricing` (`scripts/update-pricing.mjs`).
  - **ASC Annual (`hertzlabs_bb_annual`):** ✅ Scheduled price change to **$29.99/yr** from 2026-06-18 across all **175 territories** via `POST /v1/subscriptionPrices` + `equalizations` on the USA price point.
  - **ASC Lifetime (`hertzlabs_lifetime_ultra`):** ✅ Updated to **$59.99** via `POST /v1/inAppPurchasePriceSchedules` (v1 not v2; `${local-id}` format for included resources).
  - **Google Play Annual (`hertzlabs_bb_annual`):** ✅ All **173 regional configs** updated — US to **$29.99/yr**, all others scaled proportionally (×1.2) in their local currencies (e.g. AUD $41.99, GBP £26.99, CAD $41.99, JPY ¥5280). `otherRegionsConfig` USD/EUR baseline also updated.
  - **Google Play Lifetime (`hertzlabs_lifetime_ultra`):** ✅ All **173 regional configs** updated — US to **$59.99**, all others scaled proportionally (×3.0) in their local currencies (e.g. AUD $83.99, GBP £53.99, CAD $83.99, JPY ¥10564). `newRegionsConfig` USD/EUR baseline also updated.
  - **Note:** Website store cards may still show legacy amounts — update manually if a price display component exists.

---

## Features — shipped in 2.0 (build 1)

- [x] **Feature 1 — In-session review prompt**  
  **Description:** After **3 minutes** cumulative active playback and **2+ app launches**, show a native review prompt (via `react-native-in-app-review`, with store URL fallback). Once per app version; skipped during onboarding and while another modal is open.  
  **Shipped:** `useGrowthEngagement`, `requestAppReview.ts`, persisted `growth` slice.  
  **Release:** **2.0 (build 1)**.

- [x] **Feature 2 — Bug / feedback reporter in footer menu**  
  **Description:** **Feedback** entry in `LegalMenuBar` opens an in-app sheet with **Report a bug** and **Request a feature** — each opens a pre-filled `mailto:support@enginelabs.com.au` with app version and platform metadata.  
  **Shipped:** `FeedbackScreen.tsx`, footer menu wiring.  
  **Release:** **2.0 (build 1)**.

- [x] **Feature 3 — Post-value paywall nudge**  
  **Description:** Free users who have listened **≥2 minutes** across **≥2 launches** see the paywall once (after demonstrating value, not on first open).  
  **Shipped:** `shouldShowPaywallNudge` in growth slice + `useGrowthEngagement`.  
  **Release:** **2.0 (build 1)**.

- [x] **Feature 4 — Website SEO & localization landing pages**  
  **Description:** GitHub Pages SEO routes for discovery outside the App Store: `/binaural-beats-app/`, `/focus/`, `/sleep/`, `/es/` (Spanish). Homepage nav + email waitlist (`hello@enginelabs.com.au`).  
  **Shipped:** `react-native-app/docs/{binaural-beats-app,focus,sleep,es}/index.html`, homepage updates.  
  **Release:** **2.0 (build 1)** — deploy via Pages workflow (no app rebuild required for site-only deploy).

- [x] **Feature 5 — App Store marketing screenshot set**  
  **Description:** Three stylized narrative screenshots (left/center/right hemispheres) converted to 1242×2688 JPEG App Store spec.  
  **Shipped:** `assets/appstore-screenshots/cognitive_frequencies_left_hemisphere.jpg`, `target_brainwave_sync_dual_hemisphere.jpg`, `music_integration_right_hemisphere.jpg`.  
  **Release:** **2.0 (build 1)** — upload manually in App Store Connect.

- [x] **Feature 6 — AI chat: full-app "master" prompts, live control of every setting, rate limiting**  
  **Description:** Rewrote all three system prompts (Guide, Formula, Protocol) so the AI knows the entire app surface and operates it for the user: corrected to the real 12-band taxonomy (HEALING/Infra-slow → EXPERIMENT, 0–500 Hz + experimental), all 7 engine modes with tier/headphone gating, ambient noise layers, full intensity (0–1 / −6 dBFS ceiling), phase (0–360°), per-ear drift (±12 Hz), stereo balance, and carrier/pitch (20–1500 Hz, 20 kHz in experimental). Prompts now deduce vague/loose intent (assume zero knowledge), comply with any explicit value/timing/sequence the user states, target any requested cognitive state (grounded or speculative), support multi-turn follow-ups, redirect off-topic asks back to producible states, and respect free vs premium vs experimental availability (passed in live session context) — all while staying terse to bound token cost.  
  **Live control:** AI Guide can now set engine mode (all 7), carrier, phase, L/R drift, balance, and noise layer/mix — not just beat/gain — via tier-clamped store setters, shown live in the UI; tappable replies re-apply the full config.  
  **Combined Home:** when Advanced mode is off, the single Home box now handles both guidance and timed sequences (one simple interface).  
  **Rate limiting:** rolling-window guard (`src/ai/aiRateLimit.ts`) cuts the user off before the provider RPM ceiling and shows an auto-resetting cooldown; a soft "N requests left" hint appears as the cap nears.  
  **Shipped:** `src/ai/geminiChatClient.ts` (prompts + availability context), `src/ai/aiRateLimit.ts`, `src/state/slices/aiChat.ts` (advanced payload + call log), `src/components/ai/aiGuideGenerator.ts` (extended schema/parser), `src/components/ai/AIGuideChatSection.tsx`, `src/components/math/{aiFormulaGenerator,AIFormulaSection}.tsx`; `__tests__/aiRateLimit.test.ts`.  
  **Release:** **2.0 (build 1)**.

---

## Manual steps for 2.0 (build 1) — outside repo

These were recommended for growth but require console / campaign work:

- [ ] App Store Connect — **Product Page Optimization** A/B test on screenshots/subtitle.
- [ ] App Store Connect — **Custom Product Pages** for Focus and Sleep (point Apple Search Ads here).
- [ ] App Store Connect — **In-App Event** for Protocol Sequences or 2.0 launch.
- [ ] App Store Connect — upload new **App Preview** video (15–30 s).
- [ ] App Store Connect — **Spanish localization** for metadata (site `/es/` is live; store listing still English until added).
- [ ] Apple Search Ads — split campaigns + negative keywords; link CPPs.
- [ ] EU **trader status** — restore 27-country availability.
- [ ] Google Play — org account + public launch when Android blockers cleared.
- [ ] Issue 7 pricing — sync ASC / Play / RevenueCat / website store cards.

- [x] **Feature 7 — Promo code redemption (Plans screen)**  
  **Description:** Add a **"Have a promo code?"** entry point in the Plans / Paywall footer. Tapping opens a modal with a single text field and a **Redeem** button. On submit, the code is validated server-side (RevenueCat promotional entitlements or a lightweight edge function) and one of the following grants is applied:

  | Code type | Grant |
  |-----------|-------|
  | **Extended trial** | 3 months of Premium free (instead of the default 7-day trial). A push / in-app reminder fires 7 days before expiry prompting the user to subscribe. |
  | **Lifetime free** | Lifetime Ultra entitlement granted at no charge (RC promotional entitlement, no payment required). |
  | **20% discount** | Introductory offer applied to all purchasable SKUs — user sees discounted prices throughout the Plans screen for the duration of their session / until used. |
  | **50% discount** | Same as above at the 50% rate. |

  **Implementation notes:**
  - All four code types map to RevenueCat promotional entitlements or Apple/Google introductory offers — no custom billing logic in-app.
  - Invalid / already-used / expired codes surface a clear inline error (not a generic alert).
  - Applied discount codes must carry through to the native payment sheet (use SK2 / BillingClient offer tokens).
  - Codes are single-use and stored hashed server-side; the redemption endpoint rate-limits by device + account.
  - After redemption, confirm the active entitlement in the UI and dismiss the modal.

  **Required out-of-app setup (App Store / Play / RevenueCat):**
  - Create promotional offer SKUs and introductory offer configurations in App Store Connect and Google Play Console.
  - Register all codes in RevenueCat dashboard under **Promotional Entitlements** or equivalent.
  - Sync pricing / discount tiers for 20% and 50% offer codes across both stores.

  _Change `[~]` → `[ ]` when scoped for a build._

- [x] **Feature 8 — Promos hub (earn codes)**  
  **Description:** Add a **Promos** entry to the footer / tab menu (or as an item in `LegalMenuBar`). The screen is a scrollable list of available "earn" opportunities — each shows what the user gets, the action required, and a status badge (Available / In Progress / Claimed). Completing an action surfaces a reward code in-app with a copy button.

  **Earn mechanisms:**

  | Earn type | Reward | How |
  |-----------|--------|-----|
  | **Refer a friend** | 1 month free per referral (stacks up to 6 months) | Unique share link; reward triggers when referee installs and opens the app |
  | **Referral purchase bonus** | Additional 1 month free (extra, on top of install reward) | Triggers when the referee purchases any paid plan |
  | **Share with a link** | 7-day extension | Share the unique deep-link to any platform; tracked via Supabase referral links |
  | **Make a post** | 1 month free | User submits a public URL (Instagram, TikTok, Twitter/X, YouTube, Reddit, blog) featuring the app with original text + visual/video content; manually or semi-automatically reviewed before code is issued |
  | **Leave a review** | 7-day extension | Detect / record that the user opened the App Store/Play Store rating flow; reward on return (cannot verify but good-faith; gate to once per version) |
  | **Streak milestone** | 7-day extension at 7 days; 1 month free at 30 days | Consecutive days the user opens a session; persisted in `growth` slice |
  | **Wellness check-in** | 3-day extension | User answers a short 3-question wellness survey (mood, sleep, focus before/after session) every 14 days; data stays on device |
  | **Beta tester** | 1 month free | Triggered by a special invite code from the developer — unlocks early feature access |
  | **Practitioner / therapist referral** | 3 months free + 30% affiliate code for their clients | Verified via a short application form (email + credential); manual grant |
  | **Anniversary reward** | 1 month free | Fires on the 1-year anniversary of the user's first app open (persisted install date) |
  | **Social challenge** | Lifetime 20% discount | Post a 30-day "binaural focus challenge" with daily check-ins; submit final recap post URL for manual review |

  **Screen design notes:**
  - Cards use a consistent layout: reward badge (icon + text), action description, CTA button or progress indicator.
  - Deep-link / referral tracking: custom `hertzlabs.app/r/?ref=` links + Supabase `track-referral` edge function (no third-party SDK).
  - "Make a post" and "Practitioner" flows require a lightweight review queue (email notification to operator + manual approval or a simple webhook to a review dashboard).
  - All earned codes feed into the same redemption flow as Feature 7.
  - Clearly disclose referral terms in a tappable info sheet (avoid App Store guideline violations around incentivised reviews).

  _Change `[~]` → `[ ]` when scoped for a build._

- [x] **Feature 9 — Welcome Premium (7-day gift for all users)**  
  **Description:** One-time modal with **Activate Premium** button; grants 7 days via RevenueCat promotional entitlement (`grant-welcome-premium` edge function). Shown to free users on launch until claimed. Existing users receive it on first open after update.  
  **Fix / Shipped:** `WelcomePremiumModal.tsx`, `welcomePremiumService.ts`, `useGrowthEngagement.ts`, promo slice persistence; Supabase migration `welcome_premium_grants` + edge function deployed 2026-06-19.  
  **Release:** **2.0 (build 1)**.

- [x] **Feature 10 — Modal layout + Promos UX polish**  
  **Description:** Fix Android nav clipping on Feedback, Legal, Paywall, Promos; fix promo code / form input clipping; collapse Promos earn cards by default (accordion).  
  **Fix / Shipped:** `useModalScrollInsets` hook; Paywall promo input sizing; PromosScreen accordion + taller form fields.  
  **Release:** **2.0 (build 1)**.

---

## Manual steps for 2.0 (build 1) — promo infrastructure (outside repo)

Required before Features 7 and 8 can go live:

- [x] RevenueCat — `premium` entitlement verified active; all 7 products attached (monthly/annual iOS+Android, lifetime iOS+Android); promotional grants wired via RC REST API in edge function.
- [x] App Store Connect — promotional offers configured for hertzlabs_bb_monthly (hz_3mo_free_monthly, hz_2mo_free_monthly, hz_6mo_free_monthly) and hertzlabs_bb_annual (hz_3mo_free_annual, hz_2mo_free_annual, hz_6mo_free_annual).
- [x] Google Play Console — subscription offers configured for monthly-auto and annual-auto base plans (hz-3mo-free-*, hz-2mo-free-*, hz-6mo-free-*, developer-determined eligibility).
- [x] Supabase Edge Function `validate-promo` deployed (project mvawkzhwgtlwxwkssvyg); promo_codes + promo_redemptions tables live; auto-deactivation trigger active; production codes seeded (LAUNCH3MO, FREETRIAL, VIPLIFE, FRIEND20, SAVE50).
- [x] Supabase Edge Function `grant-welcome-premium` deployed; `welcome_premium_grants` table + service_role grants live; `RC_SECRET_KEY` already set in Supabase secrets.
- [x] Referral deep links — **no Branch.io** (account signup blocked). Custom solution: `https://hertzlabs.app/r/?ref=CODE` landing page (`docs/r/index.html`), `hertzlabs://` custom scheme, React Native `Linking` in app, Supabase `track-referral` edge function + `referral_clicks` / `referral_installs` tables. **Optional:** add release SHA256 to `docs/.well-known/assetlinks.json` for Android App Link auto-verify; push `docs/` to enable universal links on `hertzlabs.app`.
- [x] "Make a post" + Practitioner review inbox — inline forms in PromosScreen → `submit-form` edge function → `hello@enginelabs.com.au` via Resend (`RESEND_API_KEY` secret optional).

---

## Manual steps for 2.0 (build 1) — store submission (you only)

No new IAP or store-side offers are required for the 7-day Welcome Premium gift (RevenueCat promotional grant). To ship to users:

1. **Test on device** — Open app → Welcome modal → tap **Activate Premium** → confirm Premium unlocks (7 days). Premium gift reminders appear 1 day before and on expiry day. Users on builds below the store version see a blocking update screen until they update.
2. **iOS** — Archive build **10** in Xcode → upload to App Store Connect → update **What's New** (suggested: *"Claim 7 days of Premium free — tap Activate Premium when prompted. Plus modal layout fixes and a cleaner Promos screen."*) → submit for review.
3. **Android** — `npm run release:android:bundle` → upload AAB to Google Play → same release notes → rollout.
4. **Optional marketing** — Add "7 days Premium free for all users" to App Store / Play store descriptions if desired (not required for the feature to work).

### Mandatory update screen (permanent, automatic)

Store updates are always user-initiated (App Store / Play Store). The app shows a **blocking update screen** when `force_update = true` in Supabase `app_update_policy` **and** the user's `versionCode` is below `latest_version_code`.

**Every release (automatic):**

1. Bump `versionCode` in `app.version.json`.
2. Run `npm run sync:app-version` — or use `npm run release:ios` / `npm run release:android:bundle`, which run sync first. This sets `latest_version_code`, `min_version_code`, and `force_update = true` for **both** iOS and Android.
3. Users on **older** builds see the blocking screen on **every app open** until they install from the store.
4. Users on the **new** build never see the block (per device).

Leave `force_update = true` in place permanently. Do **not** run the SQL below unless you want to disable forced updates entirely.

**Disable forced updates** (only if you stop using this feature):

```sql
update public.app_update_policy
set force_update = false, updated_at = now()
where platform in ('ios', 'android');
```

**Manual override** (emergency only):

```sql
update public.app_update_policy
set latest_version_code = 11, min_version_code = 11, force_update = true, updated_at = now()
where platform = 'android';
```

---

## Release log

| Version | Build | Date | Notes |
|---------|-------|------|-------|
| 1.0 | 9 | — | Initial App Store release |
| **2.0** | **10 (build 1)** | 2026-06-19 | Growth funnel, feedback, mic fix, AI chat reliability, SEO pages, review prompt, promo system (codes + hub) — ready for submission |

---

## Build checklist before submit

1. `npm run sync:app-version` → confirms **2.0 (10)** in iOS + Android projects.
2. `cd ios && pod install` (new native dep: `react-native-in-app-review`).
3. `npm test` + `npm run typecheck`.
4. `npm run release:ios` / archive in Xcode → upload build **10**.
5. Attach IAPs, update "What's New", upload new screenshots if using narrative set.
6. Push `docs/**` to `main` for GitHub Pages SEO pages.
