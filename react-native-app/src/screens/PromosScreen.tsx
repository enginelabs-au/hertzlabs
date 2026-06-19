import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {requestAppReview} from '../monetization/requestAppReview';
import {useHertzStore} from '../state/store';
import {daysSince} from '../state/slices/promo';
import {HertzTheme} from '../theme/hertzTheme';
import {createReferralLink, REFERRAL_LANDING_BASE} from '../services/referralLinkService';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';

const FORM_INPUT_ANDROID = Platform.select({
  android: {includeFontPadding: false} as const,
  default: {},
});

const SUBMIT_FORM_URL = 'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1/submit-form';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12YXdremh3Z3Rsd3h3a3NzdnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDE2OTcsImV4cCI6MjA5NzQxNzY5N30.mD0kFjNJFSlNEpOWHuO6tA0D1Oc_FHF2UqhDd2AMVOU';

async function submitForm(payload: Record<string, string>): Promise<{ok: boolean; message: string}> {
  try {
    const res = await fetch(SUBMIT_FORM_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY},
      body: JSON.stringify(payload),
    });
    const data = await res.json() as {success?: boolean; message?: string; error?: string};
    if (!res.ok) return {ok: false, message: data.error ?? 'Submission failed.'};
    return {ok: true, message: data.message ?? 'Submitted!'};
  } catch {
    return {ok: false, message: 'Could not reach server. Check your connection.'};
  }
}

const GOLD = '#FBBF24';
const GOLD_DIM = 'rgba(251,191,36,0.12)';
const GOLD_BORDER = 'rgba(251,191,36,0.35)';
const MUTED = 'rgba(255,255,255,0.45)';
const BORDER = 'rgba(255,255,255,0.08)';
const CARD = 'rgba(255,255,255,0.04)';
const SUCCESS = '#34D399';
const SUCCESS_DIM = 'rgba(52,211,153,0.10)';
const SUCCESS_BORDER = 'rgba(52,211,153,0.30)';
const CYAN = HertzTheme.neon.cyan;
const MAGENTA = HertzTheme.neon.magenta;

const APP_STORE_URL = 'https://apps.apple.com/app/hertz-labs/id6741793819';
const PLAY_STORE_URL =
  'market://details?id=com.hertzlabs.binauralbeats';
const SHARE_URL = REFERRAL_LANDING_BASE.replace(/\/r\/?$/, '');

type BadgeVariant = 'gold' | 'cyan' | 'green' | 'muted';

function RewardBadge({label, variant = 'gold'}: {label: string; variant?: BadgeVariant}) {
  const color =
    variant === 'cyan'
      ? CYAN
      : variant === 'green'
        ? SUCCESS
        : variant === 'muted'
          ? MUTED
          : GOLD;
  const bg =
    variant === 'cyan'
      ? 'rgba(92,225,255,0.1)'
      : variant === 'green'
        ? SUCCESS_DIM
        : variant === 'muted'
          ? 'rgba(255,255,255,0.06)'
          : GOLD_DIM;
  const border =
    variant === 'cyan'
      ? 'rgba(92,225,255,0.3)'
      : variant === 'green'
        ? SUCCESS_BORDER
        : variant === 'muted'
          ? BORDER
          : GOLD_BORDER;
  return (
    <View style={[styles.badge, {backgroundColor: bg, borderColor: border}]}>
      <Text style={[styles.badgeText, {color}]}>{label}</Text>
    </View>
  );
}

type EarnCardProps = {
  cardId: string;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  icon: string;
  title: string;
  description: string;
  reward: string;
  rewardVariant?: BadgeVariant;
  status: 'available' | 'claimed' | 'soon';
  ctaLabel?: string;
  onCta?: () => void;
  extra?: React.ReactNode;
};

