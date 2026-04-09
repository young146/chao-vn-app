<?php
/**
 * Plugin Name: ChaoVN Firebase Auth
 * Plugin URI: https://chaovietnam.co.kr
 * Description: Firebase ID Token을 이용해 워드프레스 사용자 동기화 및 자동 로그인을 수행하는 SSO(Single Sign-On) 연동 플러그인. 사용자 로그인 폼을 보여주기 위한 [chaovn_firebase_login] 쇼트코드를 제공합니다.
 * Version: 1.0.0
 * Author: Chao Vietnam Team
 * License: GPL v2 or later
 * Text Domain: chaovn-firebase-auth
 */

if (!defined('ABSPATH')) {
    exit;
}

// 1. 필요한 클래스 및 스크립트 파일 로드
require_once plugin_dir_path(__FILE__) . 'includes/class-firebase-token-verifier.php';

// Javascript와 스타일 Enqueue 설정
add_action('wp_enqueue_scripts', 'chaovn_firebase_auth_enqueue_scripts');
function chaovn_firebase_auth_enqueue_scripts()
{
    global $post;

    // has_shortcode()는 Gutenberg/페이지빌더에서 쇼트코드를 감지 못하는 버그가 있음.
    // 대신 페이지 슬러그(total_login)이거나 post 컨텐츠에 쇼트코드가 있는 경우 모두 로드.
    $should_load = false;

    if (is_a($post, 'WP_Post')) {
        // 방법 1: 페이지 슬러그 직접 체크
        if ($post->post_name === 'total_login' || $post->post_name === 'login') {
            $should_load = true;
        }
        // 방법 2: 컨텐츠에 쇼트코드 문자가 있는지 원시 검색 (has_shortcode 보완)
        if (strpos($post->post_content, 'chaovn_firebase_login') !== false) {
            $should_load = true;
        }
    }

    if ($should_load) {
        // Firebase Auth v9 compat 방식
        wp_enqueue_script('firebase-app-compat', 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js', array(), '10.9.0', true);
        wp_enqueue_script('firebase-auth-compat', 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth-compat.js', array('firebase-app-compat'), '10.9.0', true);

        // 카카오 JS SDK (v1.43.1: Auth.login 팝업 지원)
        wp_enqueue_script('kakao-js-sdk', 'https://t1.kakaocdn.net/kakao_js_sdk/1.43.1/kakao.min.js', array(), '1.43.1', true);

        // 커스텀 JS 파일 (time()으로 강제 캐시 무효화)
        wp_enqueue_script(
            'chaovn-firebase-auth-js',
            plugin_dir_url(__FILE__) . 'assets/js/firebase-auth.js',
            array('jquery', 'firebase-auth-compat', 'kakao-js-sdk'),
            time(),
            true
        );

        // WP-API URL 및 Nonce를 JS로 전달
        wp_localize_script('chaovn-firebase-auth-js', 'chaovnAuth', array(
            'restUrl' => rest_url('chaovn-auth/v1/verify'),
            'nonce' => wp_create_nonce('wp_rest'),
            'redirect' => home_url(),
        ));
    }
}

// 2. 쇼트코드 등록
add_shortcode('chaovn_firebase_login', 'chaovn_firebase_login_shortcode');
function chaovn_firebase_login_shortcode()
{
    // 이미 로그인한 사용자인 경우
    if (is_user_logged_in()) {
        $current_user = wp_get_current_user();
        return '<div class="chaovn-auth-msg">이미 ' . esc_html($current_user->display_name) . '님으로 로그인되어 있습니다. <a href="' . wp_logout_url(home_url()) . '">로그아웃</a></div>';
    }

    // REST API 정보를 인라인 스크립트에 전달
    $rest_url = rest_url('chaovn-auth/v1/verify');
    $nonce = wp_create_nonce('wp_rest');
    $redirect = home_url();

    // 로그인 폼(UI) + 인라인 스크립트 렌더링
    ob_start();
    ?>
    <div id="chaovn-firebase-login-container"
        style="max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h3 style="text-align: center;">로그인</h3>

        <div id="chaovn-auth-error" style="color: red; margin-bottom: 10px; display: none;"></div>

        <div style="margin-bottom: 15px;">
            <label>이메일</label>
            <input type="email" id="chaovn-email" style="width: 100%; padding: 10px;" placeholder="이메일을 입력하세요">
        </div>
        <div style="margin-bottom: 15px;">
            <label>비밀번호</label>
            <input type="password" id="chaovn-password" style="width: 100%; padding: 10px;" placeholder="비밀번호를 입력하세요">
        </div>

        <button id="chaovn-login-btn"
            style="width: 100%; padding: 12px; background-color: #FF6B35; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
            이메일로 로그인
        </button>

        <div style="text-align: center; margin-top: 10px;">
            <a href="#" id="chaovn-toggle-mode" style="color: #666; text-decoration: underline; font-size: 14px;">계정이 없으신가요? 회원가입</a>
        </div>

        <div style="text-align: center; margin: 20px 0;">또는 소셜 로그인</div>

        <button id="chaovn-google-login-btn"
            style="width: 100%; padding: 12px; margin-bottom: 10px; background-color: #4285F4; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
            Google로 로그인
        </button>
        
        <button id="chaovn-kakao-login-btn"
            style="width: 100%; padding: 12px; margin-bottom: 10px; background-color: #FEE500; color: #000000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
            카카오로 로그인
        </button>

        <button id="chaovn-apple-login-btn"
            style="width: 100%; padding: 12px; background-color: #000000; color: #ffffff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
            Apple로 로그인
        </button>

        <div id="chaovn-auth-loading" style="display: none; text-align: center; margin-top: 15px;">
            로그인 처리 중입니다. 잠시만 기다려주세요...
        </div>
    </div>


    <?php
    return ob_get_clean();
}

// 3. REST API 엔드포인트 세팅 (토큰 수신 및 검증)
add_action('rest_api_init', function () {
    register_rest_route('chaovn-auth/v1', '/verify', array(
        'methods' => 'POST',
        'callback' => 'chaovn_verify_firebase_token',
        'permission_callback' => '__return_true', // CORS 및 누구나 접근 가능 (내부 검증 로직으로 필터링)
    ));
});

// 4. REST API 콜백: 워드프레스 사용자 매칭 및 세션 생성
function chaovn_verify_firebase_token(WP_REST_Request $request)
{
    $token = $request->get_param('token');

    if (empty($token)) {
        return new WP_REST_Response(array('success' => false, 'message' => 'Token이 제공되지 않았습니다.'), 400);
    }

    // Token 검증 클래스 인스턴스화
    $verifier = new ChaoVN_Firebase_Token_Verifier('chaovietnam-login'); // Firebase Config의 projectId 입력

    // JWT를 해석하고 공개 키로 무결성(Signature)을 검증
    $payload = $verifier->verify_id_token($token);

    if (is_wp_error($payload)) {
        return new WP_REST_Response(array('success' => false, 'message' => $payload->get_error_message()), 401);
    }

    // 여기까지 도달하면 $payload에는 Firebase가 인증한 안전한 사용자 정보가 들어 있습니다.
    $firebase_uid = $payload['sub'];
    $email = isset($payload['email']) ? $payload['email'] : '';
    $name = isset($payload['name']) ? $payload['name'] : 'Chaovn User';

    // 프론트엔드 카카오 로그인에서 실제 이름/이메일을 별도로 넘긴 경우 오버라이드
    $kakao_email = $request->get_param('kakao_email');
    $kakao_name = $request->get_param('kakao_name');
    if (!empty($kakao_email)) {
        $email = $kakao_email;
    }
    if (!empty($kakao_name)) {
        $name = $kakao_name;
    }

    // 이미 연동된 사용자인지 uid로 확인 (User Meta 'firebase_uid')
    $users = get_users(array(
        'meta_key' => 'firebase_uid',
        'meta_value' => $firebase_uid,
        'number' => 1,
    ));

    $wp_user = null;

    if (!empty($users)) {
        // 이미 연동된 회원 존재
        $wp_user = $users[0];
        
        // 기존 카카오 유저의 닉네임과 이메일을 업데이트
        $user_data_to_update = array('ID' => $wp_user->ID);
        $needs_update = false;

        // 카카오 닉네임이 있으면 항상 업데이트 (user_login에 kakao_ 있는 경우)
        if (!empty($kakao_name) && strpos($wp_user->user_login, 'kakao_') !== false) {
            $user_data_to_update['display_name'] = $kakao_name;
            $user_data_to_update['first_name'] = $kakao_name;
            $needs_update = true;
        }

        if (!empty($kakao_email) && strpos($wp_user->user_email, '@chaovietnam.co.kr') !== false) {
            if (!email_exists($kakao_email) || get_user_by('email', $kakao_email)->ID === $wp_user->ID) {
                $user_data_to_update['user_email'] = $kakao_email;
                $needs_update = true;
            }
        }

        if ($needs_update) {
            wp_update_user($user_data_to_update);
            $wp_user = get_userdata($wp_user->ID); // 업데이트 후 새로고침
        }
    } else {
        // UID로 검색 실패 시 이메일로 검색
        if (!empty($email)) {
            $wp_user = get_user_by('email', $email);
        }

        if ($wp_user) {
            // 이메일은 있지만 uid는 등록안된 기존회원 -> 메타 업데이트 병합
            update_user_meta($wp_user->ID, 'firebase_uid', $firebase_uid);
        } else {
            // 완전히 새로운 사용자 가입 처리
            $username = (!empty($email)) ? explode('@', $email)[0] : 'user_' . substr($firebase_uid, 0, 8);

            // 유저명 중복 체크 후 난수 생성
            if (username_exists($username)) {
                $username = $username . '_' . wp_generate_password(4, false);
            }

            $user_id = wp_insert_user(array(
                'user_login' => $username,
                'user_email' => $email,
                'user_pass' => wp_generate_password(24), // 강제로 임의 비밀번호 발급. (WP 비번으론 로그인 안함)
                'display_name' => $name,
                'first_name' => $name,
                'role' => 'subscriber' // 기본 권한: 구독자
            ));

            if (is_wp_error($user_id)) {
                return new WP_REST_Response(array('success' => false, 'message' => 'WP 계정 생성 실패.'), 500);
            }

            // firebase_uid 메타 저장
            update_user_meta($user_id, 'firebase_uid', $firebase_uid);
            $wp_user = get_userdata($user_id);
        }
    }

    // 5. 드디어 WP 강제 로그인 처리 (워드프레스 쿠키 설정)
    if ($wp_user) {
        // 기존 세션 지우기
        wp_clear_auth_cookie();
        // 로그인 처리
        wp_set_current_user($wp_user->ID);
        wp_set_auth_cookie($wp_user->ID, true); // true = remember me

        // 워드프레스 기본 훅 트리거
        do_action('wp_login', $wp_user->user_login, $wp_user);

        return new WP_REST_Response(array(
            'success' => true,
            'message' => '로그인 성공',
            'user' => array(
                'id' => $wp_user->ID,
                'email' => $wp_user->user_email,
                'name' => $wp_user->display_name,
            )
        ), 200);
    }

    return new WP_REST_Response(array('success' => false, 'message' => '알 수 없는 에러.'), 500);
}

// 6. 워드프레스 기본 로그인/로그아웃 화면 가로채기 (Redirect)
add_action('init', 'chaovn_firebase_redirect_wp_login');
function chaovn_firebase_redirect_wp_login()
{
    global $pagenow;

    // 현재 페이지가 wp-login.php 이고 로그아웃/비밀번호찾기 등 다른 액션이 아닐 때
    $action = isset($_GET['action']) ? $_GET['action'] : '';

    // '?native=1' 파라미터가 있으면 기존 WP 관리자용 로그인 화면 허용 (관리자 비상용)
    if ($pagenow == 'wp-login.php' && empty($action) && !isset($_GET['native'])) {
        // ★ 통합 로그인 페이지 주소(슬러그)를 아래에 맞게 수정해 주세요. 예: /login/, /home/통합-로그인/ 등
        $custom_login_url = home_url('/total_login/');
        wp_redirect($custom_login_url);
        exit();
    }
}

add_action('wp_logout', 'chaovn_firebase_redirect_after_logout');
function chaovn_firebase_redirect_after_logout()
{
    // 로그아웃 완료 후 홈 화면(또는 통합 로그인 화면)으로 보냅니다.
    wp_redirect(home_url()); // 로그인 창으로 바로 보내시려면 home_url('/login/') 처럼 변경하세요.
    exit();
}

// 8. 모든 페이지 푸터에 로그인 상태 플로팅 배지 출력
add_action('wp_footer', 'chaovn_floating_user_badge');
function chaovn_floating_user_badge() {
    if (!is_user_logged_in()) return;

    $current_user = wp_get_current_user();
    $display_name = esc_html($current_user->display_name);
    $user_email   = esc_html($current_user->user_email);
    $initial      = mb_strtoupper(mb_substr($display_name, 0, 1));
    $logout_url   = wp_logout_url(home_url());

    echo '
    <div id="chaovn-user-badge" style="
        position: fixed;
        top: 70px;
        right: 15px;
        z-index: 9999;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.13);
        padding: 12px 16px;
        min-width: 190px;
        font-family: sans-serif;
        cursor: pointer;
    ">
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="
                width:38px; height:38px; border-radius:50%;
                background:#FF6B35; color:#fff;
                display:flex; align-items:center; justify-content:center;
                font-size:18px; font-weight:bold; flex-shrink:0;
            ">' . $initial . '</div>
            <div style="overflow:hidden;">
                <div style="font-weight:700; font-size:14px; color:#222; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' . $display_name . '</div>
                <div style="font-size:11px; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' . $user_email . '</div>
            </div>
        </div>
        <a href="' . $logout_url . '" style="
            display:block; margin-top:10px; text-align:center;
            background:#FF6B35; color:#fff; text-decoration:none;
            border-radius:6px; padding:6px 0; font-size:13px; font-weight:600;
        ">로그아웃</a>
    </div>
    ';
}

// 7. 카카오 웹훅 수신 엔드포인트 (User Unlinked / 연결 해제)
// 카카오 개발자 콘솔에서 필수로 요구하는 웹훅 URL입니다.
// 등록할 URL: https://chaovietnam.co.kr/wp-json/chaovn-auth/v1/kakao-webhook
add_action('rest_api_init', function () {
    register_rest_route('chaovn-auth/v1', '/kakao-webhook', array(
        'methods' => 'POST',
        'callback' => 'chaovn_kakao_webhook_handler',
        'permission_callback' => '__return_true',
    ));
});

function chaovn_kakao_webhook_handler(WP_REST_Request $request) {
    // 카카오에서 보내는 웹훅 데이터 수신
    $body = $request->get_json_params();

    // 로그 기록 (디버깅용)
    error_log('[ChaoVN Kakao Webhook] Received: ' . json_encode($body));

    // User Unlinked 이벤트 처리
    if (isset($body['user_id'])) {
        $kakao_id = $body['user_id'];

        // 해당 카카오 사용자의 WP 계정에서 firebase_uid 메타 제거 (선택적)
        $kakao_email = 'kakao_' . $kakao_id . '@chaovietnam.co.kr';
        $wp_user = get_user_by('email', $kakao_email);

        if ($wp_user) {
            // 연결 해제된 사용자 기록
            update_user_meta($wp_user->ID, 'kakao_unlinked', current_time('mysql'));
            error_log('[ChaoVN Kakao Webhook] User unlinked: ' . $kakao_email);
        }
    }

    // 카카오 서버에 200 OK 응답 (필수)
    return new WP_REST_Response(array('status' => 'ok'), 200);
}
