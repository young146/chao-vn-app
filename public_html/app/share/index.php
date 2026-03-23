<?php
// URL에서 type과 id 추출
$uri = $_SERVER['REQUEST_URI'];
preg_match('#/app/share/(danggn|job|realestate)/([^/\?]+)#', $uri, $matches);

$type = $matches[1] ?? 'danggn';
$id = $matches[2] ?? '';

// 타입별 기본 정보
$typeInfo = [
    'danggn'     => ['label' => '당근마켓/나눔',  'icon' => '🛍️', 'color' => '#FF6B35', 'colorDark' => '#e05a2a', 'collection' => 'XinChaoDanggn'],
    'job'        => ['label' => '구인구직',       'icon' => '💼', 'color' => '#2196F3', 'colorDark' => '#1976D2', 'collection' => 'Jobs'],
    'realestate' => ['label' => '부동산',         'icon' => '🏠', 'color' => '#E91E63', 'colorDark' => '#C2185B', 'collection' => 'RealEstate'],
];

$data = $typeInfo[$type];

// Firebase REST API로 실제 상품 데이터 가져오기
$firebaseProjectId = 'chaovietnam-login';
$collection = $data['collection'];
$apiUrl = "https://firestore.googleapis.com/v1/projects/{$firebaseProjectId}/databases/(default)/documents/{$collection}/{$id}";

$itemTitle   = '';
$itemImage   = '';
$itemPrice   = '';
$itemCity    = '';
$itemDesc    = '';

$context  = stream_context_create(['http' => ['timeout' => 3]]);
$response = @file_get_contents($apiUrl, false, $context);

if ($response) {
    $firebaseData = json_decode($response, true);
    if (isset($firebaseData['fields'])) {
        $f = $firebaseData['fields'];

        $itemTitle = $f['title']['stringValue'] ?? '';

        // 이미지 (images 배열 우선, imageUrls 차선)
        $itemImage = $f['images']['arrayValue']['values'][0]['stringValue']
            ?? $f['imageUrls']['arrayValue']['values'][0]['stringValue']
            ?? '';

        // 가격/급여
        if ($type === 'danggn') {
            $p = $f['price']['integerValue'] ?? $f['price']['doubleValue'] ?? '';
            $itemPrice = $p ? number_format($p) . 'đ' : '';
        } elseif ($type === 'job') {
            $itemPrice = $f['salary']['stringValue'] ?? '';
        } elseif ($type === 'realestate') {
            $p = $f['price']['integerValue'] ?? $f['price']['doubleValue'] ?? '';
            $itemPrice = $p ? number_format($p) . 'đ' : '';
        }

        $itemCity = trim(($f['city']['stringValue'] ?? '') . ' ' . ($f['district']['stringValue'] ?? ''));
        $itemDesc = $f['description']['stringValue'] ?? $f['desc']['stringValue'] ?? '';
        if (strlen($itemDesc) > 100) $itemDesc = mb_substr($itemDesc, 0, 100) . '...';
    }
}

// OG 메타
$pageTitle   = $itemTitle ? $itemTitle . ' — 씬짜오베트남' : $data['label'] . ' — 씬짜오베트남';
$description = $data['icon'] . ' ' . ($itemTitle ?: $data['label']);
if ($itemPrice) $description .= ' | ' . $itemPrice;

$defaultImages = [
    'danggn'     => 'https://chaovietnam.co.kr/assets/danggn-default.jpg',
    'job'        => 'https://chaovietnam.co.kr/assets/job-default.jpg',
    'realestate' => 'https://chaovietnam.co.kr/assets/realestate-default.jpg',
];
$image   = $itemImage ?: $defaultImages[$type];
$pageUrl = 'https://chaovietnam.co.kr/app/share/' . $type . '/' . $id;

// 딥링크
$deeplink   = 'chaovietnam://' . $type . '/' . $id;
$androidPkg = 'com.yourname.chaovnapp';
$iosStore   = 'https://apps.apple.com/us/app/id6754750793';
$androidStore = 'https://play.google.com/store/apps/details?id=' . $androidPkg;

$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isAndroid = preg_match('/Android/i', $userAgent) ? 'true' : 'false';
$isIOS     = preg_match('/iPhone|iPad|iPod/i', $userAgent) ? 'true' : 'false';

$color     = $data['color'];
$colorDark = $data['colorDark'];
$icon      = $data['icon'];
$label     = $data['label'];
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title><?php echo htmlspecialchars($pageTitle); ?></title>

