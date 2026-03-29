<?php
/**
 * Plugin Name: ChaoVN Deep Link Handler
 * Plugin URI: https://chaovietnam.co.kr
 * Description: 앱 딥링크, App Links/Universal Links 인증, 앱 설치 유도 팝업 (이미지 프록시 포함)
 * Version: 2.0.0
 * Author: ChaoVietnam
 * License: GPL v2 or later
 */

if (!defined('ABSPATH'))
    exit;

define('CHAOVN_DEEPLINK_VERSION', '2.0.0');

// ============================================================
// 앱 정보 상수
// ============================================================
define('CHAOVN_ANDROID_PACKAGE',    'com.yourname.chaovnapp');
define('CHAOVN_ANDROID_SHA256',     'A1:3F:CC:62:D0:78:8C:24:DF:5D:CF:74:95:A3:6A:64:CA:53:04:73:48:B1:FC:E1:57:9F:04:7A:33:54:40:A1');
define('CHAOVN_IOS_BUNDLE_ID',      'com.yourname.chaovnapp');
define('CHAOVN_IOS_TEAM_ID',        '9NAKBDVGPP');
define('CHAOVN_PLAY_STORE_URL',     'https://play.google.com/store/apps/details?id=com.yourname.chaovnapp');
define('CHAOVN_APP_STORE_URL',      'https://apps.apple.com/app/id6754750793');
define('CHAOVN_APP_SCHEME',         'chaovietnam://');
define('CHAOVN_NEWS_TERMINAL_SLUG', 'daily-news-terminal');

// ============================================================
// 1. Rewrite Rules 등록 (danggn / job / realestate 공유 페이지)
// ============================================================
add_action('init', function () {
    add_rewrite_rule('^app/share/danggn/([0-9a-zA-Z_-]+)/?$',     'index.php?chaovn_share=1&chaovn_type=danggn&chaovn_id=$matches[1]',     'top');
    add_rewrite_rule('^app/share/job/([0-9a-zA-Z_-]+)/?$',        'index.php?chaovn_share=1&chaovn_type=job&chaovn_id=$matches[1]',        'top');
    add_rewrite_rule('^app/share/realestate/([0-9a-zA-Z_-]+)/?$', 'index.php?chaovn_share=1&chaovn_type=realestate&chaovn_id=$matches[1]', 'top');
    add_rewrite_rule('^app/share/img/([0-9a-zA-Z_-]+)/?$',        'index.php?chaovn_img_proxy=1&chaovn_img_id=$matches[1]',                'top');
});

// ============================================================
// 2. Query Vars 등록
// ============================================================
add_filter('query_vars', function ($vars) {
    $vars[] = 'chaovn_share';
    $vars[] = 'chaovn_type';
    $vars[] = 'chaovn_id';
    $vars[] = 'chaovn_img_proxy';
    $vars[] = 'chaovn_img_id';
    return $vars;
});

// ============================================================
// 3. REST API: 이미지 URL 캐시
// ============================================================
add_action('rest_api_init', function () {
    register_rest_route('chaovn/v1', '/share/cache-image', [
        'methods'             => 'POST',
        'callback'            => 'chaovn_cache_image',
        'permission_callback' => '__return_true',
    ]);
});

function chaovn_cache_image($request)
{
    $image_url = $request->get_param('image_url');
    $type      = $request->get_param('type');
    $item_id   = $request->get_param('item_id');

    if (!$image_url || !$type || !$item_id) {
        return new WP_Error('missing_params', '필수 파라미터가 없습니다', ['status' => 400]);
    }

    $image_id = substr(md5($image_url), 0, 12);
    set_transient('chaovn_img_' . $image_id, $image_url, 24 * HOUR_IN_SECONDS);

    return [
        'success'   => true,
        'image_id'  => $image_id,
        'proxy_url' => get_site_url() . '/app/share/img/' . $image_id,
    ];
}

