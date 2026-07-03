import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {requestAppReview} from '../monetization/requestAppReview';
import {useHertzStore} from '../state/store';
import {daysSince} from '../state/slices/promo';
import {HertzTheme} from '../theme/hertzTheme';
import {macScaledFont} from '../platform/macTypography';

const fs = macScaledFont;
import {storeListingShareLabel, shareStoreListing} from '../services/referralLinkService';
import {useModalScrollInsets} from '../components/layout/useModalScrollInsets';
import {HELLO_EMAIL} from '../constants/appInfo';
import {AppMessageForm} from '../components/messaging/AppMessageForm';
import {sendPractitionerFallback, sendPromoPostFallback} from '../promos/promoMessageFallback';
import {fetchPromoRewardStatus} from '../promos/checkPromoRewards';
import {claimPromoReward, type InAppRewardType} from '../promos/claimPromoReward';
import {registerReferrer} from '../promos/registerReferrer';
import {showStoreOfferAlert} from '../promos/showStoreOfferAlert';
import {submitPromoForm} from '../promos/submitPromoForm';
import {getRcAppUserId} from '../promos/getRcAppUserId';
import {isValidEmail} from '../utils/email';
import {
  betaApprovedNote,
  betaPendingNote,
  outreachSubmitSuffix,
  promoApprovedAlertBody,
  promoCodeNoun,
  promoPendingReviewLine,
  promoRedeemFooter,
  rateAppDescription,
} from '../monetization/storePromoCopy';
import {
  nextUnclaimedStreakBonus,
  STREAK_BONUS_DAYS,
  STREAK_REWARD_30_DAYS,
  STREAK_REWARD_7_DAYS,
  streakBonusProgress,
} from '../promos/streakRewards';

