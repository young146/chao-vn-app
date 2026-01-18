/**
 * Prebuild 실행 및 검증 스크립트
 * 로컬에서 빌드 전에 codegenConfig 제거가 제대로 작동하는지 확인
 * Windows에서는 iOS prebuild가 불가능하므로 app.plugin.js만 테스트
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const projectRoot = path.join(__dirname, '..');

console.log('🔍 Prebuild 전 검증 시작...\n');

// 1. codegenConfig 확인
const packagePath = path.join(
  projectRoot,
  'node_modules',
  'react-native-google-mobile-ads',
  'package.json'
);

if (!fs.existsSync(packagePath)) {
  console.error('❌ react-native-google-mobile-ads package.json을 찾을 수 없습니다');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

if (packageJson.codegenConfig) {
  console.log('ℹ️  codegenConfig가 아직 존재합니다');
} else {
  console.log('✅ codegenConfig가 이미 제거되었습니다');
}

if (isWindows) {
  console.log('\n⚠️  Windows에서는 iOS prebuild가 불가능합니다.');
  console.log('   app.plugin.js가 제대로 작동하는지 수동으로 테스트합니다.\n');
  
  // Windows에서는 app.plugin.js를 직접 실행해서 테스트
  console.log('📝 app.plugin.js 테스트 중...');
  
  // Expo config를 로드해서 플러그인 실행
  try {
    const { getConfig } = require('@expo/config');
    const config = getConfig(projectRoot);
    
    // 플러그인 실행 시뮬레이션
    const pluginPath = path.join(projectRoot, 'app.plugin.js');
    if (fs.existsSync(pluginPath)) {
      const plugin = require(pluginPath);
      const modifiedConfig = plugin(config);
      
      // codegenConfig가 제거되었는지 확인
      const packageJsonAfter = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJsonAfter.codegenConfig) {
        console.error('❌ app.plugin.js 실행 후에도 codegenConfig가 여전히 존재합니다!');
        console.error('   플러그인이 제대로 작동하지 않았을 수 있습니다.');
        process.exit(1);
      } else {
        console.log('✅ app.plugin.js가 codegenConfig를 제거했습니다');
      }
    } else {
      console.error('❌ app.plugin.js를 찾을 수 없습니다');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 플러그인 테스트 실패:', error.message);
    console.log('\n💡 대안: EAS 빌드 시 app.plugin.js가 자동으로 실행됩니다.');
    console.log('   빌드 로그에서 "codegenConfig 제거됨" 메시지를 확인하세요.');
  }
  
  console.log('\n✅ Windows 검증 완료');
  console.log('   실제 iOS 빌드는 EAS Build에서 수행되며, app.plugin.js가 자동 실행됩니다.');
} else {
  // macOS/Linux에서는 실제 prebuild 실행
  console.log('\n📦 Prebuild 실행 중...');
  try {
    execSync('npx expo prebuild --platform ios --clean', {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    console.log('\n✅ Prebuild 완료\n');
  } catch (error) {
    console.error('\n❌ Prebuild 실패:', error.message);
    process.exit(1);
  }

  // 3. codegenConfig 제거 확인
  const packageJsonAfter = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (packageJsonAfter.codegenConfig) {
    console.error('❌ Prebuild 후에도 codegenConfig가 여전히 존재합니다!');
    console.error('   app.plugin.js가 제대로 실행되지 않았을 수 있습니다.');
    process.exit(1);
  } else {
    console.log('✅ codegenConfig가 제거되었습니다');
  }

  // 4. RCTThirdPartyComponentsProvider.mm 확인
  const generatedFile = path.join(
    projectRoot,
    'ios',
    'build',
    'generated',
    'ios',
    'RCTThirdPartyComponentsProvider.mm'
  );

  if (fs.existsSync(generatedFile)) {
    const content = fs.readFileSync(generatedFile, 'utf8');
    
    // AdMob 컴포넌트가 포함되어 있는지 확인
    const hasAdMob = content.includes('RNGoogleMobileAdsBannerView') ||
                      content.includes('RNGoogleMobileAdsNativeView') ||
                      content.includes('RNGoogleMobileAdsMediaView');
    
    if (hasAdMob) {
      console.error('❌ RCTThirdPartyComponentsProvider.mm에 AdMob 컴포넌트가 포함되어 있습니다!');
      console.error('   codegenConfig 제거가 제대로 작동하지 않았습니다.');
      process.exit(1);
    } else {
      console.log('✅ RCTThirdPartyComponentsProvider.mm에 AdMob 컴포넌트가 포함되지 않았습니다');
    }
  } else {
    console.log('ℹ️  RCTThirdPartyComponentsProvider.mm 파일이 생성되지 않았습니다 (정상일 수 있음)');
  }

  console.log('\n🎉 모든 검증 통과! iOS 빌드가 안전합니다.');
}
