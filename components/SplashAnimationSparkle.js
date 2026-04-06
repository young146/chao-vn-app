import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XinChaoVietnam Sparkle Animation</title>
    <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&display=swap" rel="stylesheet">
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
            font-family: 'Alex Brush', cursive;
            font-size: 15vw;
            color: transparent;
            background: linear-gradient(45deg, #d4af37, #f3e5ab, #d4af37);
            background-size: 200% auto;
            -webkit-background-clip: text; background-clip: text;
            white-space: nowrap;
            -webkit-mask-image: linear-gradient(to right, black 50%, rgba(0,0,0,0) 50%);
            -webkit-mask-size: 200% 100%;
            -webkit-mask-position: 100% 0;
            animation: writeEffect 5s ease-in-out forwards, shimmerEffect 4s linear infinite;
        }

        .glow {
            position: absolute; top: 0; left: 0;
            font-family: 'Alex Brush', cursive;
            font-size: 15vw;
            color: transparent;
            text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
            white-space: nowrap;
            -webkit-mask-image: linear-gradient(to right, black 50%, rgba(0,0,0,0) 50%);
            -webkit-mask-size: 200% 100%;
            -webkit-mask-position: 100% 0;
            animation: writeEffect 5s ease-in-out forwards;
            pointer-events: none; z-index: -1;
        }

        .sparkle-container {
            position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
        }

        .sparkle {
            position: absolute;
            top: 50%; left: 0;
            width: 8px; height: 8px;
            border-radius: 50%; background-color: #fff;
            box-shadow: 0 0 15px 8px rgba(255, 243, 204, 0.8), 0 0 30px 15px rgba(212, 175, 55, 0.6);
            transform: translate(-50%, -50%);
            opacity: 0;
            animation: sparkleMove 5s ease-in-out forwards;
            z-index: 10;
        }

        .sparkle::after, .sparkle::before {
            content: ''; position: absolute;
            top: 50%; left: 50%;
            background: #fff; border-radius: 50%;
            transform: translate(-50%, -50%);
        }
        .sparkle::after { width: 30px; height: 2px; }
        .sparkle::before { width: 2px; height: 30px; }

        @keyframes writeEffect {
            0% { -webkit-mask-position: 100% 0; }
            100% { -webkit-mask-position: 0% 0; }
        }

        @keyframes shimmerEffect {
            to { background-position: 200% center; }
        }

        @keyframes sparkleMove {
            0% { left: 0%; opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            30% { top: 40%; }
            50% { top: 60%; }
            70% { top: 45%; }
            90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { left: 100%; top: 50%; opacity: 0; transform: translate(-50%, -50%) scale(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="brand-text">XinChaoVietnam</div>
        <div class="glow">XinChaoVietnam</div>
        <div class="sparkle-container"><div class="sparkle"></div></div>
    </div>
</body>
</html>
`;

export default function SplashAnimationSparkle() {
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
