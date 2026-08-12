// 말로 검색하기 · 답 읽어주기 — **네이티브 음성 기능을 한 군데로 모은 부품**.
//
// 왜 만들었나 (2026-08-09 사장님 요청):
//   어르신들께 새 통합앱을 보여드렸더니 "다 잘 나온다"고 놀라셨는데, **키보드에서 막혔다.**
//   손가락이 굵고 눈이 어두우면 오타가 난다. 검색을 아무리 빠르게 만들어도 **못 치면 소용없다.**
//   우리 주 독자가 2002년부터 종이 잡지를 봐 오신 그분들인데, 입구에서 돌아서고 있었다.
//
// ⚠️ **여기가 유일한 통로다.** 화면에서 'expo-speech-recognition' 이나 'expo-speech' 를
//    직접 import 하지 말 것. 한 군데라도 직접 부르면 **그 화면이 구버전 앱에서 통째로 죽는다.**
//    (CLAUDE.md 의 OTA-safe defensive load 규칙. lib/analytics.js 와 같은 방식이다)
//
// ⚠️ 이 모듈은 **네이티브**다 → OTA 로 전달되지 않는다. 새 빌드가 스토어에 올라가야 동작한다.
//    그때까지 구버전 앱에서는 require 가 실패해 조용히 '지원 안 함'이 되고, 화면은 마이크 버튼을 숨긴다.
//    **빌드된 뒤에도 이 방어 코드는 지우지 말 것** — 옛 버전을 계속 쓰는 사용자가 늘 있다.

import { Platform } from 'react-native';

// ── 네이티브 모듈 방어적 로드 ────────────────────────────────────────
let SR = null;        // 음성 → 글자 (외부 패키지)
let Speech = null;    // 글자 → 소리 (Expo 공식)
try { SR = require('expo-speech-recognition').ExpoSpeechRecognitionModule; } catch (_) { /* 구버전 빌드 */ }
try { Speech = require('expo-speech'); } catch (_) { /* 구버전 빌드 */ }

// ── 베트남 한인 생활에서 자주 나오는 말 ──────────────────────────────
// 음성인식에 "이런 말이 나올 수 있다"고 미리 귀띔해 주는 목록(contextualStrings).
// 왜 필요한가: 한국어 인식기는 베트남 지명을 모른다. "붕따우"를 "봉타우/붕타우"로,
//   "푸미흥"을 "푸미흑"으로 적어 놓으면 검색이 헛돈다. 미리 알려주면 그쪽으로 붙여 준다.
// ⚠️ 너무 많이 넣으면 오히려 엉뚱한 말이 이 목록으로 끌려온다. 자주 쓰는 것만 짧게.
const HINTS = [
  // 도시·지역
  '호치민', '하노이', '다낭', '붕따우', '나짱', '냐짱', '푸꾸옥', '하이퐁', '빈즈엉', '동나이',
  '푸미흥', '타오디엔', '안푸', '떤빈', '고밥', '미딩', '경남랜드',
  // 우리 서비스·업종
  '씬짜오', '옐로페이지', '진출기업', '교민', '한인회', '당근', '나눔', '구인구직', '부동산',
  '한식당', '미용실', '행정사', '노무', '세무', '통역', '골프', '동호회',
];

/** 이 기기에서 '말로 검색'이 되는가 (버튼을 보여줄지 판단) */
export function isVoiceSupported() {
  if (!SR) return false;                       // 구버전 빌드 = 네이티브 모듈 없음
  try {
    if (typeof SR.isRecognitionAvailable === 'function' && !SR.isRecognitionAvailable()) return false;
    // 안드로이드는 구글 음성 서비스에 얹혀 돈다. 그게 없는 기기(중국계 롬 등)에서는 아예 안 된다.
    // **버튼이 있는데 안 눌리는 게 최악**이므로, 없으면 버튼 자체를 숨긴다.
    if (Platform.OS === 'android' && typeof SR.getSpeechRecognitionServices === 'function') {
      const svc = SR.getSpeechRecognitionServices();
      if (!svc || svc.length === 0) return false;
    }
    return true;
  } catch (_) { return false; }
}

/** 이 기기에서 '읽어주기'가 되는가 */
export function isSpeakSupported() {
  return !!(Speech && typeof Speech.speak === 'function');
}

/**
 * 마이크·음성인식 권한 확인 후 필요하면 요청.
 * 반환: true = 써도 됨 / false = 거부됨(화면에서 안내할 것)
 */
export async function ensureVoicePermission() {
  if (!SR) return false;
  try {
    const cur = await SR.getPermissionsAsync();
    if (cur?.granted) return true;
    if (cur && cur.canAskAgain === false) return false;   // "다시 묻지 않음" → 설정으로 보내야 함
    const asked = await SR.requestPermissionsAsync();
    return !!asked?.granted;
  } catch (_) { return false; }
}

/**
 * 듣기 시작. 말하는 **동안** onPartial 로 글자가 계속 들어오고,
 * 말이 끝나면 onFinal 로 최종 문장이 한 번 온다.
 *
 * 어르신 기준으로 정한 것:
 *  · 누르고 있는 방식(push-to-talk)이 아니라 **한 번 눌러 시작 → 말 멈추면 자동 종료**.
 *    손 떨림이 있으면 누르고 있는 것 자체가 어렵고, 떼는 순간 잘려 나간다.
 *  · continuous=false → 한 문장 말하면 알아서 끝난다. 검색어는 길지 않다.
 *  · interimResults=true → 말하는 동안 글자가 보인다. **듣고 있다는 증거**가 되어 불안하지 않다.
 *
 * 반환: { stop(), cancel() } — 화면을 떠나거나 다시 누를 때 부를 것.
 */