// ============================================================
// 4. 이미지 프록시 + 공유 페이지 렌더링
// ============================================================
add_action('template_redirect', function () {
    if (get_query_var('chaovn_img_proxy')) {
        $img_id    = get_query_var('chaovn_img_id');
        $image_url = $img_id ? get_transient('chaovn_img_' . $img_id) : false;
        if ($image_url) {
            wp_redirect($image_url, 302);
            exit;
        }
        status_header(404);
        exit;
    }

    if (get_query_var('chaovn_share')) {
        $type = get_query_var('chaovn_type');
        $id   = get_query_var('chaovn_id');
        if ($type && $id) {
            chaovn_render_share_page($type, $id);
            exit;
        }
    }
});

// ============================================================
// 5. 뉴스 터미널 페이지 — 앱 설치 유도 팝업 주입
//    daily-news-terminal 슬러그 페이지에만 적용
// ============================================================
add_action('wp_footer', function () {
    if (!is_page(CHAOVN_NEWS_TERMINAL_SLUG)) return;

    $play_store_url = CHAOVN_PLAY_STORE_URL;
    $app_store_url  = CHAOVN_APP_STORE_URL;
    $app_scheme     = CHAOVN_APP_SCHEME;
    $site_icon_url  = get_site_icon_url(128);
    if (!$site_icon_url) {
        $site_icon_url = get_site_url() . '/wp-content/uploads/chaovn-app-icon.png';
    }
    ?>
    <!-- ChaoVN 앱 설치 유도 팝업 v2.0 -->
    <style>
    #chaovn-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 99999;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    #chaovn-overlay.chaovn-show {
        opacity: 1;
        pointer-events: all;
    }
    #chaovn-sheet {
        width: 100%;
        max-width: 480px;
        background: #fff;
        border-radius: 28px 28px 0 0;
        overflow: hidden;
        transform: translateY(100%);
        transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', 'Segoe UI', sans-serif;
    }
    #chaovn-overlay.chaovn-show #chaovn-sheet {
        transform: translateY(0);
    }
    #chaovn-hero {
        background: linear-gradient(135deg, #FF6B35 0%, #f7941d 60%, #ffc55a 100%);
        padding: 20px 22px 30px;
        position: relative;
        overflow: hidden;
    }
    #chaovn-hero::before {
        content: '';
        position: absolute;
        width: 220px; height: 220px;
        border-radius: 50%;
        background: rgba(255,255,255,0.07);
        top: -70px; right: -50px;
    }
    #chaovn-hero::after {
        content: '';
        position: absolute;
        width: 140px; height: 140px;
        border-radius: 50%;
        background: rgba(255,255,255,0.05);
        bottom: -40px; left: -20px;
    }
    .chaovn-handle {
        width: 36px; height: 4px;
        background: rgba(255,255,255,0.4);
        border-radius: 2px;
        margin: 0 auto 18px;
    }
    #chaovn-close {
        position: absolute;
        top: 14px; right: 14px;
        width: 30px; height: 30px;
        border-radius: 50%;
        background: rgba(255,255,255,0.25);
        border: none; color: #fff;
        font-size: 16px; line-height: 30px;
        text-align: center;
        cursor: pointer;
        z-index: 2;
        transition: background 0.2s;
    }
    #chaovn-close:hover { background: rgba(255,255,255,0.4); }
    .chaovn-app-row {
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
        z-index: 2;
    }
    .chaovn-icon {
        width: 68px; height: 68px;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 6px 20px rgba(0,0,0,0.22);
        flex-shrink: 0;
        background: #fff;
    }
    .chaovn-icon img {
        width: 100%; height: 100%;
        object-fit: cover; display: block;
    }
    .chaovn-app-name {
        font-size: 21px; font-weight: 900;
        color: #fff; letter-spacing: -0.4px;
    }
    .chaovn-app-sub {
        font-size: 12px; color: rgba(255,255,255,0.82);
        margin-top: 3px;
    }
    .chaovn-stars {
        margin-top: 5px;
        font-size: 13px; color: #FFD700;
        display: flex; align-items: center; gap: 1px;
    }
    .chaovn-stars span { font-size: 11px; color: rgba(255,255,255,0.75); margin-left: 5px; }
    #chaovn-body { padding: 22px 20px 18px; }
    .chaovn-headline {
        font-size: 16px; font-weight: 800;
        color: #111; line-height: 1.45;
        letter-spacing: -0.3px; margin-bottom: 5px;
    }
    .chaovn-subtext {
        font-size: 13px; color: #666; line-height: 1.6; margin-bottom: 18px;
    }
    .chaovn-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px; margin-bottom: 0;
    }
    .chaovn-card {
        background: #fafafa;
        border: 1px solid #f0f0f0;
        border-radius: 13px;
        padding: 11px 12px;
        display: flex; align-items: center; gap: 9px;
    }
    .chaovn-card-icon {
        width: 34px; height: 34px;
        border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        font-size: 17px; flex-shrink: 0;
    }
    .chaovn-ic-news   { background: #fff4ee; }
    .chaovn-ic-market { background: #fff0f0; }
    .chaovn-ic-job    { background: #eef4ff; }
    .chaovn-ic-home   { background: #f0fff4; }
    .chaovn-card-name { font-size: 12px; font-weight: 700; color: #222; }
    .chaovn-card-desc { font-size: 10px; color: #999; margin-top: 1px; }
    #chaovn-footer { padding: 16px 20px 34px; }
    #chaovn-install-btn {
        display: flex;
        align-items: center; justify-content: center;
        gap: 10px;
        width: 100%; padding: 17px 20px;
        background: linear-gradient(135deg, #FF6B35 0%, #f7941d 100%);
        border: none; border-radius: 15px;
        color: #fff; font-size: 17px; font-weight: 800;
        letter-spacing: -0.2px;
        cursor: pointer; text-decoration: none;
        box-shadow: 0 6px 18px rgba(255,107,53,0.42);
        transition: transform 0.15s, box-shadow 0.15s;
        margin-bottom: 11px;
    }
    #chaovn-install-btn:hover  { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255,107,53,0.5); }
    #chaovn-install-btn:active { transform: scale(0.98); }
    #chaovn-skip {
        display: block; width: 100%;
        text-align: center; color: #bbb;
        font-size: 13px; padding: 6px;
        cursor: pointer; background: none; border: none;
        transition: color 0.2s;
    }
    #chaovn-skip:hover { color: #888; }
    </style>

    <div id="chaovn-overlay" onclick="chaovnHandleOverlay(event)">
        <div id="chaovn-sheet">

            <div id="chaovn-hero">
                <div class="chaovn-handle"></div>
                <button id="chaovn-close" onclick="chaovnClose()" aria-label="닫기">✕</button>
                <div class="chaovn-app-row">
                    <div class="chaovn-icon">
                        <img src="<?php echo esc_url($site_icon_url); ?>" alt="씬짜오베트남"
                             onerror="this.parentElement.style.background='#FF6B35';this.remove();">
                    </div>
                    <div>
                        <div class="chaovn-app-name">씬짜오베트남</div>
                        <div class="chaovn-app-sub">재베트남 한인 종합 정보 앱</div>
                        <div class="chaovn-stars">★★★★★<span>5.0 · 무료</span></div>
                    </div>
                </div>
            </div>

            <div id="chaovn-body">
                <p class="chaovn-headline">씬짜오베트남 앱으로 보시면<br>더욱 편리합니다</p>
                <p class="chaovn-subtext">씬짜오베트남에서 제공하는 모든 서비스를<br>한곳에서 즐길 수 있습니다.</p>
                <div class="chaovn-grid">
                    <div class="chaovn-card">
                        <div class="chaovn-card-icon chaovn-ic-news">📰</div>
                        <div><div class="chaovn-card-name">오늘의 뉴스</div><div class="chaovn-card-desc">매일 아침 베트남 뉴스</div></div>
                    </div>
                    <div class="chaovn-card">
                        <div class="chaovn-card-icon chaovn-ic-market">🛍️</div>
                        <div><div class="chaovn-card-name">당근마켓</div><div class="chaovn-card-desc">한인 중고거래 커뮤니티</div></div>
                    </div>
                    <div class="chaovn-card">
                        <div class="chaovn-card-icon chaovn-ic-job">💼</div>
                        <div><div class="chaovn-card-name">구인구직</div><div class="chaovn-card-desc">베트남 취업 정보</div></div>
                    </div>
                    <div class="chaovn-card">
                        <div class="chaovn-card-icon chaovn-ic-home">🏠</div>
                        <div><div class="chaovn-card-name">부동산</div><div class="chaovn-card-desc">현지 부동산 매물</div></div>
                    </div>
                </div>
            </div>

            <div id="chaovn-footer">
                <a id="chaovn-install-btn" href="#" onclick="chaovnInstall(event)">
                    <span style="font-size:22px;">📲</span>
                    <span>앱 설치하기</span>
                </a>
                <button id="chaovn-skip" onclick="chaovnClose()">괜찮아요, 웹에서 계속 볼게요</button>
            </div>

        </div>
    </div>

    <script>
    (function () {
        var ua = navigator.userAgent || '';
        var isIOS     = /iPhone|iPad|iPod/i.test(ua);
        var isAndroid = /Android/i.test(ua);

        // 모바일이 아니면 팝업 자체를 표시하지 않음
        if (!isIOS && !isAndroid) return;

        var storeUrl  = isIOS
            ? '<?php echo esc_js($app_store_url); ?>'
            : '<?php echo esc_js($play_store_url); ?>';

        // 앱 열기 시도 (즉시)
        function tryOpenApp() {
            if (isAndroid) {
                // intent:// 방식: 앱 있으면 앱으로, 없으면 아무 일도 없음 (다이얼로그 없이)
                window.location.href = 'intent://<?php echo esc_js(CHAOVN_NEWS_TERMINAL_SLUG); ?>#Intent;scheme=chaovietnam;package=<?php echo esc_js(CHAOVN_ANDROID_PACKAGE); ?>;S.browser_fallback_url=' + encodeURIComponent(window.location.href) + ';end';
            } else {
                // iOS: Universal Links 설정 시 이 라인 자체 없어도 앱이 열림
                window.location.href = '<?php echo esc_js($app_scheme); ?>';
            }
        }

        // 팝업 열기
        function openPopup() {
            var el = document.getElementById('chaovn-overlay');
            if (el) el.classList.add('chaovn-show');
        }

        // 앱 열기 시도 → 1.5초 후 앱이 열리지 않았으면 팝업 표시
        document.addEventListener('DOMContentLoaded', function () {
            tryOpenApp();
            setTimeout(function () {
                if (!document.hidden) openPopup();
            }, 1500);
        });
    })();

    function chaovnClose() {
        var el = document.getElementById('chaovn-overlay');
        if (el) el.classList.remove('chaovn-show');
    }

    function chaovnHandleOverlay(e) {
        if (e.target === document.getElementById('chaovn-overlay')) chaovnClose();
    }

    function chaovnInstall(e) {
        e.preventDefault();
        var ua = navigator.userAgent || '';
        var url = /iPhone|iPad|iPod/i.test(ua)
            ? '<?php echo esc_js($app_store_url); ?>'
            : '<?php echo esc_js($play_store_url); ?>';
        chaovnClose();
        window.location.href = url;
    }
    </script>
    <!-- /ChaoVN 앱 설치 유도 팝업 -->
    <?php
});

// ============================================================
// 6. 공유 페이지 렌더링 (danggn / job / realestate)
// ============================================================
function chaovn_render_share_page($type, $id)
{
    $type_info = [
        'danggn'     => ['title' => '당근마켓/나눔', 'icon' => '🛍️', 'color' => '#FF6B35'],
        'job'        => ['title' => '구인구직',       'icon' => '💼', 'color' => '#2196F3'],
        'realestate' => ['title' => '부동산',         'icon' => '🏠', 'color' => '#E91E63'],
    ];

    $info         = $type_info[$type] ?? $type_info['danggn'];
    $title        = $info['title'];
    $color        = $info['color'];
    $description  = $info['icon'] . ' ' . $title . ' 정보를 씬짜오베트남 앱에서 확인하세요!';
    $app_scheme   = 'chaovietnam://' . $type . '/' . $id;
    $android_pkg  = CHAOVN_ANDROID_PACKAGE;
    $play_url     = CHAOVN_PLAY_STORE_URL;
    $appstore_url = CHAOVN_APP_STORE_URL;
    $page_url     = get_site_url() . '/app/share/' . $type . '/' . $id;
    ?>
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><?php echo esc_html($title); ?> — 씬짜오베트남</title>
        <meta property="og:type"        content="website">
        <meta property="og:url"         content="<?php echo esc_url($page_url); ?>">
        <meta property="og:title"       content="<?php echo esc_attr($title); ?> — 씬짜오베트남">
        <meta property="og:description" content="<?php echo esc_attr($description); ?>">
        <meta property="og:site_name"   content="씬짜오베트남">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: <?php echo $color; ?>10;
                min-height: 100vh;
                display: flex; align-items: center; justify-content: center;
                padding: 20px;
            }
            .wrap {
                max-width: 420px; width: 100%;
                background: #fff; border-radius: 24px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.1);
                padding: 40px 28px; text-align: center;
            }
            .icon { font-size: 72px; margin-bottom: 16px; }
            h1 { font-size: 26px; color: #222; margin-bottom: 8px; }
            .sub { font-size: 17px; font-weight: 600; color: <?php echo $color; ?>; margin-bottom: 24px; }
            .msg { font-size: 15px; color: #666; line-height: 1.6; margin-bottom: 28px; }
            .spinner {
                width: 40px; height: 40px; border: 3px solid #eee;
                border-top-color: <?php echo $color; ?>;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 16px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            #install-section { display:none; margin-top: 20px; }
            .install-btn {
                display: block; width: 100%; padding: 15px;
                background: <?php echo $color; ?>; color: #fff;
                border: none; border-radius: 12px;
                font-size: 16px; font-weight: 700;
                cursor: pointer; text-decoration: none;
                box-shadow: 0 4px 14px <?php echo $color; ?>55;
                margin-bottom: 10px;
            }
            .web-btn {
                display: block; width: 100%; padding: 13px;
                background: #f5f5f5; color: #666;
                border: none; border-radius: 12px;
                font-size: 14px; cursor: pointer; text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="wrap">
            <div class="icon"><?php echo $info['icon']; ?></div>
            <h1>씬짜오베트남</h1>
            <div class="sub"><?php echo esc_html($title); ?></div>
            <div class="spinner" id="spinner"></div>
            <p class="msg" id="msg">앱을 여는 중입니다...</p>
            <div id="install-section">
                <p style="color:#999;font-size:13px;margin-bottom:16px;">앱이 설치되어 있지 않나요?</p>
                <a class="install-btn" id="install-btn" href="#">📲 앱 설치하기</a>
                <a class="web-btn" href="https://chaovietnam.co.kr">웹사이트로 이동</a>
            </div>
        </div>
        <script>
        (function(){
            var ua = navigator.userAgent || '';
            var isIOS     = /iPhone|iPad|iPod/i.test(ua);
            var isAndroid = /Android/i.test(ua);
            var storeUrl  = isIOS ? '<?php echo esc_js($appstore_url); ?>' : '<?php echo esc_js($play_url); ?>';

            document.getElementById('install-btn').href = storeUrl;

            function openApp() {
                if (isAndroid) {
                    var intent = '<?php echo esc_js($app_scheme); ?>'.replace('chaovietnam://', 'intent://');
                    intent += '#Intent;scheme=chaovietnam;package=<?php echo esc_js($android_pkg); ?>;S.browser_fallback_url=' + encodeURIComponent(window.location.href) + ';end';
                    window.location.href = intent;
                } else {
                    window.location.href = '<?php echo esc_js($app_scheme); ?>';
                }
            }

            // 페이지 HTML 파싱 즉시 앱 열기 시도 (이미지/CSS 기다리지 않음)
            document.addEventListener('DOMContentLoaded', function(){
                openApp();
                setTimeout(function(){
                    if (!document.hidden) {
                        document.getElementById('spinner').style.display = 'none';
                        document.getElementById('msg').textContent = '앱이 설치되어 있지 않은 것 같습니다.';
                        document.getElementById('install-section').style.display = 'block';
                    }
                }, 1500);
            });
        })();
        </script>
    </body>
    </html>
    <?php
}

// ============================================================
// 7. 플러그인 활성화 / 비활성화 시 Rewrite Rules 갱신
// ============================================================
register_activation_hook(__FILE__,   function () { flush_rewrite_rules(); });
register_deactivation_hook(__FILE__, function () { flush_rewrite_rules(); });
