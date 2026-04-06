import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XinChaoVietnam</title>
    <!-- Try multiple beautiful handwriting fonts just in case -->
    <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script&family=Great+Vibes&family=Playball&display=swap" rel="stylesheet">
    <style>
        body, html {
            margin: 0; padding: 0;
            height: 100%; width: 100%;
            display: flex; justify-content: center; align-items: center;
            background-color: transparent;
            overflow: hidden;
        }

        .container {
            position: relative;
            display: flex;
            align-items: center;
        }

        .brand-text {
            /* 폰트가 안불러와질 경우를 대비해 다양한 시그니처 폰트 폴백 설정 */
            font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Playball', 'Brush Script MT', 'Lucida Handwriting', cursive;
            font-size: 15vw;
            color: transparent;
            background: linear-gradient(45deg, #d4af37, #f3e5ab, #d4af37);
            background-size: 200% auto;
            -webkit-background-clip: text;
            background-clip: text;
            white-space: nowrap;
            /* Shimmering effect */
            animation: shimmerEffect 4s linear infinite;
        }

        .glow {
            position: absolute;
            top: 0; left: 0;
            font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Playball', 'Brush Script MT', 'Lucida Handwriting', cursive;
            font-size: 15vw;
            color: transparent;
            text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
            white-space: nowrap;
            z-index: -1;
        }

        /* 기종을 타지 않는 100% 안전한 가림막 애니메이션 (Mask 대신 Width 축소 사용) */
        .revealer {
            position: absolute;
            top: -10%; right: 0;
            height: 120%;
            width: 100%;
            background-color: #0f0f13; /* App.js의 배경색과 완전히 동일하게! */
            animation: slideOff 5s ease-in-out forwards;
            transform-origin: right;
            z-index: 5;
        }

        @keyframes slideOff {
            0% { width: 100%; }
            100% { width: 0%; }
        }

        @keyframes shimmerEffect {
            to { background-position: 200% center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="brand-text" id="text">XinChaoVietnam</div>
        <div class="glow">XinChaoVietnam</div>
        <!-- 글자를 왼쪽부터 가리고 있다가 사라지는 가림막 -->
        <div class="revealer"></div>
    </div>
    
    <!-- 폰트 로드 강제 확인용 스크립트 -->
    <script>
        document.fonts.ready.then(function() {
            // 폰트가 다 불러와진 직후부터 애니메이션 재생
            document.querySelector('.revealer').style.animationPlayState = 'running';
        });
    </script>
</body>
</html>
`;

export default function SplashAnimation() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        originWhitelist={['*']}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : 'none'}
        opaque={false}
        backgroundColor="transparent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
