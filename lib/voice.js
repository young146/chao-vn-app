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

/** 답을 읽어준다. onDone 은 다 읽었거나 중간에 멈췄을 때 불린다.
 *  queue=true 면 앞엣것을 끊지 않고 **뒤에 이어 붙인다**(스트리밍 낭독용).
 *
 * 🚨 **`Speech.stop()` 을 함부로 부르면 소리가 아예 안 난다** (2026-08-12 실제 사고).
 *    stop() 은 **비동기**(Promise)다. 그런데 예전 코드는 이렇게 돼 있었다:
 *        Speech.stop();        // 아직 안 끝남
 *        Speech.speak(...);    // 바로 실행
 *    안드로이드에서는 stop 이 speak **뒤에** 도착해 방금 시작한 말을 취소해 버린다.
 *    아무것도 안 읽고 있을 때도 stop 을 불렀으므로 **매번** 그랬다 — 눌러도 무음.
 *    → 지금은 ① 정말 읽는 중일 때만 ② **await 로 끝난 것을 확인한 뒤** 새로 읽는다.
 *
 * ⚠️ 오류를 조용히 삼키지 말 것. 예전엔 onError 를 그냥 onDone 으로 넘겨서
 *    "아무 일도 안 일어나는" 상태가 됐고 원인을 찾는 데 시간이 걸렸다.
 */
export async function speak(text, { onDone, onError, lang = 'ko-KR', rate = 0.95, queue = false } = {}) {
  if (!isSpeakSupported()) { if (onError) onError(new Error('이 기기에서는 읽어주기를 쓸 수 없어요.')); if (onDone) onDone(); return; }
  const t = speakableText(text);
  if (!t) { if (onDone) onDone(); return; }
  try {
    if (!queue) {
      // 읽는 중일 때만 멈춘다. 그리고 **끝난 것을 확인하고** 새로 읽는다.
      try {
        const busy = await Speech.isSpeakingAsync();
        if (busy) await Speech.stop();
      } catch (_) { /* 확인 실패하면 그냥 진행 — 멈추려다 못 읽는 것보다 낫다 */ }
    }
    Speech.speak(t, {
      language: lang,
      // 어르신 기준으로 조금 천천히. 기본속도는 빠르게 느껴진다.
      rate,
      onDone: () => { if (onDone) onDone(); },
      onStopped: () => { if (onDone) onDone(); },
      onError: (e) => {
        console.warn('[voice] speak error', e?.message || e);
        if (onError) onError(e instanceof Error ? e : new Error(String(e?.message || e || 'speech_failed')));
        if (onDone) onDone();
      },
    });
  } catch (e) {
    console.warn('[voice] speak threw', e?.message || e);
    if (onError) onError(e);
    if (onDone) onDone();
  }
}

/**
 * 읽어주기가 왜 안 되는지 알아본다 — 화면에 이유를 보여주기 위한 진단.
 * "아무 일도 안 일어남" 은 고칠 수 없다. 이유가 보여야 고친다.
 */
export async function probeSpeech() {
  if (!Speech) return { ok: false, reason: '앱에 읽어주기 기능이 없습니다(구버전 빌드).' };
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const list = Array.isArray(voices) ? voices : [];
    const ko = list.filter((v) => String(v?.language || '').toLowerCase().startsWith('ko'));
    if (list.length === 0) {
      return { ok: false, total: 0, ko: 0, reason: '이 폰에 음성(TTS) 엔진이 없습니다. 설정 → 접근성 → 텍스트 음성 변환에서 설치해 주세요.' };
    }
    if (ko.length === 0) {
      return { ok: false, total: list.length, ko: 0,
        reason: `한국어 음성이 설치돼 있지 않습니다(설치된 음성 ${list.length}개). 설정 → 접근성 → 텍스트 음성 변환 → 언어에서 한국어를 받아 주세요.` };
    }
    return { ok: true, total: list.length, ko: ko.length, reason: `한국어 음성 ${ko.length}개 사용 가능` };
  } catch (e) {
    return { ok: false, reason: `음성 목록을 읽지 못했습니다: ${e?.message || e}` };
  }
}

export function stopSpeaking() {
  if (!isSpeakSupported()) return;
  try { Speech.stop(); } catch (_) {}
}

