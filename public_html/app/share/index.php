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
        
        // 이미지 (첫 번째 이미지)
        if (isset($fields['images']['arrayValue']['values'][0]['stringValue'])) {
            $itemImage = $fields['images']['arrayValue']['values'][0]['stringValue'];
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
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="ChaoVietnam">
    
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo htmlspecialchars($title); ?>">
    <meta name="twitter:description" content="<?php echo htmlspecialchars($description); ?>">
    <meta name="twitter:image" content="<?php echo htmlspecialchars($image); ?>">
    
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; background:#fff; min-height:100vh; display:flex; align-items:center; justify-content:center; }
        .spinner { width:50px; height:50px; border:5px solid #f3f3f3; border-top:5px solid <?php echo $data['color']; ?>; border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
    </style>
</head>
<body>
    <div class="spinner"></div>
    
    <script>
        const deeplink = '<?php echo $deeplink; ?>'; // chaovietnam://type/id
        const isAndroid = <?php echo $isAndroid ? 'true' : 'false'; ?>;
        const isIOS = <?php echo $isIOS ? 'true' : 'false'; ?>;
        
        // 즉시 앱 열기 시도
        setTimeout(function() {
            console.log('🔗 딥링크:', deeplink);
            window.location.href = deeplink;
            
            // 1초 후 앱이 안 열리면 스토어로
            setTimeout(function() {
                console.log('📱 앱이 안 열림 → 스토어로 이동');
                if (isAndroid) {
                    window.location.href = 'https://play.google.com/store/apps/details?id=com.yourname.chaovnapp';
                } else if (isIOS) {
                    window.location.href = 'https://apps.apple.com/app/id6480538597';
                }
            }, 1000);
        }, 100);
    </script>
</body>
</html>
