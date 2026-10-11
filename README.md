# SayStrike Android MVP

SayStrike is a React Native app for short, low-pressure English speaking
practice. The first demo uses one prepared city-life sentence and one pixel-art
boss fight. App UI, state, and product logic live in TypeScript/JavaScript;
Expo CNG generates Android build files as ignored build output.

## Run locally

Requirements: Node.js 22.13 or newer, npm, Android Studio/Android SDK Platform
36 and Build Tools 36.0.0, Android NDK 27.1.12297006, and JDK 17. Android 8
(API 26) is the minimum supported device level.

```sh
npm ci
npm start
```

Connect an Android device or start an emulator, then press `a` in Expo CLI, or
run `npm run android`. The app asks for microphone access only after the user
starts a recording. It does not record while in the background.

## Build an installable demo APK

```sh
npm ci
npm run build:android-apk
```

The script runs Expo prebuild and Gradle `assembleRelease` in the internal demo
configuration, verifies the APK's
effective minimum SDK from the built package, then prints its path. Install it
on a connected device with:

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

See [Android APK build and evaluation setup](docs/android-apk.md) for details.

## Validate

```sh
npm test
npm run typecheck
npm run check:expo-deps
```

Development and internal demo builds use a deterministic, clearly labeled DEMO
transcript when no service is configured. The internal demo opts into this mode
explicitly; production builds without an endpoint display “Chưa đánh giá được”
and apply no damage. Configure the server-side transcription adapter as
described in the build guide; never place provider credentials in the app
bundle.
