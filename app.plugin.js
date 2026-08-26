/**
 * Expo Config Plugin:
 * 1. react-native-google-mobile-ads의 codegenConfig를 제외 (iOS 크래시 방지)
 * 2. Android Manifest 충돌 해결 (DELAY_APP_MEASUREMENT_INIT)
 * 3. Android build.gradle에 jitpack + kakao maven repo 추가 (prebuild 호환)
 * 4. Android strings.xml에 kakao_app_key 추가 (카카오 로그인 리디렉션)
 * 5. iOS AppDelegate에 FirebaseApp.configure() 삽입 (측정 초기화)
 */
const { withDangerousMod, withAndroidManifest, withProjectBuildGradle, withStringsXml, withAppDelegate } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * AppDelegate.swift 에 Firebase 초기화를 심는다.
 *
 * ── 왜 직접 넣는가 (2026-08-26) ───────────────────────────────────────────────
 * `@react-native-firebase/app@21.14.0` 의 config plugin 은 AppDelegate.swift 안에서
 * `self.moduleName = "..."` 이라는 줄을 찾아 그 위에 FirebaseApp.configure() 를 끼워 넣는다.
 * 그런데 **Expo SDK 54 의 AppDelegate.swift 에는 그 줄이 없다** — 대신
 * `factory.startReactNative(withModuleName: "main", ...)` 형태로 바뀌었다.
 *
 * 못 찾으면 그 플러그인은 경고 한 줄만 남기고 **파일을 원본 그대로 돌려보낸다**:
 *   "ios: @react-native-firebase/app: Unable to determine correct Firebase
 *    insertion point in AppDelegate.swift. Skipping Firebase addition."
 *
 * 결과: iOS 에서 Firebase 가 초기화되지 않아 Analytics 가 **한 건도 안 나갔다**.
 * 빌드는 성공하고 앱도 안 죽어서(lib/analytics.js 의 방어 코드가 삼킴) 12일간 아무도 몰랐다.
 *
 * Android 는 영향 없다 — `firebase-common` 의 FirebaseInitProvider 가 프로세스 시작 시
 * 자동으로 초기화하므로 AppDelegate 같은 진입점 코드가 필요 없다. iOS 만의 문제다.
 *
 * ── ⚠️ 못 찾으면 일부러 빌드를 깨뜨린다 ──────────────────────────────────────
 * 조용히 넘어가는 것이 바로 이 사고의 원인이었다. 앵커를 못 찾으면 throw 해서
 * 빌드를 실패시킨다. 실패한 빌드가 조용히 망가진 빌드보다 낫다.
 *
 * RNFirebase 를 최신으로 올려 그쪽이 다시 제대로 넣게 되면, 아래 중복 검사에 걸려
 * 이 함수는 자동으로 아무것도 하지 않는다. 그때 이 블록을 지워도 된다.
 */
