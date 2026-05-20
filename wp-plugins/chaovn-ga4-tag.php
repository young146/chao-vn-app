<?php
/**
 * Plugin Name: ChaoVN GA4 Tag
 * Plugin URI: https://chaovietnam.co.kr
 * Description: chaovietnam.co.kr 전 페이지에 Firebase/GA4 측정 태그 (G-QTCWJ6GGH0) 자동 주입. 측정 인프라 Phase 2-1.
 * Version: 1.0.0
 * Author: ChaoVietnam
 * License: GPL v2 or later
 *
 * SOP: directives/MEASUREMENT_INFRA_SETUP.md (Phase 2-1)
 * 작성: 2026-05-20
 *
 * 동작:
 *   - wp_head 훅으로 <head> 태그 안에 gtag.js 비동기 로드 스크립트 삽입
 *   - 어드민 페이지(/wp-admin/), 프리뷰, 봇 트래픽은 제외
 *   - 같은 GA4 측정 ID 를 vnkorlife.com·앱과 공유 — hostname 으로 트래픽 구분
 */

if (!defined('ABSPATH'))
    exit;

define('CHAOVN_GA4_MEASUREMENT_ID', 'G-QTCWJ6GGH0');

// ============================================================
// GA4 gtag.js 주입
// ============================================================
add_action('wp_head', function () {
    // 어드민, 프리뷰, 로그인 안 한 봇은 제외
    if (is_admin() || is_preview()) {
        return;
    }

    $measurement_id = CHAOVN_GA4_MEASUREMENT_ID;
    ?>
<!-- Google tag (gtag.js) — ChaoVN GA4 Tag plugin -->
<script async src="https://www.googletagmanager.com/gtag/js?id=<?php echo esc_attr($measurement_id); ?>"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', '<?php echo esc_js($measurement_id); ?>', {
        // hostname 기반 디버그 — vnkorlife.com 과 chaovietnam.co.kr 트래픽 구분
        page_location: window.location.href,
        page_path: window.location.pathname
    });
</script>
<?php
}, 1); // priority 1 — 다른 스크립트보다 일찍 로드

// ============================================================
// 어드민 상태 페이지 (선택 사항) — 설정 상태 확인용
// ============================================================
add_action('admin_menu', function () {
    add_options_page(
        'ChaoVN GA4 상태',
        'ChaoVN GA4',
        'manage_options',
        'chaovn-ga4-status',
        function () {
            $measurement_id = CHAOVN_GA4_MEASUREMENT_ID;
            ?>
            <div class="wrap">
                <h1>ChaoVN GA4 Tag — 상태</h1>
                <table class="form-table">
                    <tr>
                        <th scope="row">측정 ID</th>
                        <td><code><?php echo esc_html($measurement_id); ?></code></td>
                    </tr>
                    <tr>
                        <th scope="row">주입 위치</th>
                        <td>모든 공개 페이지의 <code>&lt;head&gt;</code></td>
                    </tr>
                    <tr>
                        <th scope="row">검증 방법</th>
                        <td>
                            <ol>
                                <li>이 사이트의 공개 페이지를 열고 페이지 소스 보기에서 <code>G-QTCWJ6GGH0</code> 검색</li>
                                <li>GA4 콘솔 → 보고서 → 실시간 → 30초 안에 자기 자신이 카운트되는지 확인</li>
                                <li>GA4 콘솔에서 hostname 필터로 <code>chaovietnam.co.kr</code> 만 필터링</li>
                            </ol>
                        </td>
                    </tr>
                </table>
            </div>
            <?php
        }
    );
});
