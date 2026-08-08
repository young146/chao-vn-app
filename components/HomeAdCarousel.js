// 홈(허브) 상단 광고 캐러셀 — 손으로 밀어 옮기듯 천천히 넘어가는 띠.
//
// 왜 AdBanner.js 의 AdSlider 를 안 쓰고 새로 만드는가:
//  1) AdSlider 는 가로 ScrollView 의 scrollTo({animated:true}) 로 넘긴다. 이 방식은
//     **넘어가는 시간을 정할 수 없다**(네이티브가 약 0.3초로 고정). 사장님이 원하신
//     "천천히 말려가는" 느낌이 구조적으로 안 나온다. 그래서 Animated.timing 으로 직접 민다.
//  2) AdSlider 는 앱의 모든 광고 슬롯(홈·목록·상세·팝업)이 공유한다. 홈 하나 때문에
//     거기를 고치면 **광고 전체가 위험해진다.** 새 파일이면 홈만 영향받는다.
//
// 화면 폭보다 좁게(82%) 잡아 양옆으로 앞·뒤 광고가 조금씩 보인다 → 멈춰 있을 때도
// "더 있다"는 신호가 되고, 넘어갈 때 움직임이 눈에 들어온다.
//
// 광고 렌더링·클릭 추적은 AdBanner.js 것을 그대로 가져다 쓴다(같은 규칙을 두 벌로 두지 않는다).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, PanResponder,
} from 'react-native';
import { fetchAppAdsConfig } from '../services/FirebaseAdService';
import { AdMedia, handleAdPress } from './AdBanner';

// ── 움직임 규격 (2026-08-08 사장님 확정) ──
const SLIDE_MS = 1600;                     // 미끄러지는 시간 — 손으로 옮기듯
const DWELL_MS = 3000;                     // 완전히 멈춰 서 있는 시간
const CYCLE_MS = SLIDE_MS + DWELL_MS;      // 광고 1장이 화면에 있는 총 시간
const RESUME_MS = 8000;                    // 손으로 민 뒤 자동재개까지 쉬는 시간
// 시작·끝은 부드럽게, 가운데는 일정한 속도. 이게 "말려간다"는 느낌의 정체다.
const EASING = Easing.bezier(0.42, 0, 0.22, 1);

const WIDTH_RATIO = 0.82;                  // 광고 폭 = 화면의 82% (양옆 9%씩 남는다)
const GAP = 12;                            // 광고 사이 간격
const MEDIA_RATIO = 750 / 300;             // home_banner 규격 비율
const BRAND = '#E85D04';

/**
 * 마지막에 항상 한 장 붙는 "광고 모집" 슬라이드.
 *
 * 왜 필요한가 — 캐러셀에는 구조적 약점이 있다: **광고가 1개면 안 움직인다.**
 * 그러면 홈이 죽은 화면이 된다. 이 한 장이 세 가지를 동시에 해결한다:
 *   ① 광고가 0~1개여도 캐러셀이 돈다
 *   ② 예전 옐로페이지 카드에 있던 "우리 업소 알리기" 영업 통로가 살아난다
 *   ③ 광고주가 "내 광고가 저기 실리는구나"를 눈으로 보게 된다
 */
