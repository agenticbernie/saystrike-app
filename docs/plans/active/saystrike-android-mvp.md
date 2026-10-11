# Execution Plan: SayStrike Android MVP

Date: 2026-10-11

## Status

Blocked

## Outcome

Create an Expo + React Native Android MVP that completes the Stitch guided
speaking challenge, including microphone recording, honestly labeled
development scoring, a configurable transcription adapter, boss damage rules,
tests, and an APK build path.

## Context

- `AGENTS.md`, `docs/README.md`, and `docs/WORKFLOW.md` are repository guidance.
- `docs/product/README.md` states that no consumer product contract exists yet.
- Stitch project `6221384195159582663`, “SayStrike Pixel Speaking Quest”, is
  the visual authority. It contains challenge selection, sentence selection,
  boss fight, scored result, unrated result, and completion screens.
- User request is product authority for the single prepared English sentence,
  recording consent, approximate transcript matching, boss damage thresholds,
  Android API 26 support, and no custom Kotlin/Java feature code.
- The checkout currently contains no application, package manifest, lockfile,
  CI workflow, backend configuration, or useful Git metadata. Node 24/npm 11
  are installed; Java and Android SDK/adb are absent.

## Scope

In scope:

- New Expo-managed React Native TypeScript app with Android minimum SDK 26.
- Stitch-aligned Vietnamese UI, prepared demo sentence, English TTS sample,
  foreground recording, permission/error handling, evaluation adapter, and
  non-punitive boss health/damage loop.
- Unit tests for transcript normalization/matching, error/unrated paths, and
  damage thresholds/interpolation.
- Internal demo APK script, GitHub Actions APK artifact workflow, and setup/build
  documentation.

Out of scope:

- Social media imports, production AI backend, auth, long-term recording
  storage, Play Store publication, native feature code, and device claims not
  backed by a device run.

## Approach

1. Verify the Stitch screen images and current Expo/audio/build compatibility.
2. Add the product contract and task-local architecture/build decision.
3. Implement the React Native flow and isolated pure evaluation/game modules.
4. Add focused tests, Android config with API 26 floor, local APK script, CI,
   and developer documentation.
5. Install dependencies, run tests/type checks/prebuild, inspect generated
   Android minSdk/manifest, and build an APK if the environment has a usable
   JDK/Android toolchain.

## Risks And Recovery

- No backend is configured. Development scoring must say DEMO and must be
  disabled in production builds. Without a configured backend, release builds
  show “Chưa đánh giá được” and apply no damage.
- Stitch screenshot assets were fetched with approved access and visually
  inspected. The React Native source was compared against their layouts and
  palette; a running-app screenshot is still unavailable without an Android
  build/device.
- No local Java/Android SDK is present. CI/local commands can be authored and
  configuration inspected, but APK artifact creation requires a toolchain.
- Expo CNG native shell may generate standard Kotlin/Java framework glue during
  prebuild. Do not add product behavior or custom native modules there; keep
  generated native output ignored.

## Progress

- [x] Survey repository instructions, status, files, Harness inventory, and
  toolchain availability.
- [x] Open Stitch project/screens through the available Stitch MCP API.
- [x] Verify Stitch screenshots and compare implemented UI states.
- [x] Create React Native app and product/decision documentation.
- [x] Implement end-to-end practice/boss flow and unit tests.
- [x] Add APK script, CI artifact workflow, and build guide.
- [x] Run Expo prebuild and inspect generated minimum SDK, microphone
  permission, and internal demo signing configuration.
- [x] Pass unit tests, TypeScript, Expo dependency check, and Metro Android
  production export for the internal demo variant.
- [ ] Build the APK and verify the packaged min SDK on a machine/CI runner with
  JDK 17 and Android SDK/NDK.

## Decisions

- 2026-10-11: Select Expo CNG because this repository has no React Native
  architecture to preserve, Expo supplies React Native playback/recording APIs,
  and generated native projects can remain build output instead of checked-in
  product code.
- 2026-10-11: Keep recognition behind an HTTP adapter. Do not invent a live
  backend; development and explicit internal demo scoring are visibly labeled
  DEMO, and production without a configured endpoint produces an unrated result.
- 2026-10-11: Use normalized word edit similarity as “Ước lượng khớp câu”, not
  pronunciation accuracy; do not persist recordings beyond Expo's cache.

## Validation

- Focused proof: `npm test` (17/17 pass), `npm run typecheck`, and
  `npm run check:expo-deps` (dependencies up to date).
- Integration/build proof: Expo prebuild passed; generated Gradle config has
  `android.minSdkVersion=26`, generated manifest has `RECORD_AUDIO`, and no
  foreground microphone service. Metro exported a 1.6 MB Android bundle.
- APK proof: `npm run build:android-apk` stopped at its JDK prerequisite because
  this environment has no Java, Android SDK, NDK, or adb. No APK was produced.
- CI workflow YAML parsed and contains an artifact upload step; no workflow run
  can be observed from this checkout.
- Repository-required checks: none are installed or documented at baseline.

## Result

The React Native app, product/evaluation modules, tests, local build script, CI
artifact workflow, and setup docs are implemented. Implementation-side checks
pass. This checkout has no usable Git metadata, Java/JDK, Android SDK/NDK, or
device, so no APK or Android 8 runtime evidence exists. Resume this plan on a
configured runner and inspect the produced APK before marking it complete.

The npm audit check also reports 15 high and 7 moderate transitive advisories
in the Expo/Metro package graph; `npm audit --force` proposes downgrading Expo
to 44, so no broad downgrade was applied.
