import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { deleteAsync, getInfoAsync } from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono/700Bold';
import { demoChallenge } from './src/content/demoChallenge.js';
import { applyDamage, calculateDamage } from './src/game/damage.js';
import { evaluateRecording, MIN_RECORDING_MS } from './src/services/transcriber.js';
import { PixelMonster } from './src/components/PixelMonster';

type Screen = 'challenge' | 'sentence' | 'boss' | 'result' | 'complete';
type RecordingPhase = 'idle' | 'preparing' | 'recording' | 'processing';

type Evaluation =
  | { kind: 'scored'; transcript: string; percent: number; suggestion: string; demo: boolean }
  | { kind: 'unrated'; reason: string };

type RoundResult = Evaluation & {
  damage?: { playerDamage: number; bossDamage: number; outcome: string };
};

const C = {
  background: '#001805',
  panel: '#002109',
  panelRaised: '#00260b',
  panelHigh: '#003211',
  mint: '#4de082',
  glow: '#6bff8f',
  text: '#ecffeF',
  muted: '#a8c0ad',
  cream: '#f4ecd8',
  ink: '#20172e',
  line: '#19522a',
  warning: '#ffb4ab',
  orange: '#f5b45f',
};

const MAX_RECORDING_MS = 20_000;
const BOSS_HP_START = 100;
const PLAYER_HP_START = 100;

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `00:${String(totalSeconds).padStart(2, '0')}`;
}

function reasonText(reason: string) {
  const messages: Record<string, string> = {
    empty_audio: 'Không tìm thấy đoạn ghi âm. Hãy thử ghi lại nhé.',
    too_short: `Đoạn ghi âm ngắn quá. Hãy nói câu trong ít nhất ${MIN_RECORDING_MS / 1000} giây.`,
    backend_not_configured: 'Chưa kết nối dịch vụ nhận diện câu nói nên lượt này chưa có điểm.',
    service_unavailable: 'Dịch vụ nhận diện đang bận. Bản ghi vẫn ở trên thiết bị; bạn có thể thử lại.',
    invalid_response: 'Phản hồi nhận diện chưa đúng định dạng nên lượt này chưa được chấm.',
    unintelligible: 'Âm thanh chưa rõ để nhận diện câu. Bạn có thể thử lại khi sẵn sàng.',
    timeout: 'Dịch vụ phản hồi hơi lâu. Lượt này chưa được chấm; bạn có thể thử lại.',
    network_error: 'Chưa kết nối được dịch vụ nhận diện. Kiểm tra mạng rồi thử lại nhé.',
    recording_failed: 'Micro gặp trục trặc nên chưa tạo được bản ghi. Bạn có thể thử lại.',
    interrupted: 'Ghi âm đã dừng khi ứng dụng ra nền. Không có điểm hay damage nào được tính.',
  };
  return messages[reason] ?? 'Chưa thể đánh giá lượt này. Bạn có thể thử lại bất cứ lúc nào.';
}

function ArcadeButton({
  label,
  icon,
  onPress,
  secondary = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.buttonSecondary : styles.buttonPrimary,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {icon ? <Text style={[styles.buttonIcon, secondary ? styles.secondaryText : null]}>{icon}</Text> : null}
      <Text style={[styles.buttonLabel, secondary ? styles.secondaryText : null]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ children, warning = false }: { children: string; warning?: boolean }) {
  return (
    <View style={[styles.pill, warning ? styles.pillWarning : null]}>
      <Text style={[styles.pillText, warning ? styles.pillWarningText : null]}>{children}</Text>
    </View>
  );
}

function Header({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>S</Text>
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      {right ? <Pill>{right}</Pill> : null}
    </View>
  );
}

function HealthBar({ label, value, owner }: { label: string; value: number; owner?: 'player' }) {
  const shown = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.healthPanel}>
      <View style={styles.healthLine}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>HP: {Math.ceil(shown)}/100</Text>
      </View>
      <View style={styles.healthTrack}>
        <View style={[styles.healthFill, owner === 'player' ? styles.playerHealthFill : null, { width: `${shown}%` }]} />
      </View>
    </View>
  );
}

