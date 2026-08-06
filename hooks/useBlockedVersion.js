/**
 * useBlockedVersion — 차단 목록이 바뀔 때 화면을 다시 그리게 하는 훅.
 *
 * 왜 필요한가 (2026-08-06):
 *   차단 목록은 Firestore 조회 결과라 화면보다 늦게 도착한다. 그래서
 *   목록 화면이 처음 그려질 때는 아직 비어 있고, 그대로 두면 차단한 사람의 글이
 *   화면에 남는다. 또 차단 직후에도 목록이 저절로 갱신되지 않으면
 *   사용자는 "차단이 안 먹었다"고 느낀다.
 *
 *   그래서 목록이 로드되거나 바뀔 때마다 숫자를 올려서, 그 숫자를
 *   useMemo 의존성에 넣어 두면 필터가 다시 돌게 한다.
 *
 * 쓰는 법:
 *   const blockedVersion = useBlockedVersion();
 *   const filtered = useMemo(() => list.filter(x => !isBlockedSync(x.userId)),
 *                            [list, blockedVersion]);   // ← 이 줄이 핵심
 */
import { useEffect, useState } from 'react';
import { getBlockedUsers, subscribeBlocked } from '../services/moderationService';

export function useBlockedVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const bump = () => { if (alive) setVersion((n) => n + 1); };

    // 구독을 먼저 걸어야 조회가 캐시 히트로 즉시 끝나는 경우에도 알림을 놓치지 않는다
    const unsubscribe = subscribeBlocked(bump);
    getBlockedUsers().then(bump).catch(() => {});

    return () => { alive = false; unsubscribe(); };
  }, []);

  return version;
}

export default useBlockedVersion;