function RecruitSlide({ onPress }) {
  return (
    <TouchableOpacity style={styles.recruit} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.recruitEyebrow}>광고 문의</Text>
      <Text style={styles.recruitTitle}>이 자리에서 우리 업소를 알리세요</Text>
      <View style={styles.recruitCta}>
        <Text style={styles.recruitCtaText}>문의하기 →</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeAdCarousel({ onInquiry, style }) {
  const [ads, setAds] = useState([]);
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);

  // ── 광고 불러오기 (홈 대형 배너 슬롯 — 기존 HomeBanner 와 같은 자리) ──
  useEffect(() => {
    let cancelled = false;
    fetchAppAdsConfig('home')
      .then((cfg) => {
        if (cancelled) return;
        const list = (cfg?.home_banner || []).filter((a) => a?.imageUrl || a?.videoUrl);
        list.sort((a, b) => (a.priority || 10) - (b.priority || 10));
        setAds(list);
      })
      .catch(() => { /* 실패해도 모집 슬라이드는 나온다 */ });
    return () => { cancelled = true; };
  }, []);

  // 실제로 돌릴 목록 = 광고들 + 모집 1장
  const items = [...ads, { __recruit: true }];
  const n = items.length;
  // 끝 → 처음이 이음매 없이 이어지도록 첫 장의 복제본을 맨 뒤에 붙인다.
  // 내용이 같으므로, 복제본까지 민 뒤 위치만 0으로 되돌리면 눈에 안 띈다.
  const slots = n > 1 ? [...items, items[0]] : items;

  const slideW = Math.round(w * WIDTH_RATIO);
  const step = slideW + GAP;
  const pad = Math.round((w - slideW) / 2);   // 활성 슬라이드를 가운데 두기 위한 여백
  const height = Math.round(slideW / MEDIA_RATIO);

  const pos = useRef(new Animated.Value(0)).current;
  const curX = useRef(0);        // 지금 위치(px) — listener 가 매 프레임 갱신
  const grabX = useRef(0);       // 손가락으로 잡은 순간의 위치(px)
  const resumeAt = useRef(0);    // 이 시각 전에는 자동 넘김을 쉰다
  const indexRef = useRef(0);
  indexRef.current = index;

  // PanResponder 는 한 번만 만들어지므로 최신 값을 클로저로 못 본다 → ref 로 건넨다
  const geo = useRef({ pad: 0, step: 1, n: 1 });
  geo.current = { pad, step, n };
  const goToRef = useRef(null);

  // 지금 위치를 매 프레임 기록해 둔다.
  //
  // 왜 필요한가: 미끄러지는 **도중에** 손가락으로 잡으면, 그 순간의 실제 위치를 알아야
  // 이어서 끌 수 있다. 이게 없으면 "애니메이션이 끝났다고 가정한 위치"에서 시작해
  // **손가락 아래에서 광고가 순간이동한다.**
  useEffect(() => {
    const id = pos.addListener(({ value }) => { curX.current = value; });
    return () => pos.removeListener(id);
  }, [pos]);

  const goTo = useCallback((i, animate = true) => {
    const target = geo.current.pad - i * geo.current.step;
    curX.current = target;
    setIndex(i);
    if (!animate) { pos.setValue(target); return; }
    Animated.timing(pos, {
      toValue: target,
      duration: SLIDE_MS,
      easing: EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 복제본까지 갔으면 위치만 처음으로 되돌린다 (내용이 같아 이음매가 안 보인다)
      if (finished && i >= geo.current.n) {
        const back = geo.current.pad;
        curX.current = back;
        pos.setValue(back);
        setIndex(0);
      }
    });
  }, [pos]);
  goToRef.current = goTo;

  // 폭이 정해지거나 광고 목록이 바뀌면 처음으로
  useEffect(() => {
    if (w > 0) goTo(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, ads.length]);

  // 자동 넘김 — 3초 멈춤 + 1.6초 미끄러짐
  useEffect(() => {
    if (n <= 1 || !w) return;
    const t = setInterval(() => {
      if (Date.now() < resumeAt.current) return;   // 방금 손으로 민 참이면 쉰다
      goTo(indexRef.current + 1, true);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [n, w, goTo]);

  // 손가락으로 밀기. 세로 스크롤을 방해하지 않도록 가로 움직임이 뚜렷할 때만 잡는다.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        // 진행 중인 미끄러짐을 그 자리에서 멈춘다. 현재 위치는 위 listener 가 이미 알고 있다.
        pos.stopAnimation();
        grabX.current = curX.current;
      },
      // 잡은 순간의 위치(grabX)를 기준으로 더한다. curX 는 listener 가 매 프레임 갱신하므로
      // 그걸 기준으로 삼으면 이동량이 계속 누적돼 광고가 손가락보다 빨리 달아난다.
      onPanResponderMove: (_e, g) => {
        pos.setValue(grabX.current + g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        const { pad: p, step: s, n: count } = geo.current;
        resumeAt.current = Date.now() + RESUME_MS;   // 보는 중에 뺏어가지 않는다
        let i = Math.round((p - (grabX.current + g.dx)) / s);
        if (i < 0) i = 0;
        if (i > count) i = count;
        goToRef.current?.(i, true);
      },
    })
  ).current;

  const dotIndex = n > 0 ? index % n : 0;

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={(e) => {
        const nw = e.nativeEvent.layout.width;
        if (nw && Math.abs(nw - w) > 1) setW(nw);
      }}
    >
      <Animated.View
        style={[styles.track, { transform: [{ translateX: pos }] }]}
        {...pan.panHandlers}
      >
        {w > 0 && slots.map((it, i) => (
          <View key={i} style={{ width: slideW, height, marginRight: GAP }}>
            {it.__recruit ? (
              <RecruitSlide onPress={onInquiry} />
            ) : (
              <TouchableOpacity
                style={styles.slideTouch}
                activeOpacity={0.9}
                onPress={() => handleAdPress(it)}
              >
                {/* 화면에 있는 칸과 다음에 들어올 칸만 실제로 그린다 (iOS 메인 스레드 보호) */}
                <AdMedia
                  ad={it}
                  style={styles.media}
                  thumbnailKey="home_banner"
                  active={i === index}
                  isVisible={i === index || i === index + 1}
                />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </Animated.View>

      {n > 1 && (
        <View style={styles.dots}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === dotIndex && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden' },
  track: { flexDirection: 'row' },
  slideTouch: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  media: { width: '100%', height: '100%' },

  recruit: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: BRAND, borderStyle: 'dashed',
    backgroundColor: '#FFF8F2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14,
  },
  recruitEyebrow: { color: BRAND, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  recruitTitle: { color: '#171412', fontSize: 15, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  recruitCta: {
    marginTop: 9, backgroundColor: BRAND, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 6,
  },
  recruitCtaText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 9 },
  dot: { width: 5, height: 3, borderRadius: 999, backgroundColor: '#E3DACE' },
  dotOn: { width: 16, backgroundColor: BRAND },
});
