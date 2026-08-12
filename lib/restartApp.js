// ============================================================
// 앱 재시작 — "재시작" 버튼이 반드시 재시작되게 하는 한 곳
// 작성: 2026-08-12
// ============================================================
//
// 왜 만드는가 (사장님 2026-08-12 재보고: "재시작 버튼을 눌러도 제자리에 있다"):
//
//   재시작 버튼은 두 군데 있다 — 더보기 화면의 "지금 재시작", 크래시 화면의 "지금 재시작".
//   둘 다 `Updates.reloadAsync()` 만 불렀는데, **안드로이드에서 조용히 실패**했다.
//   같은 규칙을 두 곳에 적으면 반드시 어긋나므로 여기 한 곳에 둔다.
//
// 왜 reloadAsync 로는 안 되는가:
//   reloadAsync 는 **앱(액티비티)은 살려둔 채 JS 번들만 갈아끼운다.** 그런데 이 버튼은
//   네이티브 대화상자 안에 있거나(더보기) 이미 크래시한 화면 위에 있어(에러화면),
//   갈아끼우려는 그 화면을 무언가가 붙잡고 있는 상태다. 그래서 아무 일도 일어나지 않고
//   예외도 안 난다 — 사용자 눈에는 "버튼이 고장난" 것으로 보인다.
//   2026-08-08 에 대화상자가 닫히도록 400ms 지연을 넣어봤지만 여전했다.
//
// 왜 안드로이드에서 RNRestart 인가:
//   `RNRestart.Restart()` 는 안드로이드에서 `ProcessPhoenix.triggerRebirth()` 를 부른다
//   (node_modules/react-native-restart/android/.../RestartModule.java 에서 확인).
//   **프로세스를 죽였다 다시 띄운다** = 사용자가 앱을 껐다 켜는 것과 완전히 같다.
//   화면에 무엇이 떠 있든 상관없다. 그리고 expo-updates 는 앱이 켜질 때 내려받아 둔
//   업데이트를 적용하므로, 재시작만 되면 새 버전으로 뜬다.
//
// ⛔ 그런데 iOS 에서는 **절대 RNRestart 를 먼저 쓰면 안 된다** (사장님 2026-08-12 지적:
//    "iOS 는 원래 잘 된다. 이번 수정이 iOS 를 망치진 않겠지?" — 실제로 망칠 뻔했다).
//
//    같은 이름의 함수인데 하는 일이 플랫폼마다 전혀 다르다:
//      안드로이드 RestartModule.java → ProcessPhoenix.triggerRebirth()  = 프로세스 재시작
//      iOS        Restart.m          → RCTTriggerReloadCommandListeners() = JS 만 다시 읽기
//
//    그리고 expo-updates 가 iOS 에서 재시작할 때 하는 일은 두 단계다
//    (node_modules/expo-updates/ios/EXUpdates/Procedures/RelaunchProcedure.swift:73-76):
//      ① setLauncher(launcherWithDatabase)      ← **새 번들을 가리키도록 바꾸고**
//      ② RCTTriggerReloadCommandListeners(...)  ← 그 다음에 다시 읽는다
//    RNRestart 는 ②만 하고 ①을 건너뛴다. 즉 iOS 에서 그걸 부르면 **옛 번들을 그대로
//    다시 읽는다** — "재시작은 됐는데 버전이 그대로"가 된다. 더 고약한 종류의 고장이다.
//
//    그래서 iOS 는 지금까지 잘 되던 `Updates.reloadAsync()` 를 그대로 쓴다.
//    **iOS 동작은 이 파일이 생기기 전과 완전히 동일하다** (실패 시 안내가 붙은 것만 다르다).
//
// ⚠️ react-native-restart 는 네이티브 모듈이다. App.js 가 이미 최상단에서 import 하고
//    있으므로 현재 바이너리에는 들어 있지만, 그래도 defensive load 로 받는다
//    (CLAUDE.md 의 OTA-safe 패턴). 모듈이 없으면 아래 폴백이 대신 받는다.

import { Platform } from "react-native";
import * as Updates from "expo-updates";
import AsyncStorage from "@react-native-async-storage/async-storage";

let RNRestart = null;
try {
  RNRestart = require("react-native-restart").default;
} catch (_) {
  // 바이너리에 없는 경우 — 폴백(reloadAsync)이 처리한다
}

/**
 * 앱을 재시작한다. **성공하면 이 함수는 영영 반환하지 않는다**(프로세스가 죽으므로).
 *
 * 수단을 순서대로 시도하고, 각 수단이 통했는지는 **타이머로 판정**한다.
 * 재시작에 성공하면 타이머가 울릴 JS 자체가 사라지기 때문이다 —
 * 성공/실패를 리턴값으로 알 방법이 없는 상황에서 이게 유일하게 확실한 신호다.
 *
 * @param {object}   opts
 * @param {boolean}  opts.markOtaApplied OTA 적용 직후인가. true 면 다음 실행에서
 *   업데이트 재확인을 건너뛰도록 표시한다(무한 재시작 방지). App.js 가 읽는다.
 * @param {function} opts.onFailed 모든 수단이 실패했을 때 부른다. 사용자에게
 *   "직접 껐다 켜 달라"고 안내할 마지막 기회다 — 조용히 삼키면 버튼이 고장난 게 된다.
 */
export async function restartApp({ markOtaApplied = false, onFailed } = {}) {
  if (markOtaApplied) {
    // 재시작 전에 반드시 남긴다. 프로세스가 죽은 뒤엔 쓸 기회가 없다.
    await AsyncStorage.multiSet([
      ["OTA_JUST_APPLIED", "1"],
      ["OTA_SKIP_CHECK", "1"],
    ]).catch(() => {});
  }

  const notify = () => {
    if (typeof onFailed === "function") onFailed();
  };

  // ── iOS ────────────────────────────────────────────────────────
  // 지금까지 잘 되던 그대로. RNRestart 는 여기서 **쓰지 않는다** (위 주석 참고 —
  // iOS 에서는 옛 번들을 다시 읽어서 "재시작은 됐는데 그대로"가 된다).
  if (Platform.OS === "ios") {
    try {
      await Updates.reloadAsync();
      // 성공하면 JS 가 통째로 교체되므로 이 아래는 실행되지 않는다
    } catch (_) {
      notify();
    }
    return;
  }

  // ── 안드로이드 ──────────────────────────────────────────────────
  // 2수: 1수가 통했으면 이 타이머는 울리지 않는다(프로세스가 죽으므로).
  const second = setTimeout(() => {
    Updates.reloadAsync().catch(() => {});
  }, 1500);

  // 3수: 그것마저 안 되면 사용자에게 알린다. 내려받기는 이미 끝났으므로
  //      껐다 켜기만 하면 새 버전으로 뜬다 — 그 말을 해 줘야 한다.
  const third = setTimeout(notify, 4000);

  // 1수: 프로세스 재시작 (안드로이드에서 유일하게 확실히 통하는 수단)
  try {
    if (RNRestart && typeof RNRestart.Restart === "function") {
      RNRestart.Restart();
      return;
    }
  } catch (_) {
    // 아래 폴백으로 넘어간다
  }

  // 모듈이 없으면 기다릴 것 없이 바로 2수로
  clearTimeout(second);
  try {
    await Updates.reloadAsync();
  } catch (_) {
    clearTimeout(third);
    notify();
  }
}