function BottomTabs({ active, onSelect }: { active: Screen; onSelect: (screen: Screen) => void }) {
  const tabs: { id: Screen; icon: string; label: string }[] = [
    { id: 'challenge', icon: '⌂', label: 'Thử thách' },
    { id: 'sentence', icon: '▤', label: 'Câu luyện' },
    { id: 'boss', icon: '⚔', label: 'Boss' },
  ];
  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          onPress={() => onSelect(tab.id)}
          style={[styles.bottomTab, active === tab.id ? styles.bottomTabActive : null]}
        >
          <Text style={[styles.bottomTabIcon, active === tab.id ? styles.bottomTabIconActive : null]}>{tab.icon}</Text>
          <Text style={[styles.bottomTabText, active === tab.id ? styles.bottomTabTextActive : null]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <View style={styles.scoreRing} accessibilityLabel={`Ước lượng khớp câu ${score}%`}>
      <Text style={styles.scoreNumber}>{score}%</Text>
      <Text style={styles.scoreCaption}>KHỚP CÂU</Text>
    </View>
  );
}

function SayStrikeApp() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [screen, setScreen] = useState<Screen>('challenge');
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>('idle');
  const recordingPhaseRef = useRef<RecordingPhase>('idle');
  const maxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const [sampleError, setSampleError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [battle, setBattle] = useState({ bossHp: BOSS_HP_START, playerHp: PLAYER_HP_START });

  useEffect(() => {
    recordingPhaseRef.current = recordingPhase;
  }, [recordingPhase]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') Speech.stop();
      if (nextState !== 'active' && recordingPhaseRef.current === 'recording') {
        if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
        recordingPhaseRef.current = 'idle';
        setRecordingPhase('idle');
        setRecordingError('interrupted');
        void recorder.stop()
          .then(async () => {
            if (recorder.uri) await deleteAsync(recorder.uri, { idempotent: true }).catch(() => undefined);
          })
          .catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [recorder]);

  useEffect(() => () => {
    Speech.stop();
    if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
  }, []);

  async function finishRecording() {
    if (recordingPhaseRef.current !== 'recording') return;
    recordingPhaseRef.current = 'processing';
    setRecordingPhase('processing');
    if (maxDurationRef.current) clearTimeout(maxDurationRef.current);

    try {
      const durationMs = recorder.getStatus().durationMillis;
      await recorder.stop();
      const uri = recorder.uri ?? recorder.getStatus().url;
      const fileInfo = uri ? await getInfoAsync(uri) : null;
      const evaluation = await evaluateRecording({
        target: demoChallenge.target,
        audioUri: uri,
        audioSizeBytes: fileInfo?.exists && fileInfo.size > 0 ? fileInfo.size : 0,
        durationMs,
        isDevelopment: __DEV__,
      }) as Evaluation;

      if (uri) await deleteAsync(uri, { idempotent: true }).catch(() => undefined);

      if (evaluation.kind === 'scored') {
        const damage = calculateDamage(evaluation.percent);
        setBattle((previous) => applyDamage(previous, damage));
        setRoundResult({ ...evaluation, damage });
      } else {
        setRoundResult(evaluation);
      }
      setScreen('result');
    } catch {
      const uri = recorder.uri;
      if (uri) await deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      setRoundResult({ kind: 'unrated', reason: 'recording_failed' });
      setScreen('result');
    } finally {
      recordingPhaseRef.current = 'idle';
      setRecordingPhase('idle');
    }
  }

  async function startRecording() {
    setRecordingError(null);
    setSampleError(false);
    recordingPhaseRef.current = 'preparing';
    setRecordingPhase('preparing');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionCanAskAgain(permission.canAskAgain);
      if (!permission.granted) {
        recordingPhaseRef.current = 'idle';
        setRecordingPhase('idle');
        setRecordingError('permission_denied');
        return;
      }

      await Speech.stop();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAttempts((previous) => previous + 1);
      recordingPhaseRef.current = 'recording';
      setRecordingPhase('recording');
      maxDurationRef.current = setTimeout(() => void finishRecording(), MAX_RECORDING_MS);
    } catch {
      recordingPhaseRef.current = 'idle';
      setRecordingPhase('idle');
      setRecordingError('recording_failed');
    }
  }

  function playSample() {
    setSampleError(false);
    Speech.stop();
    Speech.speak(demoChallenge.target, {
      language: 'en-US',
      rate: 0.86,
      onError: () => setSampleError(true),
    });
  }

  function goToBoss() {
    setRecordingError(null);
    setScreen('boss');
  }

  function resetChallenge() {
    setBattle({ bossHp: BOSS_HP_START, playerHp: PLAYER_HP_START });
    setAttempts(0);
    setRoundResult(null);
    setRecordingError(null);
    setScreen('challenge');
  }

  async function finishChallenge() {
    if (recordingPhaseRef.current === 'processing') return;
    if (recordingPhaseRef.current === 'recording' || recordingPhaseRef.current === 'preparing') {
      if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
      recordingPhaseRef.current = 'idle';
      setRecordingPhase('idle');
      await recorder.stop().catch(() => undefined);
      if (recorder.uri) await deleteAsync(recorder.uri, { idempotent: true }).catch(() => undefined);
    }
    Speech.stop();
    setScreen('complete');
  }

  if (!fontsLoaded && !fontError) {
    return <View style={styles.loading}><Text style={styles.loadingText}>ĐANG VÀO ARCADE…</Text></View>;
  }

  const result = roundResult;
  const isScored = result?.kind === 'scored';
  const hasTranscriptionService = Boolean(process.env.EXPO_PUBLIC_SPEECH_TRANSCRIPTION_URL);
  const demoEvaluation = !hasTranscriptionService && (__DEV__ || process.env.EXPO_PUBLIC_DEMO_BUILD === '1');
  const headerTitle = {
    challenge: 'THỬ THÁCH MẪU',
    sentence: 'CHỌN CÂU LUYỆN',
    boss: 'ĐÁNH TRÙM CUỐI',
    result: 'KẾT QUẢ',
    complete: 'HOÀN THÀNH',
  }[screen];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Header title={headerTitle} right={screen === 'result' && result?.kind === 'scored' ? `${result.percent}%` : undefined} />

          {screen === 'challenge' ? (
            <>
              <View style={styles.challengeHero}>
                <View style={styles.heroMedal}><Text style={styles.heroMedalText}>✦</Text></View>
                <Text style={styles.brandTitle}>SAYSTRIKE ARCADE</Text>
                <Text style={styles.heroText}>Luyện nói tiếng Anh qua những thử thách ngắn, vui và không áp lực.</Text>
              </View>
              <SectionHeading left="⚡  THỬ THÁCH NỔI BẬT" right="HÔM NAY" />
              <View style={styles.challengeCard}>
                <View style={styles.challengeCardTop}>
                  <Pill>ĐỜI SỐNG THÀNH PHỐ</Pill>
                  <Text style={styles.difficultyText}>◉  Cấp độ {demoChallenge.level}</Text>
                </View>
                <Text style={styles.cardEyebrow}>MỘT CÂU NÓI TỪ ĐOẠN PHIM ĐỜI SỐNG THÀNH PHỐ</Text>
                <View style={styles.quoteBlock}>
                  <Text style={styles.quoteText}>“{demoChallenge.target}”</Text>
                  <Text style={styles.quoteTranslation}>“{demoChallenge.translation}”</Text>
                </View>
                <View style={styles.contextRow}>
                  <Text style={styles.contextIcon}>◉</Text>
                  <Text style={styles.contextText}>{demoChallenge.context}</Text>
                </View>
              </View>
              <ArcadeButton label="Bắt đầu thử thách" icon="▶" onPress={() => setScreen('sentence')} />
              <Text style={styles.privacyNote}>Một câu mẫu có sẵn · Không tải nội dung từ mạng xã hội</Text>
            </>
          ) : null}

          {screen === 'sentence' ? (
            <>
              <View style={styles.stepHeading}>
                <Text style={styles.stepEyebrow}>⚡  CHỌN NHIỆM VỤ · 01</Text>
                <Text style={styles.title}>Chọn câu luyện tập</Text>
                <Text style={styles.bodyText}>Nghe mẫu trước, rồi thử nói theo khi bạn thấy sẵn sàng.</Text>
              </View>
              <View style={styles.selectedSentence}>
                <View style={styles.selectedTop}><Pill>ĐÃ CHỌN</Pill><Text style={styles.checkMark}>✓</Text></View>
                <Text style={styles.sentenceText}>“{demoChallenge.target}”</Text>
                <View style={styles.sentenceMeta}>
                  <Text style={styles.sentenceMetaText}>Độ khó: {demoChallenge.level}</Text>
                  <Text style={styles.sentenceMetaText}>Một câu ngắn</Text>
                </View>
              </View>
              <View style={styles.coachNote}>
                <Text style={styles.coachTitle}>GỢI Ý NHẸ</Text>
                <Text style={styles.coachText}>Không cần nói thật nhanh. Hãy nghe nhịp câu và thử lại theo cách của bạn.</Text>
              </View>
              <ArcadeButton label="Thách đấu câu này" icon="⚔" onPress={goToBoss} />
              <ArcadeButton label="Quay lại thử thách" onPress={() => setScreen('challenge')} secondary />
            </>
          ) : null}

          {screen === 'boss' ? (
            <>
              <HealthBar label="⚔  TRÙM CUỐI · VUA SLIME" value={battle.bossHp} />
              <HealthBar label="♥  NGƯỜI CHƠI" value={battle.playerHp} owner="player" />
              <View style={styles.arena}>
                <View style={styles.arenaGlow} />
                <Pill>VUA SLIME</Pill>
                <View style={styles.monsterWrap}><PixelMonster /></View>
                <Text style={styles.bossTaunt}>“Thử bắt nhịp xem nào!”</Text>
              </View>
              <View style={styles.targetCard}>
                <View style={styles.targetCardTop}>
                  <Text style={styles.cardEyebrow}>CÂU MỤC TIÊU</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Nghe câu mẫu"
                    accessibilityState={{ disabled: recordingPhase !== 'idle' }}
                    disabled={recordingPhase !== 'idle'}
                    onPress={playSample}
                    style={[styles.listenButton, recordingPhase !== 'idle' ? styles.buttonDisabled : null]}
                  >
                    <Text style={styles.listenButtonText}>♫  Nghe mẫu</Text>
                  </Pressable>
                </View>
                <Text style={styles.targetEnglish}>“{demoChallenge.target}”</Text>
                <Text style={styles.targetTranslation}>“{demoChallenge.translation}”</Text>
                <Text style={styles.audioPrivacyNote}>
                  {hasTranscriptionService
                    ? 'Bản ghi sẽ được gửi qua HTTPS để nhận transcript, rồi xóa sau khi xử lý.'
                    : demoEvaluation
                      ? 'Chế độ DEMO: bản ghi không rời thiết bị và không được phân tích.'
                      : 'Chưa kết nối dịch vụ nhận diện; lượt ghi âm sẽ chưa được chấm.'}
                </Text>
              </View>
              <View style={styles.recordStatus}>
                {recordingPhase === 'recording' ? <Waveform /> : <Text style={styles.readyIcon}>♫</Text>}
                <Text style={styles.recordStatusText}>
                  {recordingPhase === 'recording'
                    ? `Đang ghi âm  ${formatDuration(recorderState.durationMillis)}`
                    : recordingPhase === 'processing'
                      ? 'Đang xử lý…'
                      : recordingPhase === 'preparing'
                        ? 'Đang mở microphone…'
                        : 'Sẵn sàng tấn công'}
                </Text>
              </View>
              <ArcadeButton
                label={recordingPhase === 'recording' ? 'Dừng & xem kết quả' : 'Bắt đầu ghi âm'}
                icon={recordingPhase === 'recording' ? '■' : '♩'}
                onPress={() => recordingPhase === 'recording' ? void finishRecording() : void startRecording()}
                disabled={recordingPhase === 'preparing' || recordingPhase === 'processing'}
                accessibilityLabel={recordingPhase === 'recording' ? 'Dừng ghi âm và xem kết quả' : 'Bắt đầu ghi âm sau khi cấp quyền microphone'}
              />
              {recordingError ? (
                <View style={styles.messagePanel}>
                  <Text style={styles.messageText}>
                    {recordingError === 'permission_denied'
                      ? 'SayStrike cần microphone để ghi âm sau khi bạn bấm bắt đầu.'
                      : reasonText(recordingError)}
                  </Text>
                  {recordingError === 'permission_denied' && !permissionCanAskAgain ? (
                    <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button">
                      <Text style={styles.settingsLink}>Mở cài đặt ứng dụng</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {sampleError ? <Text style={styles.inlineError}>Thiết bị chưa có giọng đọc tiếng Anh. Bạn vẫn có thể ghi âm câu này.</Text> : null}
              <View style={styles.statusPills}>
                <Pill>{recordingPhase === 'recording' ? 'ĐANG GHI' : 'SẴN SÀNG'}</Pill>
                <Pill>MIC CHỈ KHI BẠN BẤM</Pill>
                <Pill>{`LẦN ${attempts + 1}`}</Pill>
              </View>
              {recordingPhase === 'idle' ? (
                <Pressable onPress={() => void finishChallenge()} style={styles.endFightLink} accessibilityRole="button">
                  <Text style={styles.endFightText}>Kết thúc trận</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {screen === 'result' && result ? (
            result.kind === 'scored' ? (
              <>
                <View style={styles.resultHealth}>
                  <View style={styles.healthPortrait}><PixelMonster small /></View>
                  <View style={styles.resultHealthInfo}>
                    <Text style={styles.resultBossName}>VUA SLIME</Text>
                    <Text style={styles.resultBossSub}>Trùm cuối · hiệp {attempts}</Text>
                    <Text style={styles.resultDamage}>
                      {result.damage?.outcome === 'boss'
                        ? 'BOSS ĐÁNH TRẢ'
                        : result.damage?.outcome === 'shared'
                          ? 'CẢ HAI CÙNG TẤN CÔNG'
                          : 'GÂY SÁT THƯƠNG CHO BOSS'}
                    </Text>
                  </View>
                  <Pill>{`${Math.round(result.damage?.outcome === 'boss'
                    ? result.damage.bossDamage
                    : result.damage?.playerDamage ?? 0)} HP`}</Pill>
                </View>
                <View style={styles.resultHealthBar}>
                  <HealthBar label="♥  HP NGƯỜI CHƠI" value={battle.playerHp} owner="player" />
                  <HealthBar label="⚔  HP VUA SLIME" value={battle.bossHp} />
                </View>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreCardHeading}>⚡  ƯỚC LƯỢNG KHỚP CÂU</Text>
                  <ScoreRing score={result.percent} />
                  <Text style={styles.scoreMessage}>
                    {result.percent >= 65 ? 'Tuyệt vời, bạn đã tạo một đòn tấn công!' : 'Mỗi lần thử giúp bạn bắt nhịp tốt hơn!'}
                  </Text>
                  {result.demo ? <Pill>DEMO · ĐIỂM MINH HỌA</Pill> : null}
                </View>
                <View style={styles.transcriptCard}>
                  <Text style={styles.cardEyebrow}>CÂU MỤC TIÊU</Text>
                  <Text style={styles.transcriptTarget}>“{demoChallenge.target}”</Text>
                  <View style={styles.separator} />
                  <Text style={styles.cardEyebrow}>CÂU NHẬN DIỆN</Text>
                  <Text style={styles.transcriptActual}>“{result.transcript}”</Text>
                  {result.demo ? <Text style={styles.demoNote}>Đây là transcript mẫu cố định để xem thử flow; audio của bạn chưa được phân tích.</Text> : null}
                </View>
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackIcon}>✦</Text>
                  <View style={styles.feedbackCopy}>
                    <Text style={styles.feedbackTitle}>GỢI Ý LUYỆN TẬP</Text>
                    <Text style={styles.feedbackText}>{result.suggestion}</Text>
                    <Text style={styles.feedbackLimit}>Gợi ý dựa trên transcript, không phải đánh giá phát âm.</Text>
                  </View>
                </View>
                <View style={styles.buttonPair}>
                  <View style={styles.buttonPairChild}><ArcadeButton label="Thử lại" icon="↻" onPress={goToBoss} secondary /></View>
                  <View style={styles.buttonPairChild}><ArcadeButton label="Nghe mẫu" icon="♫" onPress={playSample} secondary /></View>
                </View>
                <ArcadeButton
                  label={battle.bossHp === 0 ? 'Hoàn thành thử thách' : 'Tiếp tục trận đấu'}
                  icon="→"
                  onPress={() => battle.bossHp === 0 ? void finishChallenge() : goToBoss()}
                />
              </>
            ) : (
              <>
                <View style={styles.unratedBanner}>
                  <Text style={styles.unratedSymbol}>⚠</Text>
                  <View style={styles.unratedTextWrap}>
                    <Text style={styles.unratedTitle}>Chưa đánh giá được</Text>
                    <Text style={styles.unratedSub}>Không trừ điểm · Mời thử lại</Text>
                  </View>
                  <Pill>{`LẦN ${attempts}`}</Pill>
                </View>
                <View style={styles.unratedCard}>
                  <View style={styles.micOff}><Text style={styles.micOffText}>♩̸</Text></View>
                  <Pill warning>CHƯA CÓ ĐIỂM</Pill>
                  <Text style={styles.unratedMessage}>{reasonText(result.reason)}</Text>
                  <Text style={styles.unratedMessageSub}>Không có damage nào được tính. Bản ghi chỉ được giữ tạm trên thiết bị và sẽ xóa sau khi xử lý.</Text>
                  <Waveform muted />
                  <ArcadeButton label="Thử lại" icon="↻" onPress={goToBoss} />
                  <ArcadeButton label="Nghe lại mẫu" icon="♫" onPress={playSample} secondary />
                </View>
                <View style={styles.coachNote}>
                  <Text style={styles.coachTitle}>✦  MẸO NHỎ</Text>
                  <Text style={styles.coachText}>Hãy chờ tín hiệu mic xanh rồi nói to, rõ ràng vào microphone.</Text>
                </View>
                <ArcadeButton label="Quay lại trận đấu" onPress={goToBoss} secondary />
              </>
            )
          ) : null}

          {screen === 'complete' ? (
            <>
              <View style={styles.completeBadge}><Text style={styles.completeBadgeText}>✦</Text></View>
              <Text style={styles.completeTitle}>{battle.bossHp === 0 ? 'ĐÃ HẠ ĐƯỢC BOSS!' : 'THỬ THÁCH HOÀN TẤT!'}</Text>
              <Text style={styles.completeSubtitle}>{battle.bossHp === 0 ? 'CHIẾN THẮNG!' : 'Bạn đã hoàn thành lượt luyện tập.'}</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeading}>
                  <Text style={styles.cardEyebrow}>KẾT QUẢ TRẬN ĐẤU</Text>
                  <Text style={styles.summaryScore}>{battle.bossHp === 0 ? 'BOSS ĐÃ BỊ HẠ' : 'ĐÃ HOÀN TẤT'}</Text>
                </View>
                <Text style={styles.cardEyebrow}>CÂU ĐÃ LUYỆN TẬP</Text>
                <Text style={styles.summarySentence}>“{demoChallenge.target}”</Text>
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatLabel}>SỐ LẦN THỬ</Text>
                    <Text style={styles.summaryStatValue}>{attempts} lượt</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatLabel}>ĐÁNH GIÁ</Text>
                    <Text style={styles.summaryStatValue}>{isScored ? 'Có kết quả' : 'Tùy chọn'}</Text>
                  </View>
                </View>
              </View>
              <ArcadeButton label="Luyện tập lại câu này" icon="↻" onPress={() => { setRoundResult(null); setScreen('boss'); }} />
              <ArcadeButton label="Chọn thử thách mẫu" icon="▤" onPress={resetChallenge} secondary />
            </>
          ) : null}
        </ScrollView>
        {(screen === 'challenge' || screen === 'sentence' || screen === 'boss') && recordingPhase === 'idle' ? (
          <BottomTabs active={screen} onSelect={setScreen} />
        ) : null}
    </SafeAreaView>
  );
}

function SectionHeading({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionHeadingLeft}>{left}</Text>
      <Text style={styles.sectionHeadingRight}>{right}</Text>
    </View>
  );
}

function Waveform({ muted = false }: { muted?: boolean }) {
  const heights = [9, 15, 23, 31, 39, 25, 18, 28, 36, 20, 12, 26, 34, 17, 10];
  return (
    <View accessibilityLabel="Âm thanh dạng sóng" style={styles.waveform}>
      {heights.map((height, index) => (
        <View key={index} style={[styles.waveBar, muted ? styles.waveBarMuted : null, { height }]} />
      ))}
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <SayStrikeApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
  loadingText: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 13 },
  scrollContent: { paddingHorizontal: 17, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  header: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  brandMark: { width: 24, height: 24, borderColor: C.line, borderWidth: 1, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: C.mint, fontFamily: 'SpaceMono_700Bold', fontSize: 15 },
  headerTitle: { flex: 1, color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.25 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, minHeight: 21, borderColor: C.line, borderWidth: 1, backgroundColor: C.panel },
  pillText: { color: C.glow, fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.2, textAlign: 'center' },
  pillWarning: { borderColor: '#88483e', backgroundColor: '#381811' },
  pillWarningText: { color: C.warning },
  healthPanel: { backgroundColor: C.panelRaised, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 7 },
  healthLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  healthLabel: { color: C.text, fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  healthValue: { color: C.glow, fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  healthTrack: { height: 6, backgroundColor: '#063212', overflow: 'hidden' },
  healthFill: { height: '100%', backgroundColor: C.glow },
  playerHealthFill: { backgroundColor: C.orange },
  challengeHero: { backgroundColor: C.panel, alignItems: 'center', paddingHorizontal: 18, paddingTop: 15, paddingBottom: 17, marginTop: 5, marginBottom: 17, borderWidth: 1, borderColor: C.line },
  heroMedal: { width: 45, height: 45, borderRadius: 24, borderWidth: 1, borderColor: C.glow, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  heroMedalText: { color: C.glow, fontSize: 22 },
  brandTitle: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 12, marginBottom: 7 },
  heroText: { color: C.text, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionHeadingLeft: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  sectionHeadingRight: { color: C.muted, fontFamily: 'SpaceMono_400Regular', fontSize: 9 },
  challengeCard: { backgroundColor: C.cream, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e1d6bd' },
  challengeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 7 },
  difficultyText: { color: C.ink, fontFamily: 'Inter_400Regular', fontSize: 10 },
  cardEyebrow: { color: '#5b584f', fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.35 },
  quoteBlock: { backgroundColor: C.background, padding: 11, marginTop: 7, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  quoteText: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 23 },
  quoteTranslation: { color: '#cad2c4', fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 11, lineHeight: 17, marginTop: 5 },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextIcon: { color: '#00614b', fontSize: 15 },
  contextText: { color: C.ink, fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1 },
  privacyNote: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 9 },
  button: { minHeight: 49, paddingVertical: 10, paddingHorizontal: 12, marginTop: 7, marginBottom: 5, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonPrimary: { borderColor: C.mint, backgroundColor: C.mint },
  buttonSecondary: { borderColor: C.line, backgroundColor: C.panelRaised },
  buttonPressed: { transform: [{ translateX: 1 }, { translateY: 2 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonIcon: { color: C.ink, fontSize: 15, fontWeight: '700' },
  buttonLabel: { color: C.ink, fontFamily: 'SpaceMono_700Bold', fontSize: 12, textAlign: 'center' },
  secondaryText: { color: C.glow },
  stepHeading: { marginTop: 9, marginBottom: 15 },
  stepEyebrow: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 10, marginBottom: 7 },
  title: { color: C.text, fontFamily: 'SpaceMono_700Bold', fontSize: 20, marginBottom: 5 },
  bodyText: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  selectedSentence: { backgroundColor: C.panelRaised, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: C.mint },
  selectedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  checkMark: { color: C.glow, fontSize: 18 },
  sentenceText: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 24, marginVertical: 6 },
  sentenceMeta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line, paddingTop: 8, marginTop: 8 },
  sentenceMetaText: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 11 },
  coachNote: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 11, marginVertical: 9 },
  coachTitle: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 9, marginBottom: 4 },
  coachText: { color: C.text, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, flex: 1 },
  arena: { height: 190, backgroundColor: '#00230e', alignItems: 'center', justifyContent: 'space-evenly', marginVertical: 7, overflow: 'hidden', borderWidth: 1, borderColor: '#073d1a' },
  arenaGlow: { position: 'absolute', width: 155, height: 155, borderRadius: 80, top: 18, backgroundColor: '#063318', opacity: 0.65 },
  monsterWrap: { zIndex: 1, paddingVertical: 3 },
  bossTaunt: { color: C.glow, fontFamily: 'Inter_400Regular', fontSize: 12, fontStyle: 'italic', zIndex: 1 },
  targetCard: { backgroundColor: C.cream, padding: 12, marginTop: 5, marginBottom: 9, borderWidth: 1, borderColor: '#e1d6bd' },
  targetCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginBottom: 7 },
  listenButton: { backgroundColor: '#524a39', paddingHorizontal: 8, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  listenButtonText: { color: '#fff9e9', fontFamily: 'Inter_400Regular', fontSize: 10 },
  targetEnglish: { color: C.ink, fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  targetTranslation: { color: '#555046', fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 11, lineHeight: 17, marginTop: 5 },
  audioPrivacyNote: { color: '#615d52', fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14, marginTop: 8 },
  recordStatus: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: C.panel, marginTop: 1, marginBottom: 2 },
  recordStatusText: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  readyIcon: { color: C.glow, fontSize: 18 },
  waveform: { height: 37, flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBar: { width: 3, backgroundColor: C.glow },
  waveBarMuted: { backgroundColor: '#4b6651' },
  messagePanel: { backgroundColor: '#24160e', borderColor: '#8c5126', borderWidth: 1, padding: 10, marginTop: 6 },
  messageText: { color: '#ffe0ba', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  settingsLink: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 12, textDecorationLine: 'underline', marginTop: 8 },
  inlineError: { color: C.warning, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginVertical: 5 },
  statusPills: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  endFightLink: { minHeight: 39, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  endFightText: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 11, textDecorationLine: 'underline' },
  bottomTabs: { minHeight: 58, borderTopWidth: 1, borderColor: C.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 8, backgroundColor: C.background },
  bottomTab: { minWidth: 75, minHeight: 43, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bottomTabActive: { backgroundColor: C.panelRaised },
  bottomTabIcon: { color: C.muted, fontSize: 16, lineHeight: 18 },
  bottomTabIconActive: { color: C.glow },
  bottomTabText: { color: C.text, fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 3 },
  bottomTabTextActive: { color: C.glow, fontFamily: 'Inter_600SemiBold' },
  resultHealth: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, backgroundColor: C.panelRaised, borderWidth: 1, borderColor: C.line },
  healthPortrait: { width: 47, height: 47, justifyContent: 'center', alignItems: 'center', backgroundColor: C.panel },
  resultHealthInfo: { flex: 1 },
  resultBossName: { color: C.text, fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  resultBossSub: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 2 },
  resultDamage: { color: C.warning, fontFamily: 'SpaceMono_700Bold', fontSize: 9, marginTop: 5 },
  resultHealthBar: { paddingTop: 8 },
  scoreCard: { alignItems: 'center', backgroundColor: C.panel, padding: 14, marginTop: 9, borderWidth: 1, borderColor: C.line },
  scoreCardHeading: { alignSelf: 'stretch', color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 9, marginBottom: 9 },
  scoreRing: { width: 86, height: 86, borderRadius: 45, borderWidth: 2, borderColor: C.glow, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  scoreNumber: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 19 },
  scoreCaption: { color: C.muted, fontFamily: 'SpaceMono_400Regular', fontSize: 8, marginTop: 1 },
  scoreMessage: { color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  transcriptCard: { backgroundColor: C.panelRaised, padding: 12, marginTop: 9, borderWidth: 1, borderColor: C.line },
  transcriptTarget: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18, marginTop: 6 },
  transcriptActual: { color: C.text, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
  separator: { height: 1, backgroundColor: C.line, marginVertical: 9 },
  demoNote: { color: C.orange, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 8 },
  feedbackCard: { flexDirection: 'row', gap: 9, backgroundColor: C.panel, padding: 11, marginTop: 8, borderWidth: 1, borderColor: C.line },
  feedbackIcon: { color: '#dbc9ff', fontSize: 15 },
  feedbackCopy: { flex: 1 },
  feedbackTitle: { color: C.muted, fontFamily: 'SpaceMono_400Regular', fontSize: 9, marginBottom: 4 },
  feedbackText: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 17 },
  feedbackLimit: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 13, marginTop: 4 },
  buttonPair: { flexDirection: 'row', gap: 8, marginTop: 4 },
  buttonPairChild: { flex: 1 },
  unratedBanner: { minHeight: 59, backgroundColor: C.panelRaised, borderWidth: 1, borderColor: C.line, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  unratedSymbol: { color: C.orange, fontSize: 20 },
  unratedTextWrap: { flex: 1 },
  unratedTitle: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 11 },
  unratedSub: { color: C.text, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
  unratedCard: { alignItems: 'center', backgroundColor: C.panel, padding: 15, marginTop: 12, borderWidth: 1, borderColor: C.line },
  micOff: { width: 57, height: 57, borderRadius: 30, backgroundColor: C.panelHigh, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  micOffText: { color: C.muted, fontSize: 25 },
  unratedMessage: { color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  unratedMessageSub: { color: C.muted, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  completeBadge: { width: 47, height: 47, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, marginTop: 18, marginBottom: 10 },
  completeBadgeText: { color: C.glow, fontSize: 20 },
  completeTitle: { color: C.glow, textAlign: 'center', fontFamily: 'SpaceMono_700Bold', fontSize: 16, marginTop: 4 },
  completeSubtitle: { color: C.text, textAlign: 'center', fontFamily: 'SpaceMono_400Regular', fontSize: 11, marginTop: 5, marginBottom: 16 },
  summaryCard: { backgroundColor: C.panelRaised, padding: 13, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  summaryHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, paddingBottom: 9, marginBottom: 10, borderBottomWidth: 1, borderColor: C.line },
  summaryScore: { color: C.glow, fontFamily: 'SpaceMono_700Bold', fontSize: 9 },
  summarySentence: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontStyle: 'italic', fontSize: 13, lineHeight: 19, marginTop: 6 },
  summaryStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  summaryStat: { flex: 1, minHeight: 55, justifyContent: 'center', backgroundColor: C.panel, padding: 9 },
  summaryStatLabel: { color: C.muted, fontFamily: 'SpaceMono_400Regular', fontSize: 8 },
  summaryStatValue: { color: C.glow, fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 5 },
});

export default App;
