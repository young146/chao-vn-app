/**
 * 빌드 전 검증 스크립트
 * react-native-google-mobile-ads의 codegenConfig가 제거되었는지 확인
 */
const fs = require('fs');
const path = require('path');

const packagePath = path.join(
  __dirname,
  '..',
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
  console.error('❌ codegenConfig가 아직 존재합니다!');
  console.error('   app.plugin.js가 제대로 실행되지 않았을 수 있습니다.');
  console.error('   codegenConfig:', JSON.stringify(packageJson.codegenConfig, null, 2));
  process.exit(1);
} else {
  console.log('✅ codegenConfig가 제거되었습니다');
  process.exit(0);
}