export function startListening({ onPartial, onFinal, onError, onEnd, lang = 'ko-KR' } = {}) {
  if (!SR) { if (onError) onError(new Error('unsupported')); return { stop() {}, cancel() {} }; }

  const subs = [];
  let done = false;
  let last = '';                       // 마지막으로 받은 글자 — 종료 시 보정용
  const off = () => { for (const s of subs) { try { s?.remove?.(); } catch (_) {} } subs.length = 0; };

  const finish = (text) => {
    if (done) return;
    done = true;
    off();
    if (onFinal) onFinal((text || '').trim());
  };

  try {
    subs.push(SR.addListener('result', (e) => {
      const t = e?.results?.[0]?.transcript || '';
      if (!t) return;
      last = t;
      // isFinal 이 오면 그게 최종. 안 오는 기기도 있어서 end 에서 한 번 더 보정한다.
      if (e.isFinal) finish(t);
      else if (onPartial) onPartial(t);
    }));

    subs.push(SR.addListener('error', (e) => {
      if (done) return;
      done = true;
      off();
      // 'no-speech' = 아무 말도 안 하고 시간이 지난 것. 오류라기보다 그냥 취소에 가깝다.
      const code = e?.error || 'unknown';
      if (onError) onError(Object.assign(new Error(code), { code, message: e?.message || code }));
    }));

    subs.push(SR.addListener('end', () => {
      // 기기에 따라 isFinal 없이 end 만 오는 경우가 있다 → 그동안 받아 둔 글자를 최종으로 쓴다.
      if (!done && last) finish(last);
      else if (!done) { done = true; off(); if (onFinal) onFinal(''); }
      if (onEnd) onEnd();
    }));

    SR.start({
      lang,
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      // 베트남 지명을 알아듣게 귀띔 (iOS 에서 특히 효과가 있다)
      contextualStrings: HINTS,
      // 검색어에 마침표·물음표는 필요 없다. 붙으면 검색이 흐려진다.
      addsPunctuation: false,
    });
  } catch (e) {
    off();
    if (onError) onError(e);
  }

  return {
    stop() { try { SR.stop(); } catch (_) {} },      // 지금까지 들은 것으로 마무리
    cancel() { done = true; off(); try { SR.abort(); } catch (_) {} },  // 통째로 버림
  };
}

// ── 읽어주기 ────────────────────────────────────────────────────────

/**
 * AI 답변을 **소리로 읽기 좋게** 다듬는다.
 *
 * 왜 필요한가: 답변에는 `**굵게**`, 주소(https://…), 이모지, 목록 기호가 섞여 있다.
 *   그대로 읽히면 "별표별표 하이마트 별표별표 에이치티티피에스 콜론 슬래시 슬래시…" 가 된다.
 *   듣는 사람이 바로 꺼 버린다.
 */
export function speakableText(raw) {
  return String(raw || '')
    .replace(/\*\*/g, '')                                  // 굵게 표시 제거
    .replace(/https?:\/\/\S+/gi, ' 링크 ')                  // 주소는 "링크" 한 마디로
    .replace(/\b[a-z0-9][a-z0-9-]*\.(?:com\.vn|co\.kr|com|net|org|vn|kr)\b\S*/gi, ' 링크 ')
    .replace(/[•·▪]/g, ', ')                                // 목록 기호 → 쉼표(읽을 때 쉬어감)
    .replace(/[—–]/g, ', ')                                 // 긴 줄표도 쉼표로 (그냥 두면 붙여 읽는다)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')   // 이모지 제거
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    // 위 치환들이 겹치면 ". ," ",," 같은 자국이 남는다. 그대로 읽으면 뚝뚝 끊긴다.
    // 연달아 붙은 문장부호는 **맨 앞 하나만** 남긴다.
    .replace(/\s*([.,])[\s.,]*/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s.,]+/, '')
    .trim();
}

/** 답을 읽어준다. onDone 은 다 읽었거나 중간에 멈췄을 때 불린다. */
export function speak(text, { onDone, lang = 'ko-KR', rate = 0.95 } = {}) {
  if (!isSpeakSupported()) { if (onDone) onDone(); return; }
  const t = speakableText(text);
  if (!t) { if (onDone) onDone(); return; }
  try {
    Speech.stop();   // 앞엣것이 읽히는 중이면 끊고 새로 읽는다
    Speech.speak(t, {
      language: lang,
      // 어르신 기준으로 조금 천천히. 기본속도는 빠르게 느껴진다.
      rate,
      onDone: () => { if (onDone) onDone(); },
      onStopped: () => { if (onDone) onDone(); },
      onError: () => { if (onDone) onDone(); },
    });
  } catch (_) { if (onDone) onDone(); }
}

export function stopSpeaking() {
  if (!isSpeakSupported()) return;
  try { Speech.stop(); } catch (_) {}
}

export default {
  isVoiceSupported, isSpeakSupported, ensureVoicePermission,
  startListening, speak, stopSpeaking, speakableText,
};