<meta property="og:type"        content="website">
<meta property="og:url"         content="<?php echo htmlspecialchars($pageUrl); ?>">
<meta property="og:title"       content="<?php echo htmlspecialchars($pageTitle); ?>">
<meta property="og:description" content="<?php echo htmlspecialchars($description); ?>">
<meta property="og:image"       content="<?php echo htmlspecialchars($image); ?>">
<meta property="og:site_name"   content="씬짜오베트남">
<meta name="twitter:card"       content="summary_large_image">
<meta name="twitter:title"      content="<?php echo htmlspecialchars($pageTitle); ?>">
<meta name="twitter:description" content="<?php echo htmlspecialchars($description); ?>">
<meta name="twitter:image"      content="<?php echo htmlspecialchars($image); ?>">

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:20px 16px 40px}

/* 헤더 */
.header{width:100%;max-width:480px;display:flex;align-items:center;gap:10px;margin-bottom:16px}
.header-logo{font-size:28px}
.header-text{font-size:13px;color:#888}
.header-title{font-size:16px;font-weight:700;color:#333}

/* 카드 */
.card{width:100%;max-width:480px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10)}
.card-img{width:100%;height:220px;object-fit:cover;display:block;background:#eee}
.card-img-placeholder{width:100%;height:180px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,<?php echo $color;?>18,<?php echo $color;?>30);font-size:64px}
.card-body{padding:20px}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;background:<?php echo $color;?>;margin-bottom:12px}
.card-title{font-size:19px;font-weight:800;color:#1a1a1a;line-height:1.4;margin-bottom:8px}
.card-price{font-size:17px;font-weight:700;color:<?php echo $color;?>;margin-bottom:6px}
.card-location{font-size:13px;color:#888;margin-bottom:8px}
.card-desc{font-size:14px;color:#666;line-height:1.6;border-top:1px solid #f0f0f0;padding-top:12px;margin-top:12px}

/* 버튼 */
.btn-open{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:480px;margin-top:16px;padding:18px;background:linear-gradient(135deg,<?php echo $color;?>,<?php echo $colorDark;?>);color:#fff;border:none;border-radius:16px;font-size:18px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 4px 18px <?php echo $color;?>55;text-decoration:none;transition:transform .12s}
.btn-open:active{transform:scale(0.97)}
.btn-app{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;max-width:480px;margin-top:10px;padding:14px;background:#fff;color:#555;border:1.5px solid #ddd;border-radius:14px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;text-decoration:none;transition:background .12s}
.btn-app:active{background:#f5f5f5}

/* 앱 열기 중 오버레이 */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;align-items:center;justify-content:center;flex-direction:column;gap:18px;text-align:center;padding:30px}
.overlay.show{display:flex}
.overlay-icon{font-size:56px}
.overlay-title{font-size:20px;font-weight:800;color:#fff}
.overlay-sub{font-size:14px;color:rgba(255,255,255,0.75);line-height:1.6}
.btn-cancel{padding:12px 28px;background:rgba(255,255,255,0.15);color:#fff;border:1.5px solid rgba(255,255,255,0.3);border-radius:12px;font-size:15px;font-family:inherit;cursor:pointer;margin-top:8px}

.footer{margin-top:24px;font-size:12px;color:#bbb;text-align:center}
</style>
</head>
<body>

<!-- 헤더 -->
<div class="header">
    <span class="header-logo">🌏</span>
    <div>
        <div class="header-title">씬짜오베트남</div>
        <div class="header-text">베트남의 모든 시선이 모이는 곳</div>
    </div>
</div>

<!-- 미리보기 카드 -->
<div class="card">
    <?php if ($itemImage): ?>
        <img class="card-img" src="<?php echo htmlspecialchars($itemImage); ?>" alt="<?php echo htmlspecialchars($itemTitle); ?>" onerror="this.style.display='none'">
    <?php else: ?>
        <div class="card-img-placeholder"><?php echo $icon; ?></div>
    <?php endif; ?>

    <div class="card-body">
        <span class="badge"><?php echo $icon . ' ' . htmlspecialchars($label); ?></span>
        <div class="card-title"><?php echo htmlspecialchars($itemTitle ?: $label . ' 게시물'); ?></div>
        <?php if ($itemPrice): ?>
            <div class="card-price">💰 <?php echo htmlspecialchars($itemPrice); ?></div>
        <?php endif; ?>
        <?php if ($itemCity): ?>
            <div class="card-location">📍 <?php echo htmlspecialchars($itemCity); ?></div>
        <?php endif; ?>
        <?php if ($itemDesc): ?>
            <div class="card-desc"><?php echo nl2br(htmlspecialchars($itemDesc)); ?></div>
        <?php endif; ?>
    </div>
</div>

<!-- 상세히 보기 (메인 버튼) → 웹 �
<div class="footer">씬짜오베트남 앱에서 더 많은 정보를 확인하세요</div>

</body>
</html>
