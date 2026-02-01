/**
 * 🎨 다크모드 지원 색상 테마
 * 
 * 사용법:
 * ```javascript
 * import { useColorScheme } from 'react-native';
 * import { getColors } from '../utils/colors';
 * 
 * const colorScheme = useColorScheme();
 * const colors = getColors(colorScheme);
 * 
 * <TextInput style={{ color: colors.text }} />
 * ```
 */

export const lightColors = {
  // 텍스트
  text: '#000000',
  textSecondary: '#666666',
  textPlaceholder: 'rgba(0, 0, 0, 0.38)',
  
  // 배경
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  
  // 입력 필드
  inputBackground: '#FFFFFF',
  inputBorder: '#DDDDDD',
  inputText: '#000000',
  
  // 버튼 & 강조
  primary: '#FF6B35',
  primaryText: '#FFFFFF',
  
  // 기타
  separator: '#EEEEEE',
  disabled: '#999999',
  error: '#FF3B30',
};

export const darkColors = {
  // 텍스트
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textPlaceholder: 'rgba(255, 255, 255, 0.38)',
  
  // 배경
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  
  // 입력 필드
  inputBackground: '#2C2C2E',
  inputBorder: '#3A3A3C',
  inputText: '#FFFFFF',
  
  // 버튼 & 강조
  primary: '#FF6B35',
  primaryText: '#FFFFFF',
  
  // 기타
  separator: '#3A3A3C',
  disabled: '#666666',
  error: '#FF453A',
};

/**
 * colorScheme에 따라 적절한 색상 팔레트를 반환
 * @param {string} colorScheme - 'light' | 'dark'
 * @returns {object} 색상 팔레트
 */
export function getColors(colorScheme) {
  return colorScheme === 'dark' ? darkColors : lightColors;
}
