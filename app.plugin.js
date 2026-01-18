/**
 * Expo Config Plugin: react-native-google-mobile-ads의 codegenConfig를 제외
 * newArchEnabled: false일 때도 RCTThirdPartyComponentsProvider가 실행되어
 * nil 객체 크래시가 발생하는 것을 방지
 * 
 * 이 플러그인은 prebuild 시 react-native-google-mobile-ads의 package.json에서
 * codegenConfig를 제거하여 RCTThirdPartyComponentsProvider에 포함되지 않도록 합니다.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGoogleMobileAdsCodegenExclude(config) {
  // iOS와 Android 모두 처리
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
          
          // codegenConfig를 제거하여 RCTThirdPartyComponentsProvider에 포함되지 않도록 함
          if (packageJson.codegenConfig) {
            const originalCodegenConfig = packageJson.codegenConfig;
            delete packageJson.codegenConfig;
            
            // 백업 파일 생성 (나중에 복원 가능하도록)
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
          throw error; // 실패 시 빌드 중단
        }
      } else {
        console.warn('⚠️ react-native-google-mobile-ads package.json을 찾을 수 없습니다:', googleMobileAdsPackagePath);
      }

      return config;
    },
  ]);

  return config;
};
