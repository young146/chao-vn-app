module.exports = {
  dependencies: {
    // react-native-google-mobile-ads의 codegenConfig를 제외
    // newArchEnabled: false일 때도 RCTThirdPartyComponentsProvider가 실행되어
    // nil 객체 크래시가 발생하는 것을 방지
    'react-native-google-mobile-ads': {
      platforms: {
        ios: null, // iOS에서 autolinking은 유지하되 codegen만 제외
      },
    },
  },
};