/**
 * **답이 도착하는 대로 읽어주는 장치** — 글과 말이 함께 나오게 한다.
 *
 * 왜 (2026-08-12 사장님):
 *   읽어주기 버튼이 답 *아래*에 있으니 "다 읽고 나서야 그런 기능이 있는 줄" 알게 된다.
 *   그리고 애초에 **말로 물었으면 말로 답하는 게 당연하다.** 말로 묻는 분은
 *   글을 읽기 어려워서 말로 묻는 것이다. 글만 주면 절반만 해결한 것이다.
 *
 * 어떻게: AI 답은 글자 조각으로 흘러 들어온다. 조각을 그대로 읽으면 "호치","민 7군" 처럼
 *   토막 나므로, **문장이 끝날 때마다**(. ! ? 줄바꿈) 그 문장만 떼어 읽기에 넘긴다.
 *   읽기는 뒤에 이어 붙으므로(queue) 끊기지 않고 자연스럽게 이어진다.
 *
 * ⚠️ 도구 검색 때문에 화면이 비워지는 일(reset)이 있다 → 그때 reset() 을 불러
 *    읽던 것을 멈추고 처음부터 다시 세야 한다. 안 그러면 버려진 서두를 읽는다.
 *
 * 사용:
 *   const sp = createSpeechStream({ onIdle: () => setSpeaking(false) });
 *   sp.push(지금까지의_전체글);   // delta 마다
 *   sp.reset();                  // reset 이벤트에서
 *   sp.flush(최종글);            // done 에서 (남은 꼬리를 읽는다)
 *   sp.stop();                   // 화면을 떠날 때
 */
export function createSpeechStream({ onStart, onIdle, onError, rate = 0.95, lang = 'ko-KR' } = {}) {
  let spokenLen = 0;     // 지금까지 읽기에 넘긴 글자 수
  let pending = 0;       // 아직 읽는 중인 문장 개수
  let dead = false;
  // 🚨 **확정되기 전에는 입을 열지 않는다** (2026-08-12 사장님 지적).
  //    AI 는 두 판에 걸쳐 답한다 — ①"찾아볼게요" 같은 서두 → 도구로 검색 → ②진짜 답.
  //    화면은 ①을 지우고 ②를 그리면 그만이지만, **소리는 이미 나가버린 뒤**라 끊긴다.
  //    듣는 사람에게는 "말하다 말고 딴소리"로 들려서 무슨 일인지 알 수 없다.
  //    → 도구 검색이 끝났다는 신호(reset)를 받고 나서야(arm) 읽기 시작한다.
  //      도구를 아예 안 쓰는 질문은 armed 가 되지 않으므로 flush() 때 **한 번에** 읽는다.
  //      어느 쪽이든 **끊기지 않는 한 덩이**로 들린다.
  let armed = false;

  const say = (chunk) => {
    const t = chunk.trim();
    if (!t || dead) return;
    // 실제로 소리가 나기 시작하는 순간을 알린다.
    // (확정을 기다리는 동안 '멈춤'이 떠 있으면 "눌러도 안 멈추네" 로 또 헷갈린다)
    if (pending === 0 && onStart) onStart();
    pending += 1;
    speak(t, {
      queue: true, rate, lang,
      onError,
      onDone: () => {
        pending = Math.max(0, pending - 1);
        if (pending === 0 && onIdle && !dead) onIdle();
      },
    });
  };

  return {
    /** 지금까지 도착한 **전체** 글을 넘긴다. 새로 완성된 문장만 골라 읽는다.
     *  armed 되기 전에는 아무것도 읽지 않는다 — 버려질 서두일 수 있기 때문. */
    push(fullText) {
      if (dead || !armed) return;
      const s = String(fullText || '');
      if (s.length <= spokenLen) return;
      const rest = s.slice(spokenLen);
      // 마지막 문장부호 위치까지만 읽는다. 그 뒤는 아직 쓰이는 중이다.
      const m = rest.match(/^[\s\S]*[.!?。…\n]/);
      if (!m) return;
      const ready = m[0];
      // 너무 짧은 토막은 모아 뒀다 함께 읽는다 — "네." 하나만 따로 읽으면 어색하다.
      if (ready.trim().length < 12) return;
      spokenLen += ready.length;
      say(ready);
    },
    /** 끝났다 — 아직 안 읽은 꼬리를 마저 읽는다.
     *  도구를 안 쓴 질문은 여기서 처음이자 마지막으로, **답 전체를 한 번에** 읽는다. */
    flush(fullText) {
      if (dead) return;
      armed = true;
      const s = String(fullText || '');
      if (s.length > spokenLen) { const tail = s.slice(spokenLen); spokenLen = s.length; say(tail); }
      if (pending === 0 && onIdle) onIdle();
    },
    /** 도구 검색이 시작됐다 = 앞의 글은 버려진 서두다.
     *  멈추고 처음부터 다시 세되, **이제부터 오는 글은 확정된 답**이므로 읽기를 연다. */
    reset() { spokenLen = 0; pending = 0; armed = true; stopSpeaking(); },
    stop() { dead = true; pending = 0; stopSpeaking(); },
  };
}

export default {
  isVoiceSupported, isSpeakSupported, ensureVoicePermission,
  startListening, speak, stopSpeaking, speakableText, createSpeechStream,
};
