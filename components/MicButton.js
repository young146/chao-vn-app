// 마이크 버튼 — **입력칸 옆에 이것 하나만 놓으면 말로 입력이 된다.**
//
// 왜 부품으로 뽑았나 (2026-08-12):
//   처음엔 화면마다 따로 배선했다. 그랬더니 **'이어서 묻기' 입력칸을 빠뜨렸고**,
//   사장님이 바로 찾아내셨다. 검색창은 앱 곳곳에 있는데(홈·검색결과·옐로페이지·
//   진출기업·매거진·AI도우미) 배선을 여섯 벌로 두면 다음에도 반드시 한 곳이 빠진다.
//   그래서 **버튼 + 음성창 + 지원여부 판단**을 한 덩어리로 묶었다.
//
// 쓰는 법 — 입력칸 옆에 한 줄:
//   <MicButton onText={(t) => { setQuery(t); doSearch(t); }} />
//
// ⚠️ 지원하지 않는 기기에서는 **스스로 아무것도 안 그린다**(null 반환).
//    구버전 앱·구글 음성서비스 없는 안드로이드가 여기에 해당한다.
//    쓰는 쪽에서 따로 검사할 필요 없다 — 검사를 쓰는 쪽에 맡기면 그것도 빠뜨린다.
//
// ⚠️ 말이 끝나면 **곧바로 onText 가 불린다.** 쓰는 쪽에서 "이제 검색을 누르세요" 를
//    만들지 말 것. 어르신은 거기서 또 막힌다.

import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceSearchSheet from './VoiceSearchSheet';
import { isVoiceSupported } from '../lib/voice';

export default function MicButton({
  onText,
  color = '#FF6B35',
  size = 21,
  style,
  label = '말로 입력하기',
  onOpen,        // 창을 열기 직전에 할 일(예: 읽어주던 소리 멈추기)
}) {
  const [open, setOpen] = useState(false);
  // 기기가 지원하지 않으면 그리지 않는다 — **있는데 안 눌리는 게 제일 나쁘다.**
  if (!isVoiceSupported()) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => { if (onOpen) onOpen(); setOpen(true); }}
        activeOpacity={0.7}
        // 손가락이 굵어도 닿게 넉넉히
        hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[{ paddingHorizontal: 6, paddingVertical: 4 }, style]}
      >
        <Ionicons name="mic" size={size} color={color} />
      </TouchableOpacity>
      <VoiceSearchSheet
        visible={open}
        onClose={() => setOpen(false)}
        onResult={(t) => { setOpen(false); if (onText) onText(t); }}
      />
    </>
  );
}