function EarnCard({
  cardId,
  expanded,
  onToggleExpand,
  icon,
  title,
  description,
  reward,
  rewardVariant = 'gold',
  status,
  ctaLabel,
  onCta,
  extra,
}: EarnCardProps) {
  const isClaimed = status === 'claimed';
  const isSoon = status === 'soon';
  return (
    <View
      style={[
        styles.card,
        isClaimed && styles.cardClaimed,
        isSoon && styles.cardSoon,
      ]}>
      <Pressable
        style={styles.cardHeaderBtn}
        onPress={() => onToggleExpand(cardId)}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <View style={styles.cardTop}>
          <Text style={styles.cardIcon}>{icon}</Text>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, isClaimed && styles.cardTitleClaimed]}>{title}</Text>
            <Text style={styles.cardDesc} numberOfLines={expanded ? undefined : 2}>
              {description}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <RewardBadge
              label={isClaimed ? '✓ Claimed' : isSoon ? 'Soon' : reward}
              variant={isClaimed ? 'green' : isSoon ? 'muted' : rewardVariant}
            />
            <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
          </View>
        </View>
      </Pressable>
      {expanded && (
        <>
          {extra}
          {!isClaimed && !isSoon && ctaLabel != null && (
            <Pressable
              style={styles.cardBtn}
              onPress={onCta}
              accessibilityRole="button">
              <Text style={styles.cardBtnText}>{ctaLabel}</Text>
            </Pressable>
          )}
          {isClaimed && (
            <Text style={styles.claimedNote}>Reward has been applied to your account.</Text>
          )}
          {isSoon && (
            <Text style={styles.claimedNote}>Coming soon — check back in a future update.</Text>
          )}
        </>
      )}
    </View>
  );
}

function StreakBar({current, target}: {current: number; target: number}) {
  const pct = Math.min(current / target, 1);
  return (
    <View style={styles.streakBarWrap}>
      <View style={styles.streakBarBg}>
        <View style={[styles.streakBarFill, {width: `${pct * 100}%`}]} />
      </View>
      <Text style={styles.streakBarLabel}>
        {current} / {target} days
      </Text>
    </View>
  );
}

