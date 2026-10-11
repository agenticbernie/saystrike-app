# Decision 0001: Expo CNG for the React Native Android MVP

Date: 2026-10-11
Status: Accepted for the MVP

## Context

The repository had no app, React Native framework, Android project, or package
manifest to preserve. The product must be React Native, support Android API 26,
record only after a user gesture, and avoid product implementation in custom
Kotlin/Java code.

## Decision

Use Expo SDK 57 with React Native 0.86 and Expo Continuous Native Generation.
Use the React Native `expo-audio` API for foreground microphone capture and
`expo-speech` for the English reference voice. Set the minimum Android SDK to
26 in Expo build properties. Keep generated `android/` output ignored; do not
add custom native modules or Android product behavior.

Keep speech recognition behind the documented HTTP adapter. No endpoint was
configured in this repository, so development and explicit internal demo
results are visibly marked DEMO. Production builds without a configured
endpoint remain unrated.

## Consequences

- Local APK builds need Node/npm, JDK 17, and the Android SDK/NDK versions in
  the build guide.
- CI creates an installable internal demo APK from generated Android output.
- Android 8 compatibility is verified from the APK manifest minimum SDK; an
  Android 8 device run remains a separate validation requirement.
- No provider secret is distributed in the JS bundle or APK.
