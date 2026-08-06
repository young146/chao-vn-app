/**
 * Expo Config Plugin:
 * 1. react-native-google-mobile-ads의 codegenConfig를 제외 (iOS 크래시 방지)
 * 2. Android Manifest 충돌 해결 (DELAY_APP_MEASUREMENT_INIT)
 * 3. Android build.gradle에 jitpack + kakao maven repo 추가 (prebuild 호환)
 * 4. Android strings.xml에 kakao_app_key 추가 (카카오 로그인 리디렉션)
 */
const { withDangerousMod, withAndroidManifest, withProjectBuildGradle, withStringsXml } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

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

  return config;
};