const FORM_INPUT_ANDROID = Platform.select({
  android: {includeFontPadding: false} as const,
  default: {},
});

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
  status: 'available' | 'claimed' | 'soon' | 'pending';
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
  const isPending = status === 'pending';
  return (
    <View
      style={[
        styles.card,
        isClaimed && styles.cardClaimed,
        isSoon && styles.cardSoon,
        isPending && styles.cardPending,
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
              label={
                isClaimed
                  ? '✓ Claimed'
                  : isPending
                    ? 'Under review'
                    : isSoon
                      ? 'Soon'
                      : reward
              }
              variant={
                isClaimed ? 'green' : isPending ? 'cyan' : isSoon ? 'muted' : rewardVariant
              }
            />
            <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
          </View>
        </View>
      </Pressable>
      {expanded && (
        <>
          {extra}
          {!isClaimed && !isSoon && !isPending && ctaLabel != null && (
            <Pressable
              style={styles.cardBtn}
              onPress={onCta}
              accessibilityRole="button">
              <Text style={styles.cardBtnText}>{ctaLabel}</Text>
            </Pressable>
          )}
          {isClaimed && (
            <Text style={styles.claimedNote}>
              Store offer claimed — open Promos → Redeem and paste your App Store or Google Play
              code.
            </Text>
          )}
          {isPending && (
            <Text style={styles.claimedNote}>
              {promoPendingReviewLine()}
              (usually within 48 hours). Reply to our email if you have questions.
            </Text>
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
  const streakBonusMilestonesClaimed = useHertzStore(s => s.streakBonusMilestonesClaimed);
  const anniversaryRewardClaimed = useHertzStore(s => s.anniversaryRewardClaimed);
  const wellnessCheckinCount = useHertzStore(s => s.wellnessCheckinCount);
  const lastWellnessCheckinDate = useHertzStore(s => s.lastWellnessCheckinDate);
  const postSubmissionPending = useHertzStore(s => s.postSubmissionPending);
  const postRewardGranted = useHertzStore(s => s.postRewardGranted);
  const practitionerSubmissionPending = useHertzStore(s => s.practitionerSubmissionPending);
  const practitionerRewardGranted = useHertzStore(s => s.practitionerRewardGranted);
  const betaRequestPending = useHertzStore(s => s.betaRequestPending);
  const betaRewardGranted = useHertzStore(s => s.betaRewardGranted);

  const generateMyReferralCode = useHertzStore(s => s.generateMyReferralCode);
  const setClipboardPromoCode = useHertzStore(s => s.setClipboardPromoCode);
  const markPostSubmissionPending = useHertzStore(s => s.markPostSubmissionPending);
  const markPractitionerSubmissionPending = useHertzStore(s => s.markPractitionerSubmissionPending);
  const markBetaRequestPending = useHertzStore(s => s.markBetaRequestPending);
  const syncPromoRewardStatuses = useHertzStore(s => s.syncPromoRewardStatuses);
  const markReviewRewardClaimed = useHertzStore(s => s.markReviewRewardClaimed);
  const markStreakReward7Claimed = useHertzStore(s => s.markStreakReward7Claimed);
  const markStreakReward30Claimed = useHertzStore(s => s.markStreakReward30Claimed);
  const markStreakBonusMilestoneClaimed = useHertzStore(s => s.markStreakBonusMilestoneClaimed);
  const markAnniversaryRewardClaimed = useHertzStore(s => s.markAnniversaryRewardClaimed);

  const [pendingReferInstallClaims, setPendingReferInstallClaims] = useState(0);
  const [claimingReward, setClaimingReward] = useState(false);

  // Initialise on first visit
  useEffect(() => {
    generateMyReferralCode();
  }, [generateMyReferralCode]);

  useEffect(() => {
    if (myReferralCode == null) {
      return;
    }
    void registerReferrer(myReferralCode);
  }, [myReferralCode]);

  // Sync admin-approved rewards from server (post / practitioner / beta).
  const prevRewardSnapshot = useRef<{post: boolean; practitioner: boolean; beta: boolean}>({
    post: postRewardGranted,
    practitioner: practitionerRewardGranted,
    beta: betaRewardGranted,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const statuses = await fetchPromoRewardStatus();
      if (cancelled || statuses == null) {
        return;
      }

      const newlyApproved = {
        post: statuses.post === 'approved' && !prevRewardSnapshot.current.post,
        practitioner:
          statuses.practitioner === 'approved' && !prevRewardSnapshot.current.practitioner,
        beta: statuses.beta === 'approved' && !prevRewardSnapshot.current.beta,
      };

      syncPromoRewardStatuses(statuses);
      setPendingReferInstallClaims(statuses.pendingReferInstallClaims);
      prevRewardSnapshot.current = {
        post: statuses.post === 'approved',
        practitioner: statuses.practitioner === 'approved',
        beta: statuses.beta === 'approved',
      };

      if (newlyApproved.post) {
        Alert.alert('Post approved', promoApprovedAlertBody(), [{text: 'OK'}]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncPromoRewardStatuses]);

  const dismiss = useCallback(() => setActiveModal(null), [setActiveModal]);

  const claimStoreReward = useCallback(
    async (rewardType: InAppRewardType, rewardKey?: string): Promise<boolean> => {
      setClaimingReward(true);
      const result = await claimPromoReward(rewardType, rewardKey);
      setClaimingReward(false);
      if (!result.ok) {
        Alert.alert('Could not claim reward', result.error, [{text: 'OK'}]);
        return false;
      }
      setClipboardPromoCode(result.code);
      setPendingReferInstallClaims(result.pendingReferInstallClaims);
      showStoreOfferAlert({
        title: 'Reward claimed',
        code: result.code,
        onCopy: setClipboardPromoCode,
        onRedeem: () => setActiveModal('promo'),
      });
      return true;
    },
    [setActiveModal, setClipboardPromoCode],
  );

  // Derived booleans
  const anniversaryUnlocked =
    !anniversaryRewardClaimed &&
    firstInstallDate != null &&
    daysSince(firstInstallDate) >= 365;

  const streak7Unlocked = !streakReward7Claimed && streakDays >= 7;
  const streak30Unlocked = !streakReward30Claimed && streakDays >= 30;
  const nextStreakBonus = nextUnclaimedStreakBonus(streakDays, streakBonusMilestonesClaimed);
  const streakBonusUnlocked = nextStreakBonus != null && streakDays >= nextStreakBonus;

  const canWellnessCheckin = (() => {
    if (lastWellnessCheckinDate == null) {
      return true;
    }
    return daysSince(lastWellnessCheckinDate) >= 7;
  })();

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleReview = useCallback(async () => {
    await requestAppReview();
    Alert.alert(
      'Finish your review',
      'After you submit your rating in the store, tap Claim reward to receive your offer code.',
      [
        {text: 'Not now', style: 'cancel'},
        {
          text: 'Claim reward',
          onPress: () => {
            void (async () => {
              const claimed = await claimStoreReward('review');
              if (claimed) {
                markReviewRewardClaimed();
              }
            })();
          },
        },
      ],
    );
  }, [claimStoreReward, markReviewRewardClaimed]);

  const handleStreak7 = useCallback(async () => {
    const claimed = await claimStoreReward('streak_7');
    if (claimed) {
      markStreakReward7Claimed();
    }
  }, [claimStoreReward, markStreakReward7Claimed]);

  const handleStreak30 = useCallback(async () => {
    const claimed = await claimStoreReward('streak_30');
    if (claimed) {
      markStreakReward30Claimed();
    }
  }, [claimStoreReward, markStreakReward30Claimed]);

  const handleStreakBonus = useCallback(async () => {
    if (nextStreakBonus == null) {
      return;
    }
    const claimed = await claimStoreReward('streak_bonus', String(nextStreakBonus));
    if (claimed) {
      markStreakBonusMilestoneClaimed(nextStreakBonus);
    }
  }, [claimStoreReward, markStreakBonusMilestoneClaimed, nextStreakBonus]);

  const handleAnniversary = useCallback(async () => {
    const claimed = await claimStoreReward('anniversary');
    if (claimed) {
      markAnniversaryRewardClaimed();
    }
  }, [claimStoreReward, markAnniversaryRewardClaimed]);

  const handleReferInstallClaim = useCallback(async () => {
    await claimStoreReward('refer_install');
  }, [claimStoreReward]);

  const handleWellnessCheckin = useCallback(() => {
    setActiveModal('wellnessCheckin');
  }, [setActiveModal]);

  // Make a Post form state
  const [postUrl, setPostUrl] = useState('');
  const [postPlatform, setPostPlatform] = useState('');
  const [postDesc, setPostDesc] = useState('');
  const [postEmail, setPostEmail] = useState('');
  const [postSubmitting, setPostSubmitting] = useState(false);

  // Practitioner form state
  const [practName, setPractName] = useState('');
  const [practCredentials, setPractCredentials] = useState('');
  const [practPractice, setPractPractice] = useState('');
  const [practWebsite, setPractWebsite] = useState('');
  const [practEmail, setPractEmail] = useState('');
  const [practSubmitting, setPractSubmitting] = useState(false);

  const postReviewStatus = postRewardGranted
    ? 'claimed'
    : postSubmissionPending
      ? 'pending'
      : 'available';
  const practitionerReviewStatus = practitionerRewardGranted
    ? 'claimed'
    : practitionerSubmissionPending
      ? 'pending'
      : 'available';
  const betaReviewStatus = betaRewardGranted
    ? 'claimed'
    : betaRequestPending
      ? 'pending'
      : 'available';

  const postEmailOk = isValidEmail(postEmail);
  const practEmailOk = isValidEmail(practEmail);
  const postCanSubmit = postUrl.trim().length > 0 && postEmailOk && !postSubmitting;
  const practCanSubmit = practName.trim().length > 0 && practEmailOk && !practSubmitting;

  const handleMakePost = useCallback(async () => {
    if (!postCanSubmit) {
      if (!postEmailOk) {
        Alert.alert('Email required', 'Enter a valid email so we can send your offer code when approved.', [{text: 'OK'}]);
      }
      return;
    }
    const rcUserId = await getRcAppUserId();
    if (rcUserId == null) {
      Alert.alert(
        'Account not ready',
        'Close the app completely, reopen it, wait a few seconds, then submit again so we can link your reward to your account.',
        [{text: 'OK'}],
      );
      return;
    }
    setPostSubmitting(true);
    const fields = {
      postUrl: postUrl.trim(),
      platform: postPlatform.trim(),
      description: postDesc.trim(),
      email: postEmail.trim(),
    };
    const result = await submitPromoForm({
      type: 'post',
      post_url: fields.postUrl,
      platform: fields.platform,
      description: fields.description,
      email: fields.email,
    });
    setPostSubmitting(false);
    if (result.ok) {
      markPostSubmissionPending();
      Alert.alert(
        'Submitted for review',
        `${result.message} ${outreachSubmitSuffix()}`,
        [{text: 'OK'}],
      );
      return;
    }
    const fallback = await sendPromoPostFallback(fields);
    if (fallback.ok) {
      markPostSubmissionPending();
      Alert.alert(
        'Sent for review',
        `${fallback.message} ${outreachSubmitSuffix()}`,
        [{text: 'OK'}],
      );
    } else {
      Alert.alert('Could not submit', fallback.message, [{text: 'OK'}]);
    }
  }, [postCanSubmit, postEmailOk, postUrl, postPlatform, postDesc, postEmail, markPostSubmissionPending]);

  const handlePractitioner = useCallback(async () => {
    if (!practCanSubmit) {
      if (!practEmailOk) {
        Alert.alert('Email required', 'Enter a valid email so we can send your offer code when approved.', [{text: 'OK'}]);
      }
      return;
    }
    setPractSubmitting(true);
    const fields = {
      fullName: practName.trim(),
      credentials: practCredentials.trim(),
      practice: practPractice.trim(),
      website: practWebsite.trim(),
      email: practEmail.trim(),
    };
    const result = await submitPromoForm({
      type: 'practitioner',
      full_name: fields.fullName,
      credentials: fields.credentials,
      practice: fields.practice,
      website: fields.website,
      email: fields.email,
    });
    setPractSubmitting(false);
    if (result.ok) {
      markPractitionerSubmissionPending();
      Alert.alert(
        'Application received',
        `${result.message} ${outreachSubmitSuffix()}`,
        [{text: 'OK'}],
      );
      return;
    }
    const fallback = await sendPractitionerFallback(fields);
    if (fallback.ok) {
      markPractitionerSubmissionPending();
      Alert.alert(
        'Sent for review',
        `${fallback.message} ${outreachSubmitSuffix()}`,
        [{text: 'OK'}],
      );
    } else {
      Alert.alert('Could not submit', fallback.message, [{text: 'OK'}]);
    }
  }, [
    practCanSubmit,
    practEmailOk,
    practName,
    practCredentials,
    practPractice,
    practWebsite,
    practEmail,
    markPractitionerSubmissionPending,
  ]);

  const handleShareStoreListing = useCallback(async () => {
    await shareStoreListing();
  }, []);

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Earn Free Premium</Text>
            <Text style={styles.subtitle}>Complete actions to earn {promoCodeNoun()}s</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={dismiss} accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionLabel}>STREAK REWARDS</Text>

          <EarnCard
            cardId="streak-7"
            expanded={expandedCardId === 'streak-7'}
            onToggleExpand={toggleCard}
            icon="🔥"
            title="7-Day Streak"
            description="Open Hertz Labs 7 days in a row."
            reward={`${STREAK_REWARD_7_DAYS} days free`}
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
            reward={`${STREAK_REWARD_30_DAYS} days free`}
            status={streakReward30Claimed ? 'claimed' : 'available'}
            ctaLabel={streak30Unlocked ? 'Claim Reward' : undefined}
            onCta={handleStreak30}
            extra={
              !streakReward30Claimed ? (
                <StreakBar current={Math.min(streakDays, 30)} target={30} />
              ) : undefined
            }
          />

          {nextStreakBonus != null && (
            <EarnCard
              cardId={`streak-bonus-${nextStreakBonus}`}
              expanded={expandedCardId === `streak-bonus-${nextStreakBonus}`}
              onToggleExpand={toggleCard}
              icon="🎯"
              title={`${nextStreakBonus}-Day Streak Bonus`}
              description={`Every 10 days after day 30 earns ${STREAK_BONUS_DAYS} more days free (${STREAK_BONUS_DAYS} days at 40, 50, 60…).`}
              reward={`${STREAK_BONUS_DAYS} days free`}
              status="available"
              ctaLabel={streakBonusUnlocked ? 'Claim Reward' : undefined}
              onCta={handleStreakBonus}
              extra={
                <StreakBar
                  current={streakBonusProgress(streakDays, nextStreakBonus).current}
                  target={streakBonusProgress(streakDays, nextStreakBonus).target}
                />
              }
            />
          )}

          <Text style={styles.sectionLabel}>SOCIAL REWARDS</Text>

          <EarnCard
            cardId="refer-friend"
            expanded={expandedCardId === 'refer-friend'}
            onToggleExpand={toggleCard}
            icon="👥"
            title="Refer a Friend"
            description="Send the App Store or Google Play link to a friend. When they install, claim a store offer code here (up to 6 months)."
            reward="Up to 6 months"
            rewardVariant="cyan"
            status="available"
            ctaLabel={storeListingShareLabel()}
            onCta={() => void handleShareStoreListing()}
            extra={
              pendingReferInstallClaims > 0 ? (
                <Pressable
                  style={styles.cardBtn}
                  onPress={() => void handleReferInstallClaim()}
                  disabled={claimingReward}>
                  {claimingReward ? (
                    <ActivityIndicator size="small" color={GOLD} />
                  ) : (
                    <Text style={styles.cardBtnText}>
                      Claim {promoCodeNoun()} ({pendingReferInstallClaims})
                    </Text>
                  )}
                </Pressable>
              ) : undefined
            }
          />

          <EarnCard
            cardId="review"
            expanded={expandedCardId === 'review'}
            onToggleExpand={toggleCard}
            icon="⭐"
            title="Leave a Review"
            description={rateAppDescription()}
            reward="7 days free"
            status={reviewRewardClaimed ? 'claimed' : 'available'}
            ctaLabel="Rate the App"
            onCta={() => void handleReview()}
          />

          <EarnCard
            cardId="make-post"
            expanded={expandedCardId === 'make-post'}
            onToggleExpand={toggleCard}
            icon="📸"
            title="Make a Post"
            description="Post about Hertz Labs on Instagram, TikTok, X, YouTube, Reddit or a blog — with original text and visual/video content. Submit the public URL for review."
            reward="1 month free"
            status={postReviewStatus}
            extra={
              postReviewStatus === 'available' ? (
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
                  <TextInput
                    style={styles.formInput}
                    placeholder="Your email (required — we send your offer code here)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={postEmail}
                    onChangeText={setPostEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    {...FORM_INPUT_ANDROID}
                  />
                  <Pressable
                    style={[styles.formBtn, !postCanSubmit && styles.formBtnDisabled]}
                    onPress={() => void handleMakePost()}
                    disabled={!postCanSubmit}>
                    {postSubmitting
                      ? <ActivityIndicator size="small" color={GOLD} />
                      : <Text style={styles.formBtnText}>Submit for Review</Text>
                    }
                  </Pressable>
                  <Text style={styles.formNote}>
                    Submissions are sent to {HELLO_EMAIL} from the app. If the primary submit fails,
                    we retry via in-app messaging.
                  </Text>
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
            description="Complete a 3-question wellness survey once per week. Responses are saved securely; reward is 3 days Premium."
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
            description="Healthcare or wellness practitioner? Apply for a partnership — 3 months free for you."
            reward="3 months free"
            rewardVariant="cyan"
            status={practitionerReviewStatus}
            extra={
              practitionerReviewStatus === 'available' ? (
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
                    placeholder="Your email (required — we send your offer code here)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={practEmail}
                    onChangeText={setPractEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    {...FORM_INPUT_ANDROID}
                  />
                  <Pressable
                    style={[styles.formBtn, !practCanSubmit && styles.formBtnDisabled]}
                    onPress={() => void handlePractitioner()}
                    disabled={!practCanSubmit}>
                    {practSubmitting
                      ? <ActivityIndicator size="small" color={GOLD} />
                      : <Text style={styles.formBtnText}>Submit Application</Text>
                    }
                  </Pressable>
                  <Text style={styles.formNote}>
                    Applications are sent to {HELLO_EMAIL} from the app.
                  </Text>
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
            description="Want early access to new features? Send the team a message to join the beta program."
            reward="1 month free"
            status={betaReviewStatus}
            extra={
              expandedCardId === 'beta' ? (
                betaReviewStatus === 'available' ? (
                <AppMessageForm
                  variant="promo"
                  to="hello"
                  subject="Hertz Labs — Beta tester interest"
                  category="promo_beta"
                  placeholder="Tell us why you want to beta test and any devices you use…"
                  prompt={`Apply for beta access — message goes to ${HELLO_EMAIL}. Your email below is required so we can send your offer code.`}
                  sendLabel="Send beta request"
                  requireFromEmail
                  fromEmailPlaceholder="Your email (required — we reply here when approved)"
                  onSent={markBetaRequestPending}
                />
                ) : (
                  <Text style={styles.formNote}>
                    {betaReviewStatus === 'pending' ? betaPendingNote() : betaApprovedNote()}
                  </Text>
                )
              ) : undefined
            }
          />

          {/* Footer link */}
          <Pressable
            style={styles.footerLink}
            onPress={() => setActiveModal('promo')}
            accessibilityRole="button">
            <Text style={styles.footerLinkText}>{promoRedeemFooter()}</Text>
          </Pressable>

          <Text style={styles.legalNote}>
            Store offer codes are redeemed through the App Store or Google Play. Only one reward
            per action. Subject to Hertz Labs Terms of Service. Incentivised reviews must reflect
            honest opinions.
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
    fontSize: fs(22),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fs(13),
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
    fontSize: fs(10),
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  referralInline: {
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  // Referral card (legacy styles kept for inline section)
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
  cardPending: {
    borderColor: 'rgba(92,225,255,0.25)',
    backgroundColor: 'rgba(92,225,255,0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardIcon: {
    fontSize: fs(24),
    lineHeight: 30,
    width: 32,
    textAlign: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: fs(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTitleClaimed: {
    color: SUCCESS,
  },
  cardDesc: {
    fontSize: fs(12),
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
    fontSize: fs(11),
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