function ReferralCard({
  code,
  expanded,
  onToggleExpand,
}: {
  code: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const [shareLink, setShareLink] = useState(createReferralLink(code));

  useEffect(() => {
    setShareLink(createReferralLink(code));
  }, [code]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Try Hertz Labs — binaural beats for focus, sleep & meditation. Use my link: ${shareLink}`,
        url: shareLink,
        title: 'Hertz Labs — Binaural Beats',
      });
    } catch {
      // dismissed
    }
  }, [shareLink]);

  return (
    <View style={styles.referralCard}>
      <Pressable
        style={styles.referralHeaderBtn}
        onPress={onToggleExpand}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <View style={styles.referralHeaderRow}>
          <Text style={styles.referralLabel}>YOUR REFERRAL CODE</Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        </View>
        {!expanded && <Text style={styles.referralCodePreview}>{code}</Text>}
      </Pressable>
      {expanded && (
        <>
          <Text style={styles.referralCode}>{code}</Text>
          <Text style={styles.referralLink}>{shareLink}</Text>
          <View style={styles.referralActions}>
            <Pressable style={styles.referralBtn} onPress={() => void handleShare()}>
              <Text style={styles.referralBtnText}>Share Link</Text>
            </Pressable>
          </View>
          <Text style={styles.referralNote}>
            Earn 1 month free for each friend who installs via your link, plus an extra month when they
            purchase any plan (up to 6 months total).
          </Text>
        </>
      )}
    </View>
  );
}

export function PromosScreen() {
  const scrollInsets = useModalScrollInsets(32);
  const setActiveModal = useHertzStore(s => s.setActiveModal);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const toggleCard = useCallback((id: string) => {
    setExpandedCardId(prev => (prev === id ? null : id));
  }, []);

  const myReferralCode = useHertzStore(s => s.myReferralCode);
  const streakDays = useHertzStore(s => s.streakDays);
  const firstInstallDate = useHertzStore(s => s.firstInstallDate);
  const reviewRewardClaimed = useHertzStore(s => s.reviewRewardClaimed);
  const streakReward7Claimed = useHertzStore(s => s.streakReward7Claimed);
  const streakReward30Claimed = useHertzStore(s => s.streakReward30Claimed);
  const anniversaryRewardClaimed = useHertzStore(s => s.anniversaryRewardClaimed);
  const wellnessCheckinCount = useHertzStore(s => s.wellnessCheckinCount);
  const lastWellnessCheckinDate = useHertzStore(s => s.lastWellnessCheckinDate);

  const generateMyReferralCode = useHertzStore(s => s.generateMyReferralCode);
  const markReviewRewardClaimed = useHertzStore(s => s.markReviewRewardClaimed);
  const markStreakReward7Claimed = useHertzStore(s => s.markStreakReward7Claimed);
  const markStreakReward30Claimed = useHertzStore(s => s.markStreakReward30Claimed);
  const markAnniversaryRewardClaimed = useHertzStore(s => s.markAnniversaryRewardClaimed);
  const recordWellnessCheckin = useHertzStore(s => s.recordWellnessCheckin);

  // Initialise on first visit
  useEffect(() => {
    generateMyReferralCode();
  }, [generateMyReferralCode]);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  // Derived booleans
  const anniversaryUnlocked =
    !anniversaryRewardClaimed &&
    firstInstallDate != null &&
    daysSince(firstInstallDate) >= 365;

  const streak7Unlocked = !streakReward7Claimed && streakDays >= 7;
  const streak30Unlocked = !streakReward30Claimed && streakDays >= 30;

  const canWellnessCheckin = (() => {
    if (lastWellnessCheckinDate == null) {
      return true;
    }
    const daysAgo = daysSince(lastWellnessCheckinDate);
    return daysAgo >= 14;
  })();

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleReview = useCallback(async () => {
    const opened = await requestAppReview();
    if (opened) {
      markReviewRewardClaimed();
      Alert.alert(
        'Thank you! 🙏',
        "Your reward code will be emailed to you within 24 hours — keep an eye on your inbox.",
        [{text: 'OK'}],
      );
    }
  }, [markReviewRewardClaimed]);

  const handleStreak7 = useCallback(() => {
    markStreakReward7Claimed();
    setActiveModal('promo');
  }, [markStreakReward7Claimed, setActiveModal]);

  const handleStreak30 = useCallback(() => {
    markStreakReward30Claimed();
    setActiveModal('promo');
  }, [markStreakReward30Claimed, setActiveModal]);

  const handleAnniversary = useCallback(() => {
    markAnniversaryRewardClaimed();
    setActiveModal('promo');
  }, [markAnniversaryRewardClaimed, setActiveModal]);

  const handleWellnessCheckin = useCallback(() => {
    Alert.alert(
      'Wellness Check-in',
      'Quick 3-question check-in — this data stays on your device only.\n\n' +
        '1. Mood right now (1–10)?\n2. Sleep quality last night (1–10)?\n3. Focus level today (1–10)?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Submit',
          onPress: () => {
            recordWellnessCheckin();
            Alert.alert(
              'Check-in recorded',
              'Thanks! Your 3-day extension reward code is: HZ-WELL-TY\n\nEnter it on the Redeem screen.',
              [{text: 'Redeem Now', onPress: () => setActiveModal('promo')}, {text: 'Later'}],
            );
          },
        },
      ],
    );
  }, [recordWellnessCheckin, setActiveModal]);

  // Make a Post form state
  const [postUrl, setPostUrl] = useState('');
  const [postPlatform, setPostPlatform] = useState('');
  const [postDesc, setPostDesc] = useState('');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postDone, setPostDone] = useState(false);

  // Practitioner form state
  const [practName, setPractName] = useState('');
  const [practCredentials, setPractCredentials] = useState('');
  const [practPractice, setPractPractice] = useState('');
  const [practWebsite, setPractWebsite] = useState('');
  const [practEmail, setPractEmail] = useState('');
  const [practSubmitting, setPractSubmitting] = useState(false);
  const [practDone, setPractDone] = useState(false);

  const handleMakePost = useCallback(async () => {
    if (!postUrl.trim() || postSubmitting) return;
    setPostSubmitting(true);
    const result = await submitForm({
      type: 'post',
      post_url: postUrl.trim(),
      platform: postPlatform.trim(),
      description: postDesc.trim(),
    });
    setPostSubmitting(false);
    if (result.ok) {
      setPostDone(true);
      Alert.alert('Submitted!', result.message, [{text: 'OK'}]);
    } else {
      Alert.alert('Could not submit', result.message, [{text: 'OK'}]);
    }
  }, [postUrl, postPlatform, postDesc, postSubmitting]);

  const handlePractitioner = useCallback(async () => {
    if (!practName.trim() || !practEmail.trim() || practSubmitting) return;
    setPractSubmitting(true);
    const result = await submitForm({
      type: 'practitioner',
      full_name: practName.trim(),
      credentials: practCredentials.trim(),
      practice: practPractice.trim(),
      website: practWebsite.trim(),
      email: practEmail.trim(),
    });
    setPractSubmitting(false);
    if (result.ok) {
      setPractDone(true);
      Alert.alert('Application received!', result.message, [{text: 'OK'}]);
    } else {
      Alert.alert('Could not submit', result.message, [{text: 'OK'}]);
    }
  }, [practName, practCredentials, practPractice, practWebsite, practEmail, practSubmitting]);

  const openStore = useCallback(() => {
    const url = Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
    void Linking.openURL(url);
  }, []);

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Earn Free Premium</Text>
            <Text style={styles.subtitle}>Complete actions to earn promo codes</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          keyboardShouldPersistTaps="handled">

          {/* Referral card */}
          {myReferralCode != null && (
            <ReferralCard
              code={myReferralCode}
              expanded={expandedCardId === 'referral'}
              onToggleExpand={() => toggleCard('referral')}
            />
          )}

          <Text style={styles.sectionLabel}>STREAK REWARDS</Text>

          <EarnCard
            cardId="streak-7"
            expanded={expandedCardId === 'streak-7'}
            onToggleExpand={toggleCard}
            icon="🔥"
            title="7-Day Streak"
            description="Open Hertz Labs 7 days in a row."
            reward="7 days free"
            status={streakReward7Claimed ? 'claimed' : 'available'}
            ctaLabel={streak7Unlocked ? 'Claim Reward' : undefined}
            onCta={handleStreak7}
            extra={
              !streakReward7Claimed ? (
                <StreakBar current={Math.min(streakDays, 7)} target={7} />
              ) : undefined
            }
          />

          <EarnCard
            cardId="streak-30"
            expanded={expandedCardId === 'streak-30'}
            onToggleExpand={toggleCard}
            icon="⚡"
            title="30-Day Streak"
            description="Open Hertz Labs 30 days in a row."
            reward="1 month free"
            status={streakReward30Claimed ? 'claimed' : 'available'}
            ctaLabel={streak30Unlocked ? 'Claim Reward' : undefined}
            onCta={handleStreak30}
            extra={
              !streakReward30Claimed ? (
                <StreakBar current={Math.min(streakDays, 30)} target={30} />
              ) : undefined
            }
          />

          <Text style={styles.sectionLabel}>SOCIAL REWARDS</Text>

          <EarnCard
            cardId="refer-friend"
            expanded={expandedCardId === 'refer-friend'}
            onToggleExpand={toggleCard}
            icon="👥"
            title="Refer a Friend"
            description="Share your unique link. Earn 1 month free per install, plus 1 more if they purchase (up to 6 months)."
            reward="Up to 6 months"
            rewardVariant="cyan"
            status="available"
          />

          <EarnCard
            cardId="review"
            expanded={expandedCardId === 'review'}
            onToggleExpand={toggleCard}
            icon="⭐"
            title="Leave a Review"
            description="Rate Hertz Labs in the App Store or Google Play."
            reward="7 days free"
            status={reviewRewardClaimed ? 'claimed' : 'available'}
            ctaLabel="Rate the App"
            onCta={() => void handleReview()}
          />

          <EarnCard
            cardId="share-link"
            expanded={expandedCardId === 'share-link'}
            onToggleExpand={toggleCard}
            icon="📱"
            title="Share with a Link"
            description="Share your unique referral link to any platform. Tracked via link attribution."
            reward="7 days free"
            status="available"
            ctaLabel="Share Now"
            onCta={() =>
              void Share.share({
                message: `Hertz Labs — binaural beats for focus, sleep & meditation. ${SHARE_URL}`,
                url: SHARE_URL,
              })
            }
          />

          <EarnCard
            cardId="make-post"
            expanded={expandedCardId === 'make-post'}
            onToggleExpand={toggleCard}
            icon="📸"
            title="Make a Post"
            description="Post about Hertz Labs on Instagram, TikTok, X, YouTube, Reddit or a blog — with original text and visual/video content. Submit the public URL for review."
            reward="1 month free"
            status={postDone ? 'claimed' : 'available'}
            extra={
              !postDone ? (
                <View style={styles.form}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Post URL (required)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={postUrl}
                    onChangeText={setPostUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    {...FORM_INPUT_ANDROID}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Platform (Instagram, TikTok, X, YouTube…)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={postPlatform}
                    onChangeText={setPostPlatform}
                    {...FORM_INPUT_ANDROID}
                  />
                  <TextInput
                    style={[styles.formInput, styles.formInputMulti]}
                    placeholder="Brief description of your post"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={postDesc}
                    onChangeText={setPostDesc}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    {...FORM_INPUT_ANDROID}
                  />
                  <Pressable
                    style={[styles.formBtn, (!postUrl.trim() || postSubmitting) && styles.formBtnDisabled]}
                    onPress={() => void handleMakePost()}
                    disabled={!postUrl.trim() || postSubmitting}>
                    {postSubmitting
                      ? <ActivityIndicator size="small" color={GOLD} />
                      : <Text style={styles.formBtnText}>Submit for Review</Text>
                    }
                  </Pressable>
                </View>
              ) : undefined
            }
          />

          <EarnCard
            cardId="focus-challenge"
            expanded={expandedCardId === 'focus-challenge'}
            onToggleExpand={toggleCard}
            icon="🏆"
            title="30-Day Focus Challenge"
            description="Complete a 30-day 'binaural focus challenge' with daily check-ins and submit a final recap post."
            reward="Lifetime 20% off"
            rewardVariant="cyan"
            status="soon"
          />

          <Text style={styles.sectionLabel}>WELLNESS REWARDS</Text>

          <EarnCard
            cardId="wellness"
            expanded={expandedCardId === 'wellness'}
            onToggleExpand={toggleCard}
            icon="🧘"
            title="Wellness Check-in"
            description="Answer a short 3-question wellness survey every 14 days. Data stays on your device."
            reward="3 days free"
            status="available"
            ctaLabel={
              canWellnessCheckin
                ? 'Check in Now'
                : `${wellnessCheckinCount} check-in${wellnessCheckinCount !== 1 ? 's' : ''} done`
            }
            onCta={canWellnessCheckin ? handleWellnessCheckin : undefined}
          />

          <Text style={styles.sectionLabel}>MILESTONE REWARDS</Text>

          <EarnCard
            cardId="anniversary"
            expanded={expandedCardId === 'anniversary'}
            onToggleExpand={toggleCard}
            icon="🎂"
            title="1-Year Anniversary"
            description="Celebrate your first year with Hertz Labs."
            reward="1 month free"
            status={
              anniversaryRewardClaimed
                ? 'claimed'
                : anniversaryUnlocked
                  ? 'available'
                  : 'available'
            }
            ctaLabel={anniversaryUnlocked ? 'Claim Anniversary Reward' : undefined}
            onCta={anniversaryUnlocked ? handleAnniversary : undefined}
            extra={
              !anniversaryRewardClaimed && firstInstallDate != null && !anniversaryUnlocked ? (
                <Text style={styles.anniversaryNote}>
                  {365 - daysSince(firstInstallDate)} days until your 1-year anniversary
                </Text>
              ) : undefined
            }
          />

          <EarnCard
            cardId="practitioner"
            expanded={expandedCardId === 'practitioner'}
            onToggleExpand={toggleCard}
            icon="🩺"
            title="Practitioner / Therapist"
            description="Healthcare or wellness practitioner? Apply for a partnership: 3 months free for you plus a 30% referral code for your clients."
            reward="3 months + 30% code"
            rewardVariant="cyan"
            status={practDone ? 'claimed' : 'available'}
            extra={
              !practDone ? (
                <View style={styles.form}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Full name (required)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={practName}
                    onChangeText={setPractName}
                    {...FORM_INPUT_ANDROID}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Credentials / role (e.g. Psychologist, RN)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={practCredentials}
                    onChangeText={setPractCredentials}
                    {...FORM_INPUT_ANDROID}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Practice or organisation"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={practPractice}
                    onChangeText={setPractPractice}
                    {...FORM_INPUT_ANDROID}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Website"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={practWebsite}
                    onChangeText={setPractWebsite}
                    autoCapitalize="none"
                    keyboardType="url"
                    {...FORM_INPUT_ANDROID}
                  />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Your email (required)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={practEmail}
                    onChangeText={setPractEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    {...FORM_INPUT_ANDROID}
                  />
                  <Pressable
                    style={[styles.formBtn, (!practName.trim() || !practEmail.trim() || practSubmitting) && styles.formBtnDisabled]}
                    onPress={() => void handlePractitioner()}
                    disabled={!practName.trim() || !practEmail.trim() || practSubmitting}>
                    {practSubmitting
                      ? <ActivityIndicator size="small" color={GOLD} />
                      : <Text style={styles.formBtnText}>Submit Application</Text>
                    }
                  </Pressable>
                  <Text style={styles.formNote}>We'll review and reply to your email within 3 business days.</Text>
                </View>
              ) : undefined
            }
          />

          <EarnCard
            cardId="beta"
            expanded={expandedCardId === 'beta'}
            onToggleExpand={toggleCard}
            icon="🧪"
            title="Beta Tester"
            description="Received a special invite code from the Hertz Labs team? Redeem it for early feature access and 1 month free."
            reward="1 month free"
            status="available"
            ctaLabel="Redeem Invite Code"
            onCta={() => setActiveModal('promo')}
          />

          {/* Footer link */}
          <Pressable
            style={styles.footerLink}
            onPress={() => setActiveModal('promo')}
            accessibilityRole="button">
            <Text style={styles.footerLinkText}>Already have a code? Redeem it here →</Text>
          </Pressable>

          <Text style={styles.legalNote}>
            Referral rewards are credited after your friend installs and opens the app. Share
            rewards require a qualifying action. Only one reward per action. Subject to Hertz Labs
            Terms of Service. Incentivised reviews must reflect honest opinions.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    zIndex: 105,
  },
  sheet: {
    backgroundColor: '#0D0E18',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerLeft: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: MUTED,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  // Referral card
  referralCard: {
    backgroundColor: 'rgba(92,225,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.2)',
    padding: 16,
    marginBottom: 6,
    gap: 6,
  },
  referralHeaderBtn: {
    gap: 4,
  },
  referralHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralCodePreview: {
    fontFamily: HertzTheme.mono,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  referralLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: CYAN,
    letterSpacing: 1.2,
  },
  referralCode: {
    fontFamily: HertzTheme.mono,
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  referralLink: {
    fontFamily: HertzTheme.mono,
    fontSize: 11,
    color: MUTED,
  },
  referralActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  referralBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(92,225,255,0.35)',
    backgroundColor: 'rgba(92,225,255,0.1)',
  },
  referralBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: CYAN,
  },
  referralNote: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 16,
    marginTop: 4,
  },
  // Earn card
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 10,
  },
  cardHeaderBtn: {
    marginHorizontal: -4,
    marginTop: -4,
    padding: 4,
    borderRadius: 8,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  chevron: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '700',
    lineHeight: 16,
  },
  cardClaimed: {
    opacity: 0.65,
    borderColor: SUCCESS_BORDER,
    backgroundColor: SUCCESS_DIM,
  },
  cardSoon: {
    opacity: 0.55,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardIcon: {
    fontSize: 24,
    lineHeight: 30,
    width: 32,
    textAlign: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTitleClaimed: {
    color: SUCCESS,
  },
  cardDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  claimedNote: {
    fontSize: 11,
    color: SUCCESS,
    fontStyle: 'italic',
  },
  // Streak bar
  streakBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  streakBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: MAGENTA,
  },
  streakBarLabel: {
    fontSize: 11,
    color: MUTED,
    minWidth: 70,
    textAlign: 'right',
  },
  anniversaryNote: {
    fontSize: 11,
    color: MUTED,
    fontStyle: 'italic',
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerLinkText: {
    fontSize: 13,
    color: CYAN,
    textDecorationLine: 'underline',
  },
  legalNote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  form: {
    gap: 8,
    marginTop: 4,
  },
  formInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  formInputMulti: {
    minHeight: 88,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  formBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    backgroundColor: GOLD_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  formBtnDisabled: {
    opacity: 0.4,
  },
  formBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  formNote: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 16,
    marginTop: 2,
  },
});
