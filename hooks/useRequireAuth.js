// ============================================================
// useRequireAuth — 비회원 가입 유도 helper hook
// 작성: 2026-05-21
// 깔때기 단계 2 (다운로드 → 가입) 보강 작업 C
// ============================================================
//
// 목적: "정보 없는 트래픽은 자산이 아니다" 원칙 구현.
// 비회원이 *액션* (알림 받기·찜·채팅·게시물 작성·댓글 등) 시도 시
// 일관된 가입 유도 모달을 띄워서 정보 수집 깔때기 강화.
//
// 사용법:
// ```js
// import { useRequireAuth } from '../hooks/useRequireAuth';
//
// function MyScreen({ navigation }) {
//   const requireAuth = useRequireAuth(navigation);
//
//   const handleFavorite = () => {
//     if (!requireAuth('찜하기')) return;  // 비회원이면 모달 띄우고 false 반환
//     // ... 찜 로직 (회원만 도달)
//   };
// }
// ```
//
// 동작:
//   - user 가 있으면 → true 반환 (액션 진행)
//   - user 가 없으면 → 가입 유도 Alert + false 반환
//
// 디자인 결정 (다른 개발자 인수인계용):
//   1. *부정형 메시지 금지* — "X 못해요" 가 아니라 "X 받으려면 가입 필요" 처럼 가치 중심
//   2. 작업명을 동적으로 받음 — 액션마다 메시지 톤 일관 + 맥락 명확
//   3. "30초만" 같은 시간 약속으로 부담 ↓
//   4. 가입 버튼이 *기본*, 취소가 *cancel* — 가입 선택을 시각적으로 더 강조
//   5. 다국어 — t('common:...') 우선, 키 없으면 defaultValue fallback

import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export function useRequireAuth(navigation) {
  const { user } = useAuth();
  const { t } = useTranslation('common');

  /**
   * @param {string} actionLabel  "찜하기" / "알림 받기" / "채팅 시작" 같은 액션 이름
   * @returns {boolean}  user 있으면 true (계속 진행), 없으면 false (모달 띄움)
   */
  return function requireAuth(actionLabel = '이 기능') {
    if (user) return true;

    Alert.alert(
      `${actionLabel}을(를) 사용하려면 가입이 필요해요`,
      `30초면 끝납니다. 가입하시면 ${actionLabel} 외에도 내 지역 맞춤 알림, 푸시, 즐겨찾기를 받아보실 수 있어요.`,
      [
        {
          text: t('common:cancel', '나중에'),
          style: 'cancel',
        },
        {
          text: t('common:signup', '가입하기'),
          style: 'default',
          onPress: () => navigation?.navigate?.('로그인'),
        },
      ],
    );
    return false;
  };
}
