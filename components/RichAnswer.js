// AI 답변 본문을 그리는 공용 부품 — **굵은 글씨(`**...**`) + 눌리는 주소(URL)**.
//
// 왜 만들었나 (2026-08-09 사장님 지적):
//   AI 가 "iOS: https://apps.apple.com/app/id6754750793" 처럼 주소를 알려주는데
//   **글자로만 있어서 누를 수가 없었다.** 주소를 손으로 옮겨 적을 사람은 없다.
//   못 누르는 링크는 없는 링크다 — 앱 설치도, 우리 웹 방문도 거기서 끊긴다.
//
// 왜 공용 파일인가:
//   AI 답변은 **두 곳**에 나온다 — 검색결과 화면의 AI 카드, AI 도우미 대화창.
//   같은 규칙을 두 벌로 두면 반드시 한쪽만 고쳐진다(이미 검색에서 한 번 물렸다).
//   웹에도 같은 동작이 있어야 한다: vnkorlife-web/app/assistant/page.tsx 의 RichText.

import React from 'react';
import { Text, Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// 주소로 볼 것:
//  ① http(s):// 로 시작하는 것
//  ② www. 로 시작하는 것
//  ③ **맨몸 도메인 전부** — AI 는 "vnkorlife.com" 처럼 http 없이 말하는 경우가 훨씬 많다.
//     끝(TLD)이 실제 도메인 꼬리일 때만 인정한다. 그래야 "index.html" 이나 소수점 숫자를
//     주소로 착각하지 않는다. 한글 앞글자는 [a-z0-9] 라 애초에 안 걸린다("있습니다.com" 안전).
// 끝에 붙은 문장부호(. , ) 등)는 주소에서 뺀다 — "…co.kr)" 을 통째로 열면 깨진다.
const URL_RE =
  /(https?:\/\/[^\s<>()[\]"'`]+|www\.[^\s<>()[\]"'`]+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com\.vn|co\.kr|com|net|org|kr|vn|io|dev|app|me|info|biz|shop|store|link|page)(?:\/[^\s<>()[\]"'`]*)?)/gi;
const TRAILING = /[.,!?;:)\]}"'…]+$/;

function normalize(raw) {
  const clean = raw.replace(TRAILING, '');
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

/**
 * 주소를 연다.
 * · 앱스토어·플레이스토어 → Linking (스토어 앱이 직접 열려야 설치까지 이어진다.
 *   인앱 브라우저로 열면 웹 페이지가 떠서 한 단계가 더 생긴다)
 * · 그 외 → 인앱 브라우저 (우리 앱을 벗어나지 않는다)
 */
async function openUrl(url) {
  const isStore = /apps\.apple\.com|itunes\.apple\.com|play\.google\.com/i.test(url);
  try {
    if (isStore) await Linking.openURL(url);
    else await WebBrowser.openBrowserAsync(url);
  } catch (e) {
    // 인앱 브라우저가 못 열면 기본 브라우저로라도 열어 준다
    try { await Linking.openURL(url); } catch (_) { /* 여기까지 실패하면 조용히 포기 */ }
  }
}

/** 한 조각(굵게 아님)을 주소 기준으로 다시 쪼개 링크로 만든다 */
function withLinks(chunk, keyBase) {
  const out = [];
  let last = 0;
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(chunk)) !== null) {
    if (m.index > last) out.push(<Text key={`${keyBase}-t${last}`}>{chunk.slice(last, m.index)}</Text>);
    const raw = m[0];
    const trail = (raw.match(TRAILING) || [''])[0];   // 문장부호는 링크 밖으로
    const shown = trail ? raw.slice(0, -trail.length) : raw;
    const href = normalize(shown);
    out.push(
      <Text
        key={`${keyBase}-a${m.index}`}
        style={{ color: '#2563EB', textDecorationLine: 'underline' }}
        onPress={() => openUrl(href)}
        suppressHighlighting={Platform.OS === 'ios'}
        accessibilityRole="link"
      >
        {shown}
      </Text>
    );
    if (trail) out.push(<Text key={`${keyBase}-p${m.index}`}>{trail}</Text>);
    last = m.index + raw.length;
  }
  if (last < chunk.length) out.push(<Text key={`${keyBase}-t${last}`}>{chunk.slice(last)}</Text>);
  return out;
}

/** AI 답변 텍스트 → 굵은 글씨 + 눌리는 주소가 섞인 조각들
 *
 * ⚠️ **굵은 글씨 안에서도 주소를 링크로 만든다.** 처음엔 안 했다가 물렸다 —
 *    AI 는 사이트 이름을 `**vnkorlife.com**` 처럼 **굵게** 쓰는데, 스토어 주소는
 *    굵지 않게 쓴다. 그래서 "앱 설치는 되는데 사이트 주소는 안 눌리는" 상태가 됐다.
 *    굵은 조각을 그냥 글자로 흘려보내면 정작 **우리 사이트 링크만** 죽는다.
 */
export function renderAnswer(text) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .flatMap((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? [
            <Text key={`b${i}`} style={{ fontWeight: '700' }}>
              {withLinks(part.slice(2, -2), `b${i}`)}
            </Text>,
          ]
        : withLinks(part, `s${i}`)
    );
}

export default renderAnswer;
