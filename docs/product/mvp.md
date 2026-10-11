# SayStrike Speaking Challenge MVP

## Goal and flow

SayStrike lets Vietnamese English learners practice one short sentence in a
friendly retro boss fight:

1. Open the prepared city-life demo challenge.
2. Select its prepared English sentence.
3. Listen to the sentence in the device's English text-to-speech voice.
4. Start microphone capture with a direct tap and stop it manually, or let the
   20-second cap stop the capture.
5. See the sentence, recognized transcript, “Ước lượng khớp câu”, and at most
   one transcript-derived practice suggestion when evaluation succeeds.
6. See the result as damage within the boss fight. Retry freely or end the
   challenge.

The sentence is “I didn't expect the city to feel this alive.” Its Vietnamese
context is “Tôi không ngờ thành phố lại sống động đến thế này.” The demo is
local and does not import or download social-media content.

## States and tone

The app distinguishes ready, requesting permission, recording, processing,
scored, and unrated states. Denying microphone permission or having no
speech-recognition service remains recoverable. Empty, shorter-than-800ms,
unintelligible, timed-out, invalid-response, network, or service errors display
“Chưa đánh giá được”; the result has no score or battle damage. The user can
retry or end the challenge from any result.

Scoring is word-level edit similarity between a recognized transcript and the
target sentence. It is explicitly an estimate of sentence matching; it is not
verified pronunciation, phoneme, accent, intonation, or fluency assessment.
Feedback offers at most one word-level suggestion. A DEMO badge and text appear
whenever the development/demo-only mock is used; the mock transcript does not claim
to have analyzed the user's recording.

## Audio and privacy

Microphone permission is requested after the user taps “Bắt đầu ghi âm”.
Captures are foreground-only, capped at 20 seconds, and use the audio package's
temporary app cache. The app deletes a capture after evaluation or an
interruption. No audio is retained as learning history.

When `EXPO_PUBLIC_SPEECH_TRANSCRIPTION_URL` is configured, the app sends one
multipart POST with field `audio` (M4A) to that server and expects JSON
`{"transcript":"recognized text"}`. The app does not contain an API key. The
endpoint must use HTTPS. The server must protect provider credentials and return only the transcript needed
for this attempt. Without an endpoint, development and the explicit internal
demo APK use the labeled mock; a production build returns an unrated result.

## Boss battle policy

Thresholds and damage amounts are centralized in `src/game/damage.js`:

- At 65% and above, the learner damages the boss; stronger matches increase
  damage.
- At 50% and below, the boss attacks within the fight; lower matches increase
  its damage.
- Between 50% and 65%, both sides receive a smoothly interpolated share.
- Unrated attempts cause zero damage to either side. Player battle HP never
  falls below one, so a retry is never locked.

Battle damage is local presentation only. It does not erase or deduct streaks,
achievements, or learning progress.

## Design source

Google Stitch project “SayStrike Pixel Speaking Quest” is the visual authority.
The MVP follows its dark arcade panels, mint accents, hard edges, pixel-art
boss, parchment English sentence card, Space Mono headings, Inter learning
copy, and its challenge/sentence/boss/result/unrated/completion screens.
