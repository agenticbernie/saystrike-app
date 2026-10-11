# Android APK build and evaluation setup

## Local prerequisites

- Node.js 22.13+ and npm (the repository uses `package-lock.json`).
- JDK 17.
- Android SDK Platform 36, Build Tools 36.0.0, and NDK 27.1.12297006.
- A physical Android device or emulator for interactive audio testing. Android
  8 / API 26 is the minimum app level.

Expo SDK 57 / React Native 0.86 supports Android 7 and newer. The build config
sets minSdkVersion to 26. The APK build script checks the APK's packaged
`sdkVersion` after Gradle completes, so a configured value alone is not treated
as proof.

## Commands

```sh
npm ci
npm test
npm run typecheck
npm run check:expo-deps
npm run build:android-apk
```

`build:android-apk` generates the ignored Android project with Expo prebuild,
sets the explicit internal-demo build flag, runs `:app:assembleRelease`, and
reports `android/app/build/outputs/apk/release/app-release.apk`. The release
variant bundles JavaScript so the APK launches without Metro; this internal
demo artifact is not a production release. Install it with:

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

To open the development app on an attached device/emulator, run `npm start` and
choose Android in Expo CLI, or use `npm run android`.

## Speech service

No speech backend or credential is present in this repository. Development and
the internal demo build without a backend use an obviously marked mock
transcript to exercise the battle UI; it does not analyze the recording.
Production builds with no endpoint show an unrated result and no damage.

To connect a backend, provide
`EXPO_PUBLIC_SPEECH_TRANSCRIPTION_URL=https://your-server.example/transcribe`
at build time. The server accepts multipart field `audio` and returns
`{"transcript":"..."}`. Keep model/provider secrets on the server; do not add
tokens to `.env` values with the `EXPO_PUBLIC_` prefix. The adapter has a
12-second timeout, requires HTTPS, and maps failed or malformed responses to
an unrated result.

## GitHub Actions artifact

`.github/workflows/android-apk.yml` builds the internal demo APK on pushes, pull
requests, and manual dispatch, and uploads an artifact named
`saystrike-demo-apk`. Download it from that workflow run's **Artifacts** area.
This is an installable demo artifact, not a Play Store release. The workflow
generates the Android project with Expo prebuild during the build, so Gradle
dependency caching is not enabled by `setup-java` before those Gradle files
exist.

## Device checks and limits

On a device, test the reference voice, microphone permission allow/deny, a
short recording, a normal recording, audio service/network failure, retry, and
ending the battle. The current build container has no JDK, Android SDK, adb, or
Android 8 device, so a local APK/device run must be reported as unavailable
until performed in a configured environment.
