<?php
// URL에서 type과 id 추출
$uri = $_SERVER['REQUEST_URI'];
preg_match('#/app/share/(danggn|job|realestate)/([^/\?]+)#', $uri, $matches);

$type = $matches[1] ?? 'danggn';
$id = $matches[2] ?? '';

// 타입별 기본 정보
$typeInfo = [
    'danggn' => ['label' => '당근마켓/나눔', 'icon' => '🛍️', 'color' => '#FF6B35', 'collection' => 'XinChaoDanggn'],
    'job' => ['label' => '구인구직', 'icon' => '💼', 'color' => '#2196F3', 'collection' => 'Jobs'],
    'realestate' => ['label' => '부동산', 'icon' => '🏠', 'color' => '#E91E63', 'collection' => 'RealEstate']
];

$data = $typeInfo[$type];

// Firebase REST API로 실제 상품 데이터 가져오기
$firebaseProjectId = 'chaovietnam-login';
$collection = $data['collection'];
$apiUrl = "https://firestore.googleapis.com/v1/projects/{$firebaseProjectId}/databases/(default)/documents/{$collection}/{$id}";

$itemTitle = '';
$itemImage = '';
$itemPrice = '';

// Firebase에서 데이터 가져오기
$context = stream_context_create(['http' => ['timeout' => 3]]);
$response = @file_get_contents($apiUrl, false, $context);

if ($response) {
    $firebaseData = json_decode($response, true);
    if (isset($firebaseData['fields'])) {
        $fields = $firebaseData['fields'];

        // 제목
        if (isset($fields['title']['stringValue'])) {
            $itemTitle = $fields['title']['stringValue'];
        }

        // 이미지 (첫 번째 이미지, 없으면 두 번째)
        if (isset($fields['images']['arrayValue']['values'][0]['stringValue'])) {
            $itemImage = $fields['images']['arrayValue']['values'][0]['stringValue'];
        }
        // 첫 이미지가 없으면 두 번째 시도
        if (empty($itemImage) && isset($fields['images']['arrayValue']['values'][1]['stringValue'])) {
            $itemImage = $fields['images']['arrayValue']['values'][1]['stringValue'];
        }

        // 가격
        if ($type === 'danggn' && isset($fields['price']['integerValue'])) {
            $itemPrice = number_format($fields['price']['integerValue']) . 'đ';
        } elseif ($type === 'job' && isset($fields['salary']['stringValue'])) {
            $itemPrice = $fields['salary']['stringValue'];
        } elseif ($type === 'realestate') {
            if (isset($fields['price']['integerValue'])) {
                $itemPrice = number_format($fields['price']['integerValue']) . 'đ';
            }
        }
    }
}

// 제목 및 설명
$title = $itemTitle ? $itemTitle . ' - ChaoVietnam' : $data['label'] . ' - ChaoVietnam';
$description = $data['icon'] . ' ' . ($itemTitle ?: $data['label']);
if ($itemPrice) {
    $description .= ' | ' . $itemPrice;
}

// 이미지 (실제 상품 이미지 또는 기본 이미지)
$defaultImages = [
    'danggn' => 'https://chaovietnam.co.kr/assets/danggn-default.jpg',
    'job' => 'https://chaovietnam.co.kr/assets/job-default.jpg',
    'realestate' => 'https://chaovietnam.co.kr/assets/realestate-default.jpg'
];
$image = $itemImage ?: $defaultImages[$type];

$url = 'https://chaovietnam.co.kr/app/share/' . $type . '/' . $id;
$deeplink = 'chaovietnam://' . $type . '/' . $id;

// User-Agent 확인
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isAndroid = preg_match('/Android/i', $userAgent);
$isIOS = preg_match('/iPhone|iPad|iPod/i', $userAgent);
?>
<!DOCTYPE html>
<html lang="ko">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($title); ?></title>

    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo htmlspecialchars($url); ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($title); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($description); ?>">
    <meta property="og:image" content="<?php echo htmlspecialchars($image); ?>">
    <?php
    // 실제 이미지 크기를 가져와 정확한 width/height 선언 (카카오 대형 카드 기준)
    // getimagesize가 실패하면 선언 생략 → Kakao가 직접 감지 (하드코딩 오류보다 안전)
    @ini_set('default_socket_timeout', 3);
    $imgSize = @getimagesize($image);
    if ($imgSize && $imgSize[0] > 0 && $imgSize[1] > 0) {
        echo '<meta property="og:image:width" content="' . $imgSize[0] . '">' . PHP_EOL;
        echo '    <meta property="og:image:height" content="' . $imgSize[1] . '">' . PHP_EOL;
    }
    ?>
    <meta property="og:image:alt" content="<?php echo htmlspecialchars($itemTitle ?: $data['label']); ?>">
    <meta property="og:site_name" content="ChaoVietnam">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo htmlspecialchars($title); ?>">
    <meta name="twitter:description" content="<?php echo htmlspecialchars($description); ?>">
    <meta name="twitter:image" content="<?php echo htmlspecialchars($image); ?>">

    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid
                <?php echo $data['color']; ?>
            ;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% {
                transform: rotate(0deg);
            }

            100% {
                transform: rotate(360deg);
            }
        }
    </style>
</head>

<body>
    <div class="spinner"></div>

    <script>
        const deeplink = '<?php echo $deeplink; ?>'; // chaovietnam://type/id
        const isAndroid = <?php echo $isAndroid ? 'true' : 'false'; ?>;
        const isIOS = <?php echo $isIOS ? 'true' : 'false'; ?>;

        // Android: intent:// 스킴으로 URL 데이터를 확실히 전달
        // 카카오톡 인앱 브라우저에서 chaovietnam:// 는 앱을 열지만 URL을 전달하지 않음
        function openApp() {
            if (isAndroid) {
                // intent://type/id#Intent;scheme=chaovietnam;package=com.yourname.chaovnapp;end
                var intentUrl = deeplink.replace('chaovietnam://', 'intent://');
                intentUrl += '#Intent;scheme=chaovietnam;package=com.yourname.chaovnapp;end';
                console.log('🔗 Android intent URL:', intentUrl);
                window.location.href = intentUrl;
            } else {
                console.log('🔗 iOS/기타 딥링크:', deeplink);
                window.location.href = deeplink;
            }
        }

        // 즉시 앱 열기 시도
        setTimeout(function () {
            openApp();

            // 1초 후 앱이 안 열리면 스토어로
            setTimeout(function () {
                if (!document.hidden) {
                    console.log('📱 앱이 안 열림 → 스토어로 이동');
                    if (isAndroid) {
                        window.location.href = 'https://play.google.com/store/apps/details?id=com.yourname.chaovnapp';
                    } else if (isIOS) {
                        window.location.href = 'https://apps.apple.com/app/id6480538597';
                    }
                }
            }, 1500);
        }, 100);
    </script>
</body>

</html>