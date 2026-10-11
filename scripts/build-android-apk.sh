#!/usr/bin/env bash
set -euo pipefail

if ! command -v java >/dev/null 2>&1; then
  echo "JDK 17 is required. Install it and set JAVA_HOME before building." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  echo "Android SDK is required. Set ANDROID_HOME or ANDROID_SDK_ROOT." >&2
  exit 1
fi

sdk_root="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
for required in "$sdk_root/platforms/android-36" "$sdk_root/build-tools/36.0.0" "$sdk_root/ndk/27.1.12297006"; do
  if [[ ! -d "$required" ]]; then
    echo "Missing Android build prerequisite: $required" >&2
    exit 1
  fi
done

if [[ ! -d node_modules ]]; then
  echo "Dependencies are missing. Run npm ci first." >&2
  exit 1
fi

export EXPO_PUBLIC_DEMO_BUILD=1
npx expo prebuild --platform android
./android/gradlew --project-dir android :app:assembleRelease

apk="android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -s "$apk" ]]; then
  echo "Gradle finished without creating $apk" >&2
  exit 1
fi

aapt="$sdk_root/build-tools/36.0.0/aapt"
if [[ ! -x "$aapt" ]]; then
  echo "Android aapt tool is missing: $aapt" >&2
  exit 1
fi

sdk_line="$("$aapt" dump badging "$apk" | rg '^sdkVersion:')"
if [[ "$sdk_line" != "sdkVersion:'26'" ]]; then
  echo "Expected built APK minimum SDK 26, observed: ${sdk_line:-missing}" >&2
  exit 1
fi

printf 'Built APK: %s\nEffective minimum SDK: %s\n' "$apk" "$sdk_line"
