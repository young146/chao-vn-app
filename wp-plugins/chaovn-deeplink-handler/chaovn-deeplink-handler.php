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

        var alreadyFailed = new URLSearchParams(window.location.search).has('noapp');

        // 앱 열기 시도 (즉시) — noapp 파라미터가 있으면 건너뜀 (무한 루프 방지)
        function tryOpenApp() {
            if (alreadyFailed) return;
            if (isAndroid) {
                var fallback = window.location.href + (window.location.search ? '&' : '?') + 'noapp=1';
                window.location.href = 'intent://<?php echo esc_js(CHAOVN_NEWS_TERMINAL_SLUG); ?>#Intent;scheme=chaovietnam;package=<?php echo esc_js(CHAOVN_ANDROID_PACKAGE); ?>;S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end';
            } else {
                window.location.href = '<?php echo esc_js($app_scheme); ?>';
            }
        }

        // 팝업 열기 (이미 거절한 경우 표시하지 않음)
        function openPopup() {
            if (sessionStorage.getItem('chaovn_popup_dismissed')) return;
            var el = document.getElementById('chaovn-overlay');
            if (el) el.classList.add('chaovn-show');
        }

        // 앱 열기 시도 → 1.5초 후 앱이 열리지 않았으면 팝업 표시
        document.addEventListener('DOMContentLoaded', function () {
            tryOpenApp();
            setTimeout(function () {
                if (!document.hidden) openPopup();
            }, alreadyFailed ? 500 : 1500);
        });
    })();

    function chaovnClose() {
        var el = document.getElementById('chaovn-overlay');
        if (el) el.classList.remove('chaovn-show');
        try { sessionStorage.setItem('chaovn_popup_dismissed', '1'); } catch(e) {}
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
            var alreadyFailed = new URLSearchParams(window.location.search).has('noapp');

            function openApp() {
                if (alreadyFailed) return;
                if (isAndroid) {
                    var fallback = window.location.href + (window.location.search ? '&' : '?') + 'noapp=1';
                    var intent = '<?php echo esc_js($app_scheme); ?>'.replace('chaovietnam://', 'intent://');
                    intent += '#Intent;scheme=chaovietnam;package=<?php echo esc_js($android_pkg); ?>;S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end';
                    window.location.href = intent;
                } else {
                    window.location.href = '<?php echo esc_js($app_scheme); ?>';
                }
            }

            document.addEventListener('DOMContentLoaded', function(){
                openApp();
                setTimeout(function(){
                    if (!document.hidden) {
                        document.getElementById('spinner').style.display = 'none';
                        document.getElementById('msg').textContent = '앱이 설치되어 있지 않은 것 같습니다.';
                        document.getElementById('install-section').style.display = 'block';
                    }
                }, alreadyFailed ? 500 : 1500);
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


// ============================================================
// 8. 앱으로 보기 버튼 & QR 모달
//    - 숏코드: [chaovn_app_button]
//    - 플로팅:  wp_footer 훅으로 모든 페이지에 자동 삽입
// ============================================================

/**
 * 버튼 + 모달 HTML/CSS/JS 출력
 * $args['qr_url']   : QR 코드에 담을 URL (기본: go/app 페이지)
 * $args['floating'] : true 이면 fixed 포지션 플로팅 버튼
 */
function chaovn_app_button_html(array $args = []): string {
    $qr_url  = esc_url($args['qr_url']  ?? 'https://chaovietnam-login.web.app/go/app');
    $floating = !empty($args['floating']);
    $uid     = 'cav' . substr(md5($qr_url . $floating), 0, 6); // 페이지에 여러 개 써도 충돌 없게

    $qr_img = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=' . rawurlencode($qr_url);

    $ios_url     = CHAOVN_APP_STORE_URL;
    $android_url = CHAOVN_PLAY_STORE_URL;

    // 플로팅 버튼 래퍼 스타일
    $wrapper_style = $floating
        ? 'position:fixed;bottom:24px;right:24px;z-index:99990;'
        : 'display:inline-block;';

    ob_start(); ?>
<div id="<?php echo $uid; ?>-wrap" style="<?php echo $wrapper_style; ?>">

  <!-- 버튼 -->
  <button
    id="<?php echo $uid; ?>-btn"
    onclick="document.getElementById('<?php echo $uid; ?>-overlay').style.display='flex';"
    style="display:inline-flex;align-items:center;gap:10px;padding:10px 20px;
           background:linear-gradient(135deg,#f97316 0%,#ea580c 60%,#c2410c 100%);
           color:#fff;font-size:15px;font-weight:800;border:none;border-radius:100px;
           cursor:pointer;box-shadow:0 8px 24px rgba(234,88,12,.45);
           outline:4px solid rgba(249,115,22,.25);letter-spacing:-.3px;
           transition:transform .15s,box-shadow .15s;"
    onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 32px rgba(234,88,12,.6)';"
    onmouseout="this.style.transform='';this.style.boxShadow='0 8px 24px rgba(234,88,12,.45)';"
    onmousedown="this.style.transform='scale(.96)';"
    onmouseup="this.style.transform='';"
  >
    <span style="display:flex;align-items:center;justify-content:center;
                 width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17 2H7C5.9 2 5 2.9 5 4v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5-4H7V4h10v12z"/>
      </svg>
    </span>
    앱으로 보기
    <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12v.01M12 4h.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z"/>
    </svg>
  </button>

  <!-- 오버레이 + 모달 -->
  <div id="<?php echo $uid; ?>-overlay"
    style="display:none;position:fixed;inset:0;z-index:99999;
           background:rgba(0,0,0,.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
           align-items:center;justify-content:center;padding:16px;"
    onclick="if(event.target===this)this.style.display='none';"
  >
    <!-- 모달 카드: overflow:hidden + 전체 rounded — React 버전과 동일 구조 -->
    <div style="background:#fff;border-radius:24px;width:100%;max-width:320px;
                overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.35);
                animation:chaovnPop .25s cubic-bezier(.34,1.56,.64,1);">

      <!-- 오렌지 헤더 (하단 pb를 넉넉히 줘서 QR 카드가 자연스럽게 겹치도록) -->
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);
                  padding:28px 20px 40px;text-align:center;position:relative;">
        <button
          onclick="document.getElementById('<?php echo $uid; ?>-overlay').style.display='none';"
          style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,.25);
                 border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;
                 color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;"
        >✕</button>
        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.2);margin-bottom:10px;">
          <svg width="26" height="26" fill="#fff" viewBox="0 0 24 24">
            <path d="M17 2H7C5.9 2 5 2.9 5 4v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5-4H7V4h10v12z"/>
          </svg>
        </div>
        <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:4px;">씬짜오베트남 앱</div>
        <div style="font-size:12px;color:rgba(255,255,255,.8);">QR 코드를 스캔해 앱을 설치하세요</div>
      </div>

      <!-- QR 코드 (헤더와 겹치게 — position:relative+z-index로 헤더 위에 확실히 표시) -->
      <div style="margin-top:-28px;display:flex;justify-content:center;
                  position:relative;z-index:1;">
        <div style="background:#fff;border-radius:16px;padding:12px;
                    box-shadow:0 8px 28px rgba(0,0,0,.15);border:1px solid #f1f5f9;
                    position:relative;display:inline-block;">
          <img src="<?php echo esc_url($qr_img); ?>"
               width="156" height="156" alt="앱 QR코드"
               style="display:block;border-radius:6px;">
          <!-- 로고 중앙 오버레이 (React의 imageSettings 동일 효과) -->
          <img src="https://vnkorlife.com/logo.png"
               width="30" height="30" alt=""
               style="position:absolute;top:50%;left:50%;
                      transform:translate(-50%,-50%);
                      border-radius:6px;
                      box-shadow:0 1px 4px rgba(0,0,0,.2);">
        </div>
      </div>

      <!-- 안내 + 스토어 버튼 -->
      <div style="padding:16px 20px 20px;text-align:center;">
        <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;">스마트폰 카메라로 스캔하세요</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:16px;">iOS · Android 자동 감지</div>
        <div style="display:flex;gap:8px;">
          <a href="<?php echo esc_url($ios_url); ?>" target="_blank" rel="noopener"
             style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;
                    background:#000;color:#fff;border-radius:12px;padding:10px 8px;
                    font-size:12px;font-weight:700;text-decoration:none;">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            App Store
          </a>
          <a href="<?php echo esc_url($android_url); ?>" target="_blank" rel="noopener"
             style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;
                    background:#1e293b;color:#fff;border-radius:12px;padding:10px 8px;
                    font-size:12px;font-weight:700;text-decoration:none;">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3.18 23.76a1 1 0 01-1-1V1.24a1 1 0 011.49-.87l19.64 10.76a1 1 0 010 1.74L3.67 23.63a1 1 0 01-.49.13z"/>
            </svg>
            Google Play
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes chaovnPop {
    from { opacity:0; transform:scale(.88) translateY(16px); }
    to   { opacity:1; transform:scale(1)  translateY(0); }
  }
</style>
<?php
    return ob_get_clean();
}

// ─── 숏코드 등록 ───────────────────────────────────────────
// 사용법:
//   [chaovn_app_button]                               → 일반 앱 다운로드
//   [chaovn_app_button type="danggn" id="ITEM_ID"]   → 특정 게시물 딥링크
add_shortcode('chaovn_app_button', function ($atts) {
    $atts = shortcode_atts(['type' => '', 'id' => ''], $atts);

    $qr_url = 'https://chaovietnam-login.web.app/go/app';
    if (!empty($atts['type']) && !empty($atts['id'])) {
        $qr_url .= '?type=' . urlencode($atts['type']) . '&id=' . urlencode($atts['id']);
    }

    return chaovn_app_button_html(['qr_url' => $qr_url]);
});

// ─── 모든 페이지 우측 하단 플로팅 버튼 ─────────────────────
add_action('wp_footer', function () {
    echo chaovn_app_button_html(['floating' => true]);
});
