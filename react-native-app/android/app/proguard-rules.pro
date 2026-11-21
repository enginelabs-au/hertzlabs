# Hertz Labs release ProGuard / R8 rules.
# Keep bridge/JNI entry points; allow obfuscation of the rest (Play DEX optimization).

# React Native / Hermes / Yoga are covered by react-android consumer rules.
# Reanimated / worklets
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.common.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# Safe area
-keep class com.th3rdwave.safeareacontext.** { *; }

# RevenueCat
-keep class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

# Notifee
-keep class io.invertase.notifee.** { *; }
-dontwarn io.invertase.notifee.**

# PostHog
-keep class com.posthog.** { *; }
-dontwarn com.posthog.**

# Oboe / native audio
-keep class com.google.oboe.** { *; }
-keep class com.hertzlabs.binauralbeats.audio.** { *; }

# Keep line numbers for crash deobfuscation (mapping.txt uploaded with Play App Bundle)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
