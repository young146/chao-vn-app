<?php
// URL에서 type과 id 추출
$uri = $_SERVER['REQUEST_URI'];
preg_match('#/app/share/(danggn|job|realestate)/([^/]+)#', $uri, $matches);

$type = $matches[1] ?? 'danggn';
$id = $matches[2] ?? '';

// 타입별 정보
$info = [
    'danggn' => ['title' => '당근마켓/나눔', 'icon' => '🛍️', 'color' => '#FF6B35', 'image' => 'https://s3-eu-west-1.amazonaws.com/obonparis/pictures/000/000/889/xxl/3215b6c3082f2c3fe66ef0e49553bd337c4708a6ed94aa2a2de90db902a9f137.jpg'],
    'job' => ['title' => '구인구직', 'icon' => '💼', 'color' => '#2196F3', 'image' => 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=630&fit=crop'],
    'realestate' => ['title' => '부동산', 'icon' => '🏠', 'color' => '#E91E63', 'image' => 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&h=630&fit=crop']
];

$data = $info[$type];
$title = $data['title'] . ' - ChaoVietnam';
$description = $data['icon'] . ' ' . $data['title'] . ' 정보를 ChaoVietnam 앱에서 확인하세요!';
$image = $data['image'];
$url = 'https://chaovietnam.co.kr' . $_SERVER['REQUEST_URI'];
$deeplink = 'chaovietnam://' . $type . '/' . $id;
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
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; background:linear-gradient(135deg,<?php echo $data['color']; ?>15 0%,<?php echo $data['color']; ?>05 100%); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .container { max-width:500px; width:100%; background:#fff; border-radius:24px; box-shadow:0 20px 60px rgba(0,0,0,0.1); padding:40px 30px; text-align:center; }
        .icon { font-size:80px; margin-bottom:20px; }
        h1 { font-size:28px; color:#333; margin-bottom:10px; }
        .subtitle { font-size:18px; color:<?php echo $data['color']; ?>; font-weight:600; margin-bottom:20px; }
        img { max-width:100%; height:auto; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); margin:20px 0; }
        .message { font-size:16px; color:#666; line-height:1.6; margin-bottom:30px; }
        .btn { display:block; width:100%; padding:16px; margin:12px 0; border:none; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer; text-decoration:none; color:#fff; background:<?php echo $data['color']; ?>; box-shadow:0 4px 15px <?php echo $data['color']; ?>40; }
        .store-buttons { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
        .store-btn { padding:12px; background:#000; color:#fff; border-radius:10px; text-decoration:none; font-size:14px; }
        .footer { margin-top:30px; padding-top:20px; border-top:1px solid #eee; color:#999; font-size:14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon"><?php echo $data['icon']; ?></div>
        <h1>ChaoVietnam</h1>
        <div class="subtitle"><?php echo htmlspecialchars($data['title']); ?></div>
        
        <img src="<?php echo htmlspecialchars($image); ?>" alt="<?php echo htmlspecialchars($data['title']); ?>">
        
        <div class="message">앱에서 더 많은 정보를 확인하세요!<br>앱이 설치되어 있다면 자동으로 열립니다.</div>
        
        <button class="btn" id="openApp">앱에서 열기</button>
        
        <div id="installSection" style="display:none;">
            <p style="margin:20px 0; color:#666;">앱이 설치되어 있지 않나요?</p>
            <div class="store-buttons">
                <a href="https://play.google.com/store/apps/details?id=com.yourname.chaovnapp" class="store-btn">📱 Google Play</a>
                <a href="https://apps.apple.com/app/chaovietnam/id123456789" class="store-btn">🍎 App Store</a>
            </div>
        </div>
        
        <button class="btn" id="goToWebsite" style="background:#f5f5f5; color:#666; margin-top:20px;">웹사이트로 이동</button>
        
        <div class="footer">© 2026 ChaoVietnam. All rights reserved.</div>
    </div>
    
    <script>
        const appScheme = '<?php echo $deeplink; ?>';
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.location.href = appScheme;
                setTimeout(function() {
                    if (!document.hidden) {
                        document.getElementById('installSection').style.display = 'block';
                    }
                }, 2000);
            }, 1000);
        });
        document.getElementById('openApp').addEventListener('click', function() {
            window.location.href = appScheme;
        });
        document.getElementById('goToWebsite').addEventListener('click', function() {
            if (confirm('지금 보시는 사이트는 씬짜오베트남 홈페이지입니다.\n\n당근/나눔, 구인구직, 부동산은 앱에서만 볼 수 있습니다.\n\n그래도 홈페이지로 이동하시겠습니까?')) {
                window.location.href = 'https://chaovietnam.co.kr';
            }
        });
    </script>
</body>
</html>
