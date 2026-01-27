/**
 * Expo Config Plugin: 
 * 1. react-native-google-mobile-ads의 codegenConfig를 제외 (iOS 크래시 방지)
 * 2. Android Manifest 충돌 해결 (DELAY_APP_MEASUREMENT_INIT)
 */
const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGoogleMobileAdsCodegenExclude(config) {
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
        console.warn('⚠️ react-native-google-mobile-ads package.json을 찾을 수 없습니다:', googleMobileAdsPackagePath);
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
    }
    
    return config;
  });

  return config;
};
