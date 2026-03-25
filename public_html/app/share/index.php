<?php
// URL에서 type과 id 추출
$uri = $_SERVER['REQUEST_URI'];
preg_match('#/app/share/(danggn|job|realestate)/([^/\?\#]+)#', $uri, $matches);

$type = $matches[1] ?? 'danggn';
$id   = $matches[2] ?? '';

// 타입별 OG 기본 정보 (카카오 미리보기용)
$typeInfo = [
    'danggn'     => ['label' => '당근마켓/나눔', 'icon' => '🛍️', 'color' => '#FF6B35', 'collection' => 'XinChaoDanggn'],
    'job'        => ['label' => '구인구직',      'icon' => '💼', 'color' => '#2196F3', 'collection' => 'Jobs'],
    'realestate' => ['label' => '부동산',        'icon' => '🏠', 'color' => '#E91E63', 'collection' => 'RealEstate'],
];
$data = $typeInfo[$type];

// ✅ 1순위: 앱에서 query param으로 전달한 데이터 (App Check 우회)
$itemTitle = isset($_GET['t']) ? $_GET['t'] : '';
$itemImage = isset($_GET['img']) ? $_GET['img'] : '';
$itemPrice = isset($_GET['p']) ? $_GET['p'] : '';

// ✅ 2순위: query param 없으면 Firestore REST API 시도 (fallback)
if (!$itemTitle && $id) {
    $firebaseProjectId = 'chaovietnam-login';
    $collection = $data['collection'];
    $apiUrl = "https://firestore.googleapis.com/v1/projects/{$firebaseProjectId}/databases/(default)/documents/{$collection}/{$id}";

    $context  = stream_context_create(['http' => ['timeout' => 3]]);
    $response = @file_get_contents($apiUrl, false, $context);

    if ($response) {
        $firebaseData = json_decode($response, true);
        if (isset($firebaseData['fields'])) {
            $f = $firebaseData['fields'];
            $itemTitle = $itemTitle ?: ($f['title']['stringValue'] ?? '');
            if (!$itemImage) {
                $itemImage = $f['images']['arrayValue']['values'][0]['stringValue']
                    ?? $f['imageUrls']['arrayValue']['values'][0]['stringValue'] ?? '';
            }
            if (!$itemPrice) {
                if ($type === 'job') {
                    $itemPrice = $f['salary']['stringValue'] ?? '';
                } elseif ($type === 'danggn') {
                    $p = $f['price']['integerValue'] ?? '';
                    $itemPrice = $p ? number_format($p) . 'đ' : '';
                }
            }
        }
    }
}

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

// 타입 → Firestore 컬렉션 매핑 (view/index.html의 col 파라미터)
$colMap = [
    'job'        => 'Jobs',
    'danggn'     => 'XinChaoDanggn',
    'realestate' => 'RealEstate',
];
$col = $colMap[$type] ?? 'form_items';

// 웹 상세페이지 URL (Firebase Hosting)
$viewUrl = 'https://chaovietnam-login.web.app/view/?type=' . urlencode($type) . '&id=' . urlencode($id) . '&col=' . urlencode($col);
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo htmlspecialchars($pageTitle); ?></title>

<!-- OG 태그 (카카오톡 미리보기 카드용) -->
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
body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}
.spinner{width:40px;height:40px;border:4px solid #f0f0f0;border-top:4px solid <?php echo $data['color']; ?>;border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="spinner"></div>
<script>
// 웹 상세페이지로 즉시 이동
window.location.replace('<?php echo $viewUrl; ?>');
</script>
</body>
</html>