function insertFirebaseInit(contents) {
  // 이미 들어 있으면 그대로 둔다 (RNFirebase 플러그인이 고쳐진 경우). 중복 삽입 금지.
  if (contents.includes('FirebaseApp.configure()')) {
    return { contents, changed: false };
  }

  // import FirebaseCore
  if (!contents.includes('import FirebaseCore')) {
    if (!/^import Expo$/m.test(contents)) {
      throw new Error(
        '[firebase-init] AppDelegate.swift 에서 `import Expo` 를 찾지 못했습니다. ' +
        'Expo 템플릿이 바뀐 것이므로 app.plugin.js 의 5번 블록을 갱신하세요.'
      );
    }
    contents = contents.replace(/^import Expo$/m, 'import Expo\nimport FirebaseCore');
  }

  // didFinishLaunchingWithOptions 본문 맨 앞에 삽입.
  // 시그니처가 여러 줄에 걸쳐 있으므로 `) -> Bool {` 까지 non-greedy 로 훑는다.
  const anchor = /(didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;
  if (!anchor.test(contents)) {
    throw new Error(
      '[firebase-init] AppDelegate.swift 에서 didFinishLaunchingWithOptions 진입점을 찾지 못했습니다. ' +
      'Expo 템플릿이 바뀐 것이므로 app.plugin.js 의 5번 블록을 갱신하세요.'
    );
  }
  contents = contents.replace(
    anchor,
    '$1\n    // @firebase-init — app.plugin.js 가 삽입. RNFirebase 플러그인이 SDK 54 에서 실패하는 것을 대신함\n    FirebaseApp.configure()'
  );

  return { contents, changed: true };
}

module.exports = function withCustomConfig(config) {
  // 1. iOS: codegenConfig 제거
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot || process.cwd();
      const googleMobileAdsPackagePath = path.join(
        projectRoot,
        'node_modules',
        'react-native-google-mobile-ads',
        'package.json'
      );

      if (fs.existsSync(googleMobileAdsPackagePath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(googleMobileAdsPackagePath, 'utf8')
          );
          
          if (packageJson.codegenConfig) {
            const originalCodegenConfig = packageJson.codegenConfig;
            delete packageJson.codegenConfig;
            
            const backupPath = googleMobileAdsPackagePath + '.backup';
            if (!fs.existsSync(backupPath)) {
              fs.writeFileSync(backupPath, JSON.stringify({ codegenConfig: originalCodegenConfig }, null, 2));
            }
            
            fs.writeFileSync(
              googleMobileAdsPackagePath,
              JSON.stringify(packageJson, null, 2),
              'utf8'
            );
            console.log('✅ react-native-google-mobile-ads의 codegenConfig 제거됨 (nil 크래시 방지)');
          } else {
            console.log('ℹ️ react-native-google-mobile-ads에 codegenConfig가 없습니다 (이미 제거됨)');
          }
        } catch (error) {
          console.error('❌ react-native-google-mobile-ads package.json 수정 실패:', error.message);
          throw error;
        }
      } else {
        console.log('ℹ️ react-native-google-mobile-ads not found, skipping codegen exclude');
      }

      return config;
    },
  ]);

  // 2. Android: Manifest 충돌 해결 - tools:replace 추가
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    
    if (mainApplication) {
      // tools 네임스페이스 추가
      if (!config.modResults.manifest.$) {
        config.modResults.manifest.$ = {};
      }
      config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      
      // meta-data 배열 확인/생성
      if (!mainApplication['meta-data']) {
        mainApplication['meta-data'] = [];
      }
      
      // DELAY_APP_MEASUREMENT_INIT 찾아서 tools:replace 추가
      const metaDataArray = mainApplication['meta-data'];
      const delayMeasurementIndex = metaDataArray.findIndex(
        (item) => item.$?.['android:name'] === 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT'
      );
      
      if (delayMeasurementIndex >= 0) {
        // 기존 항목에 tools:replace 추가
        metaDataArray[delayMeasurementIndex].$['tools:replace'] = 'android:value';
        metaDataArray[delayMeasurementIndex].$['android:value'] = 'true';
        console.log('✅ DELAY_APP_MEASUREMENT_INIT에 tools:replace 추가됨');
      } else {
        // 새 항목 추가 (tools:replace 포함)
        metaDataArray.push({
          $: {
            'android:name': 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
            'android:value': 'true',
            'tools:replace': 'android:value'
          }
        });
        console.log('✅ DELAY_APP_MEASUREMENT_INIT 추가됨 (tools:replace 포함)');
      }

      // 카카오 OAuth 리디렉션: AuthCodeHandlerActivity 추가
      // 카카오 동의 후 kakao{appkey}://oauth 로 리디렉션 → 이 Activity가 받음
      if (!mainApplication.activity) {
        mainApplication.activity = [];
      }
      const kakaoAuthActivity = 'com.kakao.sdk.auth.AuthCodeHandlerActivity';
      const hasKakaoAuth = mainApplication.activity.some(
        (a) => a.$?.['android:name'] === kakaoAuthActivity
      );
      if (!hasKakaoAuth) {
        mainApplication.activity.push({
          $: {
            'android:name': kakaoAuthActivity,
            'android:exported': 'true',
          },
          'intent-filter': [{
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            category: [
              { $: { 'android:name': 'android.intent.category.DEFAULT' } },
              { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
            ],
            data: [{ $: { 'android:host': 'oauth', 'android:scheme': 'kakaof62e4f5ddf705fb25094caae8d35d748' } }],
          }],
        });
        console.log('✅ kakao AuthCodeHandlerActivity 추가됨');
      }

      // targetSdk 36(Android 16) 에서 세로 고정을 유지하기 위한 opt-out.
      //
      // 왜 필요한가: API 36 부터 안드로이드는 최소폭 600dp 이상 화면(태블릿·폴더블
      // 펼침·크롬북)에서 app.json 의 orientation:"portrait" 를 *무시*한다. 그대로 두면
      // 그런 기기에서 가로로 돌아가는데, 우리 화면들은 가로 레이아웃을 검증한 적이 없다.
      // 일반 폰(600dp 미만)은 애초에 영향이 없다.
      //
      // ⚠️ 이 opt-out 은 임시다 — **API 37 에서는 통하지 않는다.**
      //    다음 빌드 사이클에 태블릿 가로 레이아웃을 제대로 대응해야 한다.
      // 문서: https://developer.android.com/about/versions/16/behavior-changes-16
      const ORIENTATION_OPT_OUT = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';
      if (!mainApplication.property) {
        mainApplication.property = [];
      }
      const hasOptOut = mainApplication.property.some(
        (p) => p.$?.['android:name'] === ORIENTATION_OPT_OUT
      );
      if (!hasOptOut) {
        mainApplication.property.push({
          $: { 'android:name': ORIENTATION_OPT_OUT, 'android:value': 'true' },
        });
        console.log('✅ Android 16 세로고정 유지 property 추가됨');
      }
    }

    return config;
  });

  // 3. Android: build.gradle에 jitpack + kakao maven repo 추가
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      
      // allprojects.repositories에 jitpack + kakao maven 추가
      if (!contents.includes('jitpack.io')) {
        contents = contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {
    repositories {
        maven { url 'https://www.jitpack.io' }
        maven { url 'https://devrepo.kakao.com/nexus/content/groups/public/' }`
        );
        console.log('✅ jitpack + kakao maven repos 추가됨');
      }
      
      config.modResults.contents = contents;
    }
    return config;
  });

  // 4. Android: strings.xml에 kakao_app_key 추가 (카카오 로그인 리디렉션)
  config = withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string || [];
    
    // kakao_app_key가 이미 있는지 확인
    const existing = strings.find(s => s.$?.name === 'kakao_app_key');
    if (!existing) {
      strings.push({
        $: { name: 'kakao_app_key', translatable: 'false' },
        _: 'f62e4f5ddf705fb25094caae8d35d748'
      });
      console.log('✅ kakao_app_key 추가됨 (strings.xml)');
    }
    
    config.modResults.resources.string = strings;
    return config;
  });

  // 5. iOS: AppDelegate 에 FirebaseApp.configure() 삽입
  //    (자세한 배경은 위 insertFirebaseInit 주석 참고)
  config = withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(
        `[firebase-init] AppDelegate 언어가 swift 가 아닙니다 (${config.modResults.language}). ` +
        'Expo 가 바뀐 것이므로 app.plugin.js 의 5번 블록을 다시 확인하세요.'
      );
    }

    const result = insertFirebaseInit(config.modResults.contents);
    config.modResults.contents = result.contents;

    if (result.changed) {
      console.log('✅ FirebaseApp.configure() 삽입됨 (AppDelegate.swift) — iOS 측정 초기화');
    } else {
      console.log('ℹ️  FirebaseApp.configure() 가 이미 있어 건너뜀 (AppDelegate.swift)');
    }
    return config;
  });

  return config;
};

// 테스트용으로 변환 함수를 노출한다.
// iOS prebuild 는 macOS/Linux 에서만 돌아서 Windows 에서는 이 함수로만 검증할 수 있다.
module.exports.insertFirebaseInit = insertFirebaseInit;
