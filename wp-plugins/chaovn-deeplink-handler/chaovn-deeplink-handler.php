<?php
/**
 * Plugin Name: ChaoVN Deep Link Handler
 * Plugin URI: https://chaovietnam.co.kr
 * Description: 앱 딥링크 및 설치 유도 시스템 (이미지 프록시 포함)
 * Version: 1.0.0
 * Author: ChaoVietnam
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) exit;

define('CHAOVN_DEEPLINK_VERSION', '1.0.0');

// Rewrite Rules 등록
add_action('init', function() {
    add_rewrite_rule('^app/share/danggn/([0-9a-zA-Z_-]+)/?$', 'index.php?chaovn_share=1&chaovn_type=danggn&chaovn_id=$matches[1]', 'top');
    add_rewrite_rule('^app/share/job/([0-9a-zA-Z_-]+)/?$', 'index.php?chaovn_share=1&chaovn_type=job&chaovn_id=$matches[1]', 'top');
    add_rewrite_rule('^app/share/realestate/([0-9a-zA-Z_-]+)/?$', 'index.php?chaovn_share=1&chaovn_type=realestate&chaovn_id=$matches[1]', 'top');
    
    // 이미지 프록시 규칙
    add_rewrite_rule('^app/share/img/([0-9a-zA-Z_-]+)/?$', 'index.php?chaovn_img_proxy=1&chaovn_img_id=$matches[1]', 'top');
});

// Query Vars 등록
add_filter('query_vars', function($vars) {
    $vars[] = 'chaovn_share';
    $vars[] = 'chaovn_type';
    $vars[] = 'chaovn_id';
    $vars[] = 'chaovn_img_proxy';
    $vars[] = 'chaovn_img_id';
    return $vars;
});

// REST API: 이미지 URL 저장
add_action('rest_api_init', function() {
    register_rest_route('chaovn/v1', '/share/cache-image', array(
        'methods' => 'POST',
        'callback' => 'chaovn_cache_image',
        'permission_callback' => '__return_true',
    ));
});

function chaovn_cache_image($request) {
    $image_url = $request->get_param('image_url');
    $type = $request->get_param('type');
    $item_id = $request->get_param('item_id');
    
    if (!$image_url || !$type || !$item_id) {
        return new WP_Error('missing_params', '필수 파라미터가 없습니다', array('status' => 400));
    }
    
    // 이미지 URL을 해시하여 짧은 ID 생성
    $image_id = substr(md5($image_url), 0, 12);
    
    // 옵션으로 저장 (24시간 캐시)
    set_transient('chaovn_img_' . $image_id, $image_url, 24 * HOUR_IN_SECONDS);
    
    return array(
        'success' => true,
        'image_id' => $image_id,
        'proxy_url' => get_site_url() . '/app/share/img/' . $image_id
    );
}

// 이미지 프록시 및 템플릿 리다이렉트
add_action('template_redirect', function() {
    if (get_query_var('chaovn_img_proxy')) {
        $img_id = get_query_var('chaovn_img_id');
        if ($img_id) {
            $image_url = get_transient('chaovn_img_' . $img_id);
            if ($image_url) {
                // 이미지 리다이렉트
                wp_redirect($image_url, 302);
                exit;
            }
        }
        status_header(404);
        exit;
    }
    
    if (get_query_var('chaovn_share')) {
        $type = get_query_var('chaovn_type');
        $id = get_query_var('chaovn_id');
        if ($type && $id) {
            chaovn_render_share_page($type, $id);
            exit;
        }
    }
});

// 공유 페이지 렌더링
function chaovn_render_share_page($type, $id) {
    $type_info = array(
        'danggn' => array(
            'title' => '당근마켓/나눔', 
            'icon' => '🛍️', 
            'color' => '#FF6B35',
            'image' => 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=630&fit=crop'
        ),
        'job' => array(
            'title' => '구인구직', 
            'icon' => '💼', 
            'color' => '#2196F3',
            'image' => 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=630&fit=crop'
        ),
        'realestate' => array(
            'title' => '부동산', 
            'icon' => '🏠', 
            'color' => '#E91E63',
            'image' => 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&h=630&fit=crop'
        ),
    );
    
    $info = $type_info[$type] ?? $type_info['danggn'];
    $title = $info['title'];
    $description = $info['icon'] . ' ' . $info['title'] . ' 정보를 ChaoVietnam 앱에서 확인하세요!';
    $image_url = $info['image'];
    $app_deep_link = 'chaovietnam://' . $type . '/' . $id;
    $play_store_url = 'https://play.google.com/store/apps/details?id=com.yourname.chaovnapp';
    $app_store_url = 'https://apps.apple.com/app/chaovietnam/id123456789';
?>
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo esc_html($title); ?> - ChaoVietnam</title>
    
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo esc_url(get_site_url() . '/app/share/' . $type . '/' . $id); ?>">
    <meta property="og:title" content="<?php echo esc_attr($title); ?> - ChaoVietnam">
    <meta property="og:description" content="<?php echo esc_attr($description); ?>">
    <meta property="og:site_name" content="ChaoVietnam">
    <?php if ($image_url): ?>
    <meta property="og:image" content="<?php echo esc_url($image_url); ?>">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <?php endif; ?>
    
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="<?php echo esc_attr($title); ?>">
    <meta property="twitter:description" content="<?php echo esc_attr($description); ?>">
    <?php if ($image_url): ?>
    <meta property="twitter:image" content="<?php echo esc_url($image_url); ?>">
    <?php endif; ?>
    
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; background:linear-gradient(135deg,<?php echo $info['color']; ?>15 0%,<?php echo $info['color']; ?>05 100%); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .container { max-width:500px; width:100%; background:#fff; border-radius:24px; box-shadow:0 20px 60px rgba(0,0,0,0.1); padding:40px 30px; text-align:center; }
        .icon { font-size:80px; margin-bottom:20px; }
        h1 { font-size:28px; color:#333; margin-bottom:10px; }
        .subtitle { font-size:18px; color:<?php echo $info['color']; ?>; font-weight:600; margin-bottom:20px; }
        .title { font-size:18px; font-weight:600; color:#333; margin-bottom:10px; }
        img { max-width:100%; height:auto; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); margin:20px 0; }
        .message { font-size:16px; color:#666; line-height:1.6; margin-bottom:30px; }
        .btn { display:block; width:100%; padding:16px; margin:12px 0; border:none; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer; text-decoration:none; color:#fff; background:<?php echo $info['color']; ?>; box-shadow:0 4px 15px <?php echo $info['color']; ?>40; }
        .store-buttons { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
        .store-btn { padding:12px; background:#000; color:#fff; border-radius:10px; text-decoration:none; font-size:14px; }
        .footer { margin-top:30px; padding-top:20px; border-top:1px solid #eee; color:#999; font-size:14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon"><?php echo $info['icon']; ?></div>
        <h1>ChaoVietnam</h1>
        <div class="subtitle"><?php echo esc_html($info['title']); ?></div>
        
        <?php if ($image_url && strpos($image_url, 'default-share-image') === false): ?>
        <div style="margin: 20px 0;">
            <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($title); ?>"
                 style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        </div>
        <?php endif; ?>
        
        <div class="message">앱에서 더 많은 정보를 확인하세요!<br>앱이 설치되어 있다면 자동으로 열립니다.</div>
        
        <button class="btn" id="openApp">앱에서 열기</button>
        
        <div id="installSection" style="display:none;">
            <p style="margin:20px 0; color:#666;">앱이 설치되어 있지 않나요?</p>
            <div class="store-buttons">
                <a href="<?php echo esc_url($play_store_url); ?>" class="store-btn">📱 Google Play</a>
                <a href="<?php echo esc_url($app_store_url); ?>" class="store-btn">🍎 App Store</a>
            </div>
        </div>
        
        <a href="https://chaovietnam.co.kr" class="btn" style="background:#f5f5f5; color:#666; margin-top:20px;">웹사이트로 이동</a>
        
        <div class="footer">© 2026 ChaoVietnam. All rights reserved.</div>
    </div>
    
    <script>
        const appScheme = '<?php echo $app_deep_link; ?>';
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
    </script>
</body>
</html>
<?php
}

register_activation_hook(__FILE__, function() { flush_rewrite_rules(); });
register_deactivation_hook(__FILE__, function() { flush_rewrite_rules(); });
