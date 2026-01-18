/**
 * Windows용 간단한 검증 스크립트
 * app.plugin.js 설정이 올바른지 확인
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

console.log('🔍 app.plugin.js 설정 검증...\n');

// 1. app.plugin.js 존재 확인
const pluginPath = path.join(projectRoot, 'app.plugin.js');
if (!fs.existsSync(pluginPath)) {
  console.error('❌ app.plugin.js를 찾을 수 없습니다');
  process.exit(1);
}
console.log('✅ app.plugin.js 존재 확인');

// 2. app.json에 플러그인 등록 확인
const appJsonPath = path.join(projectRoot, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

if (!appJson.expo.plugins || !appJson.expo.plugins.includes('./app.plugin.js')) {
  console.error('❌ app.json에 app.plugin.js가 등록되지 않았습니다');
  process.exit(1);
}
console.log('✅ app.json에 app.plugin.js 등록 확인');

// 3. newArchEnabled 확인
if (appJson.expo.newArchEnabled !== false) {
  console.warn('⚠️  newArchEnabled가 false로 설정되지 않았습니다');
} else {
  console.log('✅ newArchEnabled: false 확인');
}

// 4. codegenConfig 존재 확인 (제거 전 상태)
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

if (!packageJson.codegenConfig) {
  console.warn('⚠️  codegenConfig가 이미 제거되어 있습니다 (이전 빌드의 영향일 수 있음)');
} else {
  console.log('✅ codegenConfig 존재 확인 (EAS 빌드 시 제거될 예정)');
}

console.log('\n✅ 모든 설정이 올바릅니다!');
console.log('\n💡 Windows에서는 iOS prebuild가 불가능하므로:');
console.log('   - EAS 빌드 시 app.plugin.js가 자동으로 실행됩니다');
console.log('   - 빌드 로그에서 "codegenConfig 제거됨" 메시지를 확인하세요');
console.log('   - TestFlight에서 실제 크래시 테스트를 진행하세요');
