/**
 * 공지 배너 스타일 프리셋
 * 관련 문서: directives/ANNOUNCEMENTS_PLAN.md
 *
 * Firestore NeighborAnnouncement.style 필드에 저장된 값으로 이 프리셋을 선택.
 * style 필드가 비어있거나 매칭 안 되면 'info'로 폴백.
 */

export const ANNOUNCEMENT_STYLES = {
  info: {
    bg: '#E3F2FD',
    text: '#0D47A1',
    icon: 'information-circle',
  },
  announcement: {
    bg: '#FFF3E0',
    text: '#E65100',
    icon: 'megaphone',
  },
  event: {
    bg: '#F3E5F5',
    text: '#6A1B9A',
    icon: 'gift',
  },
  warning: {
    bg: '#FFEBEE',
    text: '#B71C1C',
    icon: 'warning',
  },
  promo: {
    bg: '#E8F5E9',
    text: '#1B5E20',
    icon: 'pricetag',
  },
};

export const DEFAULT_STYLE = 'info';

export function getStyleConfig(styleName) {
  return ANNOUNCEMENT_STYLES[styleName] || ANNOUNCEMENT_STYLES[DEFAULT_STYLE];
}
