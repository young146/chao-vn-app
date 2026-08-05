<?php
/**
 * Plugin Name: ChaoVN News Terminal REST API
 * Plugin URI: https://chaovietnam.co.kr
 * Description: Jenny Daily News 플러그인의 뉴스 데이터를 REST API로 제공합니다. Jenny 플러그인과 함께 사용해야 합니다.
 *              v2: 날짜별 Transient 캐시, 발행 시 자동 갱신, 날씨/환율 사전 캐시 추가
 * Version: 2.0.0
 * Author: Chao Vietnam Team
 * License: GPL v2 or later
 * Text Domain: chaovn-news-api
 *
 * 주의: 이 플러그인은 Jenny Daily News Display 플러그인이 활성화되어 있어야 작동합니다.
 * Jenny 플러그인을 전혀 수정하지 않고, REST API 엔드포인트만 추가합니다.
 */

if (!defined('ABSPATH')) {
    exit;
}

// ============================================================
// 캐시 설정
// ============================================================
define('CHAOVN_NEWS_CACHE_PREFIX', 'chaovn_news_terminal_');
define('CHAOVN_WEATHER_CACHE_KEY', 'chaovn_weather_data');
define('CHAOVN_RATES_CACHE_KEY',   'chaovn_exchange_rates');
define('CHAOVN_WEATHER_TTL',  2 * HOUR_IN_SECONDS);   // 날씨: 2시간
define('CHAOVN_RATES_TTL',    6 * HOUR_IN_SECONDS);   // 환율: 6시간
define('CHAOVN_NEWS_CAT_ID',  31);                     // 뉴스/데일리뉴스 카테고리 ID

/**
 * 섹션 하나에 채울 기사 수 = 대표카드 1 + 제목 리스트 7.
 *
 * 웹 뉴스터미널은 11(대표1+제목10)이다. 앱이 더 적은 이유: 웹은 PC 에서 대표카드 옆에
 * 제목이 2단으로 붙지만, 앱은 세로 한 줄뿐이라 10줄이면 섹션 하나가 화면을 다 먹는다.
 * (웹의 폰 화면도 같은 이유로 5줄만 보여준다.)
 */
define('CHAOVN_SECTION_TARGET', 8);

// ============================================================
// REST API 엔드포인트 등록
// ============================================================
add_action('rest_api_init', function () {

    // 뉴스 터미널 (오늘 날짜)
    register_rest_route('chaovn/v1', '/news-terminal', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_get_news_terminal',
        'permission_callback' => '__return_true',
    ));

    // 뉴스 터미널 (날짜 지정: YYYY-MM-DD)
    register_rest_route('chaovn/v1', '/news-terminal/(?P<date>\d{4}-\d{2}-\d{2})', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_get_news_terminal',
        'permission_callback' => '__return_true',
    ));

    // 날씨 + 환율 (사전 캐시)
    register_rest_route('chaovn/v1', '/external-data', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_get_external_data',
        'permission_callback' => '__return_true',
    ));

    // 관리자 전용: 특정 날짜 캐시 수동 갱신
    register_rest_route('chaovn/v1', '/news-terminal/rebuild', array(
        'methods'             => 'POST',
        'callback'            => 'chaovn_rebuild_news_cache_endpoint',
        'permission_callback' => function () { return current_user_can('manage_options'); },
    ));

    // 임시 디버그: 날짜별 포스트 DB 조회 현황
    register_rest_route('chaovn/v1', '/debug-posts', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_debug_posts',
        'permission_callback' => '__return_true',
    ));

    // 매거진 홈 (앱 "매거진" 탭) — 섹션 9개를 서버가 조립해서 한 번에 준다
    register_rest_route('chaovn/v1', '/magazine-home', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_get_magazine_home',
        'permission_callback' => '__return_true',
    ));

    // 한 호의 전체 기사 (앱 "이번 호 기사" 화면). number 를 안 주면 현재 호.
    register_rest_route('chaovn/v1', '/magazine-issue', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_get_magazine_issue',
        'permission_callback' => '__return_true',
    ));

    // 호 목록 (지난 호 아카이브용)
    register_rest_route('chaovn/v1', '/magazine-issues', array(
        'methods'             => 'GET',
        'callback'            => 'chaovn_get_magazine_issues',
        'permission_callback' => '__return_true',
    ));
});

/**
 * 한 호의 기사를 꼭지(카테고리)별로 묶어 돌려준다.
 *
 * 왜 꼭지별인가: 잡지 목차가 원래 그렇게 생겼다. 날짜순으로 죽 늘어놓으면
 * "기사 목록"이지 "목차"로 안 읽힌다.
 *
 * ⚠️ 완결성을 약속하지 않는다. 잡지에 실린 기사 중 웹에 올라온 것만 여기 나온다.
 * 그래서 앱도 '목차'가 아니라 '이번 호 기사'라고 부른다. 전 기사가 올라오면
 * 자연히 진짜 목차가 되고, 그때는 이름만 바꾸면 된다.
 */
function chaovn_get_magazine_issue($request) {
    $number = (int) $request->get_param('number');

    $term_id = 0;
    if ($number) {
        foreach (get_terms(array('taxonomy' => CHAOVN_ISSUE_TAX, 'hide_empty' => false)) as $t) {
            if ((int) get_term_meta($t->term_id, 'chaovn_issue_number', true) === $number) {
                $term_id = $t->term_id;
                break;
            }
        }
    } else {
        $term_id = (int) get_option(CHAOVN_CURRENT_ISSUE_OPT, 0);
    }

    if (!$term_id) {
        return new WP_REST_Response(array('success' => false, 'error' => '호를 찾을 수 없습니다.'), 404);
    }

    $issue = chaovn_get_issue_payload($term_id);
    if (!$issue) {
        return new WP_REST_Response(array('success' => false, 'error' => '호 정보를 읽을 수 없습니다.'), 404);
    }

    $q = new WP_Query(array(
        'post_type'      => 'post',
        'posts_per_page' => 100, // 한 호는 13~24편. 넉넉히.
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'ASC', // 목차는 실린 순서(먼저 올린 것부터)가 자연스럽다
        'no_found_rows'  => true,
        'tax_query'      => array(array(
            'taxonomy' => CHAOVN_ISSUE_TAX,
            'field'    => 'term_id',
            'terms'    => $term_id,
        )),
    ));

    // 꼭지별로 묶는다. 순서는 그 꼭지의 첫 기사가 나온 순서를 따른다.
    $groups = array();
    while ($q->have_posts()) {
        $q->the_post();
        $pid   = get_the_ID();
        $cats  = get_the_category($pid);
        $name  = !empty($cats) ? html_entity_decode($cats[0]->name, ENT_QUOTES, 'UTF-8') : '기타';
        $thumb = get_the_post_thumbnail_url($pid, 'medium_large');

        if (!isset($groups[$name])) $groups[$name] = array();
        $groups[$name][] = array(
            'postId'     => $pid,
            'title'      => array('rendered' => get_the_title($pid)),
            'date'       => get_the_date('c', $pid),
            'link'       => get_permalink($pid),
            'thumbnail'  => $thumb ? $thumb : '',
            'categories' => wp_get_post_categories($pid),
        );
    }
    wp_reset_postdata();

    $out = array();
    foreach ($groups as $name => $posts) {
        $out[] = array('section' => $name, 'posts' => $posts);
    }

    return new WP_REST_Response(array(
        'success' => true,
        'issue'   => $issue,
        'groups'  => $out,
        'total'   => array_sum(array_map(function ($g) { return count($g['posts']); }, $out)),
    ), 200);
}

/** 호 목록 (최신순). 지난 호 아카이브 화면용. */
function chaovn_get_magazine_issues($request) {
    $terms = get_terms(array('taxonomy' => CHAOVN_ISSUE_TAX, 'hide_empty' => false));
    if (is_wp_error($terms)) $terms = array();

    $list = array();
    foreach ($terms as $t) {
        $payload = chaovn_get_issue_payload($t->term_id);
        if ($payload && $payload['number']) $list[] = $payload;
    }
    usort($list, function ($a, $b) { return $b['number'] - $a['number']; });

    return new WP_REST_Response(array('success' => true, 'issues' => $list), 200);
}

// ============================================================
// 매거진 호(號) 체계
// ------------------------------------------------------------
// 왜 만드는가 (2026-08-06):
//   잡지인데 "몇 호"라는 개념이 데이터에 없었다(태그 0건/100건). 그래서 앱·웹은
//   "카테고리별 최신 4건"이라는 우회 표현만 했고, 매호 새로 생기는 꼭지는 반영되지 않았다.
//   호를 붙이면 "이번 호 목차"가 만들어지고, 새 꼭지가 나와도 코드 수정이 영원히 불필요하다.
//
// 설계 원칙 — 직원 작업을 늘리지 않는다:
//   1) 편집 담당이 호마다 딱 한 번 "이번 호"를 지정한다 (호수·발행일·표지).
//   2) 그 뒤 발행되는 글은 자동으로 그 호에 들어간다. 직원은 아무것도 안 해도 된다.
//   3) 발행 주기가 불규칙하므로(격주 기본, 3개월에 한 번은 3주) 날짜로 호를 계산하지 않는다.
//      계산식은 반드시 어긋난다. "지금 몇 호인가"는 사람이 정하고 시스템은 그것만 따른다.
// ============================================================
define('CHAOVN_ISSUE_TAX', 'mag_issue');
define('CHAOVN_CURRENT_ISSUE_OPT', 'chaovn_current_issue');

add_action('init', 'chaovn_register_issue_taxonomy');
function chaovn_register_issue_taxonomy() {
    register_taxonomy(CHAOVN_ISSUE_TAX, 'post', array(
        // 라벨을 다 채운다. 덜 채우면 글쓰기 화면 옆 상자에 "새 카테고리 이름" 같은
        // 워드프레스 기본 문구가 나와서 직원이 헷갈린다(2026-08-06 사장님 화면에서 확인).
        'labels' => array(
            'name'              => '매거진 호',
            'singular_name'     => '호',
            'menu_name'         => '매거진 호',
            'all_items'         => '모든 호',
            'add_new_item'      => '새 호 추가',
            'new_item_name'     => '새 호 이름 (예: 제565호)',
            'edit_item'         => '호 편집',
            'update_item'       => '호 저장',
            'view_item'         => '호 보기',
            'search_items'      => '호 검색',
            'not_found'         => '등록된 호가 없습니다.',
            'back_to_items'     => '← 호 목록으로',
            'parent_item'       => '상위 호',
            'parent_item_colon' => '상위 호:',
        ),
        // 계층형으로 두는 이유: 글 편집화면에 *체크박스*로 뜬다(태그처럼 직접 타이핑하면
        // '565호' / '제565호' 같은 오타가 반드시 생긴다). 실제 계층은 쓰지 않는다.
        'hierarchical'      => true,
        'public'            => true,
        'show_ui'           => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'rewrite'           => array('slug' => 'magazine-issue'),
    ));
}

/** 호 정보(호수·발행일·표지)를 워드프레스 기본 분류 화면에 붙인다 */
add_action(CHAOVN_ISSUE_TAX . '_add_form_fields', 'chaovn_issue_add_fields');
function chaovn_issue_add_fields() {
    wp_enqueue_media();
    ?>
    <div class="form-field">
        <label for="chaovn_issue_number">호수</label>
        <input type="number" name="chaovn_issue_number" id="chaovn_issue_number" value="" />
        <p>숫자만 입력하세요. 예: <code>565</code></p>
    </div>
    <div class="form-field">
        <label for="chaovn_issue_date">발행일</label>
        <input type="date" name="chaovn_issue_date" id="chaovn_issue_date" value="" />
    </div>
    <div class="form-field">
        <label>표지 이미지</label>
        <?php chaovn_issue_cover_field(0); ?>
        <p>issuu 에 올리는 표지 파일을 그대로 쓰시면 됩니다. 호당 1장이면 됩니다.</p>
    </div>
    <?php
}

add_action(CHAOVN_ISSUE_TAX . '_edit_form_fields', 'chaovn_issue_edit_fields');
function chaovn_issue_edit_fields($term) {
    wp_enqueue_media();
    $num   = get_term_meta($term->term_id, 'chaovn_issue_number', true);
    $date  = get_term_meta($term->term_id, 'chaovn_issue_date', true);
    $cover = (int) get_term_meta($term->term_id, 'chaovn_issue_cover_id', true);
    ?>
    <tr class="form-field">
        <th><label for="chaovn_issue_number">호수</label></th>
        <td><input type="number" name="chaovn_issue_number" id="chaovn_issue_number" value="<?php echo esc_attr($num); ?>" /></td>
    </tr>
    <tr class="form-field">
        <th><label for="chaovn_issue_date">발행일</label></th>
        <td><input type="date" name="chaovn_issue_date" id="chaovn_issue_date" value="<?php echo esc_attr($date); ?>" /></td>
    </tr>
    <tr class="form-field">
        <th><label>표지 이미지</label></th>
        <td><?php chaovn_issue_cover_field($cover); ?></td>
    </tr>
    <?php
}

/** 표지 선택 필드 (워드프레스 미디어 라이브러리 사용) */
function chaovn_issue_cover_field($cover_id) {
    $url = $cover_id ? wp_get_attachment_image_url($cover_id, 'medium') : '';
    ?>
    <div class="chaovn-cover-field">
        <input type="hidden" name="chaovn_issue_cover_id" class="chaovn-cover-id" value="<?php echo esc_attr($cover_id); ?>" />
        <img class="chaovn-cover-preview" src="<?php echo esc_url($url); ?>"
             style="max-width:140px;display:<?php echo $url ? 'block' : 'none'; ?>;margin-bottom:6px;" />
        <button type="button" class="button chaovn-cover-pick">표지 선택</button>
        <button type="button" class="button chaovn-cover-clear">지우기</button>
    </div>
    <script>
    (function(){
      var root = document.currentScript.closest('.form-field, td') || document;
      root.addEventListener('click', function(e){
        var box = e.target.closest('.chaovn-cover-field');
        if (!box) return;
        if (e.target.classList.contains('chaovn-cover-pick')) {
          e.preventDefault();
          var frame = wp.media({ title:'표지 이미지 선택', multiple:false, library:{type:'image'} });
          frame.on('select', function(){
            var a = frame.state().get('selection').first().toJSON();
            box.querySelector('.chaovn-cover-id').value = a.id;
            var img = box.querySelector('.chaovn-cover-preview');
            img.src = (a.sizes && a.sizes.medium ? a.sizes.medium.url : a.url);
            img.style.display = 'block';
          });
          frame.open();
        }
        if (e.target.classList.contains('chaovn-cover-clear')) {
          e.preventDefault();
          box.querySelector('.chaovn-cover-id').value = '';
          box.querySelector('.chaovn-cover-preview').style.display = 'none';
        }
      });
    })();
    </script>
    <?php
}

add_action('created_' . CHAOVN_ISSUE_TAX, 'chaovn_save_issue_meta');
add_action('edited_' . CHAOVN_ISSUE_TAX, 'chaovn_save_issue_meta');
function chaovn_save_issue_meta($term_id) {
    if (isset($_POST['chaovn_issue_number'])) {
        update_term_meta($term_id, 'chaovn_issue_number', intval($_POST['chaovn_issue_number']));
    }

    // 글쓰기 화면 옆 상자에서 이름만 만든 경우(호수 입력칸이 없다) 이름에서 숫자를 뽑아 채운다.
    // 안 그러면 그 호는 앱에서 "제565호" 대신 밋밋하게 보이고 정렬 기준도 없어진다.
    // "제565호 / 565호 / 565" 처럼 *이름 전체가 호수인 경우에만* 뽑는다.
    // 아무 숫자나 집으면 "2026년 8월호" 에서 2026 을 호수로 잡는 사고가 난다.
    if (!get_term_meta($term_id, 'chaovn_issue_number', true)) {
        $term = get_term($term_id, CHAOVN_ISSUE_TAX);
        if ($term && !is_wp_error($term)
            && preg_match('/^제?\s*(\d{1,5})\s*호?$/u', trim($term->name), $m)) {
            update_term_meta($term_id, 'chaovn_issue_number', intval($m[1]));
        }
    }
    if (isset($_POST['chaovn_issue_date'])) {
        update_term_meta($term_id, 'chaovn_issue_date', sanitize_text_field($_POST['chaovn_issue_date']));
    }

    // 슬러그(주소에 쓰이는 이름)를 영문으로 맞춘다.
    //
    // 슬러그를 비워두면 워드프레스가 이름에서 만드는데, '제565호' 는
    // /magazine-issue/%ec%a0%9c565%ed%98%b8/ 처럼 인코딩된 주소가 된다.
    // 그런 주소는 카톡·페북 공유 시 깨져 보이고, 앱·API 가 슬러그로 조회할 때도 말썽이다.
    // 호수를 아는 경우에만, 그리고 사람이 영문 슬러그를 직접 넣지 않은 경우에만 바꾼다.
    $number = (int) get_term_meta($term_id, 'chaovn_issue_number', true);
    if ($number) {
        $term = get_term($term_id, CHAOVN_ISSUE_TAX);
        if ($term && !is_wp_error($term)) {
            $slug = rawurldecode($term->slug);
            // 영문·숫자·하이픈만으로 된 슬러그면 사람이 정한 것으로 보고 손대지 않는다
            if (!preg_match('/^[a-z0-9\-]+$/', $slug)) {
                wp_update_term($term_id, CHAOVN_ISSUE_TAX, array('slug' => 'issue-' . $number));
            }
        }
    }
    if (isset($_POST['chaovn_issue_cover_id'])) {
        update_term_meta($term_id, 'chaovn_issue_cover_id', intval($_POST['chaovn_issue_cover_id']));
    }
    delete_transient(CHAOVN_MAGAZINE_CACHE_KEY);
}

/**
 * 글을 발행하면 "이번 호"에 자동으로 넣는다 — 직원 작업 0.
 *
 * 건드리지 않는 경우:
 *  - 데일리 뉴스(31): 잡지가 아니다
 *  - 이미 호가 지정된 글: 사람이 정한 것을 덮어쓰지 않는다
 *  - "이번 호"가 설정 안 된 경우: 아무것도 하지 않는다(조용히 넘어간다)
 */
// 두 경로 모두에서 동작해야 한다:
//  - 블록 편집기(구텐베르크)는 REST 로 저장한다 → 카테고리가 글보다 *나중에* 저장되므로
//    save_post 시점에는 "이 글이 뉴스인지" 판단할 수 없다. rest_after_insert_post 가 맞다.
//  - 클래식 편집기·일괄 편집 등은 save_post 로 온다.
add_action('rest_after_insert_post', 'chaovn_auto_assign_issue_rest', 10, 1);
add_action('save_post_post', 'chaovn_auto_assign_issue_save', 20, 2);

function chaovn_auto_assign_issue_rest($post) { chaovn_auto_assign_issue($post); }
function chaovn_auto_assign_issue_save($post_id, $post) {
    // REST 저장이면 rest_after_insert_post 가 처리한다(거기서는 카테고리가 확정돼 있다)
    if (defined('REST_REQUEST') && REST_REQUEST) return;
    chaovn_auto_assign_issue($post);
}

/**
 * 글을 새로 발행하면 "이번 호"에 자동으로 넣는다 — 직원 작업 0.
 *
 * 건드리지 않는 경우:
 *  - 데일리 뉴스(31): 잡지가 아니다
 *  - 이미 호가 지정된 글: 사람이 정한 것을 덮어쓰지 않는다
 *  - "이번 호"가 설정 안 된 경우: 아무것도 하지 않는다
 *  - ⚠️ 발행일이 오래된 글: **옛 글을 수정만 해도 이번 호로 딸려 들어가는 사고**를 막는다.
 *    (사장님 질문에서 발견 — 직원이 2년 전 칼럼의 오타를 고치면 그 글이 565호 목차에
 *     나타나게 된다. 발행 시점 기준으로 최근 글만 자동 부여한다.)
 */
function chaovn_auto_assign_issue($post) {
    if (!$post || $post->post_type !== 'post') return;
    if (wp_is_post_revision($post->ID) || wp_is_post_autosave($post->ID)) return;
    if ($post->post_status !== 'publish') return;
    if (chaovn_is_news_post($post->ID)) return;

    // 발행일이 최근인 글만 (45일 = 호 3개분 여유. 예약발행·날짜 수정도 감안)
    $age_days = (time() - get_post_time('U', true, $post)) / DAY_IN_SECONDS;
    if ($age_days > 45) return;

    $existing = wp_get_object_terms($post->ID, CHAOVN_ISSUE_TAX, array('fields' => 'ids'));
    if (!is_wp_error($existing) && !empty($existing)) return;

    $current = (int) get_option(CHAOVN_CURRENT_ISSUE_OPT, 0);
    if (!$current) return;

    wp_set_object_terms($post->ID, array($current), CHAOVN_ISSUE_TAX);
    delete_transient(CHAOVN_MAGAZINE_CACHE_KEY);
}

// ── 관리 화면: "이번 호" 지정 + 과거 글 일괄 부여 ──────────────────
add_action('admin_menu', 'chaovn_issue_admin_menu');
function chaovn_issue_admin_menu() {
    add_submenu_page(
        'edit.php',                 // 글 메뉴 아래
        '매거진 호 설정', '매거진 호 설정',
        'manage_options', 'chaovn-issue-settings', 'chaovn_issue_settings_page'
    );
}

function chaovn_issue_settings_page() {
    if (!current_user_can('manage_options')) return;

    $notice = '';

    // 1) 이번 호 지정
    if (isset($_POST['chaovn_set_current']) && check_admin_referer('chaovn_issue_settings')) {
        update_option(CHAOVN_CURRENT_ISSUE_OPT, intval($_POST['chaovn_current_issue']));
        delete_transient(CHAOVN_MAGAZINE_CACHE_KEY);
        $notice = '이번 호를 저장했습니다. 이제 발행하는 글은 자동으로 이 호에 들어갑니다.';
    }

    // 2) 과거 글 일괄 부여 실행
    if (isset($_POST['chaovn_run_backfill']) && check_admin_referer('chaovn_issue_settings')) {
        $latest = intval($_POST['chaovn_latest_number']);
        $reset  = !empty($_POST['chaovn_reset_first']);
        $result = chaovn_backfill_issues($latest, false, $reset);
        $notice = sprintf(
            '%s%d개 호를 만들고 %d건의 글에 호를 붙였습니다.',
            $reset ? sprintf('기존 지정 %d건을 지운 뒤, ', $result['reset']) : '',
            $result['issues'], $result['posts']
        );
        delete_transient(CHAOVN_MAGAZINE_CACHE_KEY);
    }

    $current = (int) get_option(CHAOVN_CURRENT_ISSUE_OPT, 0);
    $terms   = get_terms(array('taxonomy' => CHAOVN_ISSUE_TAX, 'hide_empty' => false));
    $preview = chaovn_backfill_issues(0, true); // 미리보기(아무것도 바꾸지 않음)
    ?>
    <div class="wrap">
        <h1>매거진 호 설정</h1>
        <?php if ($notice): ?><div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div><?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('chaovn_issue_settings'); ?>

            <h2>1. 이번 호 지정</h2>
            <p>여기서 고른 호로 <strong>앞으로 발행하는 글이 자동으로 들어갑니다.</strong>
               직원분들은 글을 쓸 때 호를 신경 쓰지 않아도 됩니다.</p>
            <p>
                <select name="chaovn_current_issue">
                    <option value="0">— 지정 안 함 —</option>
                    <?php foreach ((array) $terms as $t):
                        $n = get_term_meta($t->term_id, 'chaovn_issue_number', true);
                        $d = get_term_meta($t->term_id, 'chaovn_issue_date', true); ?>
                        <option value="<?php echo (int) $t->term_id; ?>" <?php selected($current, $t->term_id); ?>>
                            <?php echo esc_html($t->name . ($n ? " (제{$n}호" . ($d ? " · {$d}" : '') . ')' : '')); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <button class="button button-primary" name="chaovn_set_current" value="1">저장</button>
            </p>
            <p class="description">
                새 호는 <a href="<?php echo esc_url(admin_url('edit-tags.php?taxonomy=' . CHAOVN_ISSUE_TAX . '&post_type=post')); ?>">매거진 호 화면</a>
                에서 만듭니다(호수·발행일·표지 입력).
            </p>

            <hr />

            <h2>2. 과거 글에 호 붙이기 (최초 1회)</h2>
            <p>업로드 날짜가 붙어 있는 글 뭉치를 한 호로 봅니다(3일 이상 비면 다른 호).
               <strong>가장 최근 뭉치가 몇 호인지</strong>만 알려주시면 거기서부터 거꾸로 번호를 매깁니다.</p>
            <p>
                가장 최근 뭉치의 호수:
                <input type="number" name="chaovn_latest_number" value="<?php echo esc_attr($preview['suggest_latest']); ?>" style="width:100px" />
                <label style="margin-left:14px">
                    <input type="checkbox" name="chaovn_reset_first" value="1" />
                    <strong>이미 붙은 호를 지우고 다시 붙이기</strong>
                </label>
                <button class="button" name="chaovn_run_backfill" value="1"
                        onclick="return confirm('아래 미리보기대로 호를 만들고 글에 붙입니다. 계속할까요?');">실행</button>
            </p>
            <p class="description">
                한 번 잘못 붙였다면 위 체크를 켜고 다시 실행하세요.
                (체크를 끄면 이미 호가 있는 글은 건드리지 않습니다 — 그래서 그냥 다시 실행해서는 안 고쳐집니다)
            </p>

            <h3>미리보기 (지금은 아무것도 바뀌지 않습니다)</h3>
            <table class="widefat striped" style="max-width:820px">
                <thead><tr><th>업로드 기간</th><th>글 수</th><th>붙일 호수</th><th>이미 호가 있는 글</th></tr></thead>
                <tbody>
                <?php foreach ($preview['clusters'] as $c):
                    $is_issue = !empty($c['is_issue']);
                    ?>
                    <tr<?php echo $is_issue ? '' : ' style="opacity:.55"'; ?>>
                        <td><?php echo esc_html($c['from'] === $c['to'] ? $c['from'] : $c['from'] . ' ~ ' . $c['to']); ?></td>
                        <td><?php echo (int) $c['count']; ?>건</td>
                        <td>
                            <?php if ($is_issue && !empty($c['number'])): ?>
                                제<?php echo (int) $c['number']; ?>호
                            <?php else: ?>
                                <em>호 아님 (<?php echo esc_html(!empty($c['reason']) ? $c['reason'] : '상시 콘텐츠'); ?>)</em>
                            <?php endif; ?>
                        </td>
                        <td><?php echo (int) $c['already']; ?>건</td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <p class="description">
                글이 <?php echo 5; ?>건 미만인 뭉치는 <strong>호로 세지 않습니다</strong> — 잡지 한 호는 13~24건인데,
                호 사이에 한두 건씩 올라오는 상시 콘텐츠(교민소식 등)를 한 호로 세면
                <strong>그 아래 모든 호수가 한 칸씩 밀립니다.</strong>
            </p>
        </form>
    </div>
    <?php
}

/**
 * 과거 글을 업로드 날짜 뭉치로 묶어 호를 부여한다.
 *
 * 왜 날짜 계산이 아니라 뭉치인가: 발행 주기가 불규칙하다(격주 기본, 3개월에 한 번은 3주).
 * 반면 업로드는 발행 즈음 하루이틀에 몰아서 한다(실측: 한 호 17~20건이 이틀에 걸쳐).
 * 그래서 "3일 이상 비면 다른 호"라는 규칙이 날짜 계산보다 정확하다.
 *
 * @param int  $latest_number 가장 최근 뭉치에 부여할 호수
 * @param bool $dry_run       true 면 아무것도 바꾸지 않고 미리보기만 만든다
 */
function chaovn_backfill_issues($latest_number, $dry_run = true, $reset = false) {
    $GAP_DAYS   = 3;
    $SCAN_LIMIT = 400;
    // 잡지 한 호는 13~24건이다(실측). 그보다 훨씬 적은 뭉치는 호 사이에 올라온
    // 상시 콘텐츠(교민소식 등)다. 이걸 한 호로 세면 *그 아래 모든 호수가 한 칸씩 밀린다.*
    // (2026-08-06 사장님이 미리보기에서 발견: 7/22 1건이 호수를 하나 먹고 있었다)
    $MIN_CLUSTER = 5;
    // 반대쪽 방어선. 하루~이틀에 40건이 넘게 올라왔다면 그건 한 호가 아니라
    // *여러 호를 한꺼번에 올린 것*(사이트 이전·과거분 일괄 업로드)이다.
    // 실측: 2025-11-18 하루에 171건. 이걸 한 호로 세면 그 호가 통째로 거짓이 되고,
    // 그 아래 번호도 전부 밀린다. 그래서 아예 호로 세지 않는다.
    $MAX_CLUSTER = 40;

    $news = get_categories(array('hide_empty' => false, 'child_of' => CHAOVN_NEWS_CAT_ID));
    $news_ids = array(CHAOVN_NEWS_CAT_ID);
    foreach ($news as $n) $news_ids[] = (int) $n->term_id;

    $q = new WP_Query(array(
        'post_type'        => 'post',
        'posts_per_page'   => $SCAN_LIMIT,
        'post_status'      => 'publish',
        'orderby'          => 'date',
        'order'            => 'DESC',
        'no_found_rows'    => true,
        'category__not_in' => $news_ids,
    ));

    // 날짜 뭉치로 나눈다
    $clusters = array();
    $cur = null; $prev_ts = null;
    foreach ($q->posts as $p) {
        $ts   = strtotime(get_the_date('Y-m-d', $p));
        $date = get_the_date('Y-m-d', $p);
        if ($cur === null || ($prev_ts - $ts) > $GAP_DAYS * DAY_IN_SECONDS) {
            if ($cur !== null) $clusters[] = $cur;
            $cur = array('from' => $date, 'to' => $date, 'count' => 0, 'already' => 0, 'ids' => array());
        }
        $cur['from']  = $date; // 뒤로 갈수록 과거 → from 이 계속 갱신된다
        $cur['count']++;
        $cur['ids'][] = $p->ID;
        $has = wp_get_object_terms($p->ID, CHAOVN_ISSUE_TAX, array('fields' => 'ids'));
        if (!is_wp_error($has) && !empty($has)) $cur['already']++;
        $prev_ts = $ts;
    }
    if ($cur !== null) $clusters[] = $cur;
    wp_reset_postdata();

    // 추천값을 *먼저* 구한다. 번호를 매기려면 기준 호수가 있어야 하는데,
    // 미리보기는 사용자가 아직 숫자를 안 넣은 상태로 들어온다($latest_number = 0).
    // (이 순서를 거꾸로 뒀다가 미리보기의 모든 줄이 "호 아님"으로 나왔다 — 2026-08-06)
    //
    // 추천 기준: "이미 발행일이 지난 호 중 가장 큰 호수".
    // 제565호처럼 발행일이 아직 안 온 호는 지금 올라온 글들의 호가 아니다 —
    // 그걸 그대로 추천하면 최근 뭉치가 통째로 한 호씩 밀린다(실제로 그렇게 됐다).
    $suggest = 0;
    $max_any = 0;
    $today   = current_time('Y-m-d');
    $terms   = get_terms(array('taxonomy' => CHAOVN_ISSUE_TAX, 'hide_empty' => false));
    if (!is_wp_error($terms) && $terms) {
        foreach ($terms as $t) {
            $n = (int) get_term_meta($t->term_id, 'chaovn_issue_number', true);
            $d = get_term_meta($t->term_id, 'chaovn_issue_date', true);
            if (!$n) continue;
            $max_any = max($max_any, $n);
            if (!$d || $d <= $today) $suggest = max($suggest, $n); // 이미 나온 호
        }
    }
    if (!$suggest) $suggest = $max_any ? $max_any - 1 : 564;

    // 작은 뭉치는 "호 아님"으로 표시하고 번호를 소비하지 않는다
    $base = $latest_number ? (int) $latest_number : $suggest;
    $seq  = 0;
    foreach ($clusters as $k => $c) {
        if ($c['count'] < $MIN_CLUSTER || $c['count'] > $MAX_CLUSTER) {
            $clusters[$k]['is_issue'] = false;
            $clusters[$k]['number']   = null;
            $clusters[$k]['reason']   = ($c['count'] > $MAX_CLUSTER)
                ? '일괄 업로드로 보임 (한 호가 아님)'
                : '상시 콘텐츠';
        } else {
            $clusters[$k]['is_issue'] = true;
            $clusters[$k]['number']   = $base - $seq;
            $seq++;
        }
    }

    if ($dry_run) {
        return array('clusters' => $clusters, 'suggest_latest' => $suggest, 'issues' => 0, 'posts' => 0, 'reset' => 0);
    }

    // 다시 붙이기: 훑은 글들의 기존 호 지정을 먼저 지운다
    // (잘못된 번호로 한 번 붙고 나면, 자동 부여는 "이미 있는 글"을 건너뛰므로 재실행으로는 못 고친다)
    $cleared = 0;
    if ($reset) {
        foreach ($clusters as $c) {
            foreach ($c['ids'] as $pid) {
                $has = wp_get_object_terms($pid, CHAOVN_ISSUE_TAX, array('fields' => 'ids'));
                if (!is_wp_error($has) && !empty($has)) {
                    wp_set_object_terms($pid, array(), CHAOVN_ISSUE_TAX);
                    $cleared++;
                }
            }
        }
    }

    // 실제 부여
    $made = 0; $tagged = 0;
    foreach ($clusters as $i => $c) {
        if (empty($c['is_issue'])) continue;      // 상시 콘텐츠 뭉치는 호를 안 붙인다
        $number = $c['number'];
        if (!$number || $number <= 0) continue;

        $name = '제' . $number . '호';
        $term = get_term_by('name', $name, CHAOVN_ISSUE_TAX);
        if (!$term) {
            $new = wp_insert_term($name, CHAOVN_ISSUE_TAX);
            if (is_wp_error($new)) continue;
            $term_id = $new['term_id'];
            $made++;
        } else {
            $term_id = $term->term_id;
        }
        update_term_meta($term_id, 'chaovn_issue_number', $number);

        // 슬러그를 issue-564 형태로 맞춘다.
        // 여기서 만든 호는 이름('제564호')에서 슬러그가 자동 생성되므로
        // %ec%a0%9c564%ed%98%b8 같은 인코딩 주소가 된다(카톡 공유·API 조회에서 말썽).
        // 이미 영문 슬러그면 사람이 정한 것으로 보고 손대지 않는다.
        $t_now = get_term($term_id, CHAOVN_ISSUE_TAX);
        if ($t_now && !is_wp_error($t_now) && !preg_match('/^[a-z0-9\-]+$/', rawurldecode($t_now->slug))) {
            wp_update_term($term_id, CHAOVN_ISSUE_TAX, array('slug' => 'issue-' . $number));
        }

        // 발행일 = 그 뭉치에서 가장 이른 업로드일 (대개 발행 당일)
        // 다시 붙이기($reset)면 덮어쓴다 — 앞서 잘못 붙었을 때 엉뚱한 날짜가 들어가 있고,
        // "비어있을 때만 채우기"로는 그게 영영 안 고쳐진다.
        if ($reset || !get_term_meta($term_id, 'chaovn_issue_date', true)) {
            update_term_meta($term_id, 'chaovn_issue_date', $c['from']);
        }

        foreach ($c['ids'] as $pid) {
            $has = wp_get_object_terms($pid, CHAOVN_ISSUE_TAX, array('fields' => 'ids'));
            if (!is_wp_error($has) && !empty($has)) continue; // 사람이 정한 것은 덮지 않는다
            wp_set_object_terms($pid, array($term_id), CHAOVN_ISSUE_TAX);
            $tagged++;
        }
    }
    return array('clusters' => $clusters, 'suggest_latest' => $latest_number, 'issues' => $made, 'posts' => $tagged, 'reset' => $cleared);
}

/** 현재 호 정보를 앱/웹이 쓰기 좋은 형태로 */
function chaovn_get_issue_payload($term_id) {
    $term = get_term($term_id, CHAOVN_ISSUE_TAX);
    if (!$term || is_wp_error($term)) return null;

    $cover_id = (int) get_term_meta($term_id, 'chaovn_issue_cover_id', true);
    $number   = (int) get_term_meta($term_id, 'chaovn_issue_number', true);
    $date     = get_term_meta($term_id, 'chaovn_issue_date', true);

    return array(
        'id'       => (int) $term_id,
        'number'   => $number ?: null,
        // 표지가 없어도 화면이 깨지면 안 된다 — 앱이 대체 표지를 그린다.
        'coverUrl' => $cover_id ? wp_get_attachment_image_url($cover_id, 'large') : '',
        'date'     => $date ?: '',
        'title'    => html_entity_decode($term->name, ENT_QUOTES, 'UTF-8'),
        'count'    => (int) $term->count,
    );
}

// ============================================================
// 매거진 홈 API
// ------------------------------------------------------------
// 왜 만드는가 (2026-08-05 앱 전면 감사):
//   앱이 이 화면을 그리려고 WordPress 를 11번 불렀다 —
//   카테고리 목록 2페이지(순차, 0.95초) → 섹션 9개(병렬, 2.3초) = 3.3초.
//   뉴스탭이 빠른 이유는 서버가 조립해 주기 때문이다(1번, 0.4초). 같은 방식으로 옮긴다.
// 캐시: 매거진은 격주 발행이라 30분 캐시로 충분하다. 캐시가 있으면 DB 조회 0회.
// ============================================================
define('CHAOVN_MAGAZINE_CACHE_KEY', 'chaovn_magazine_home_v1');
define('CHAOVN_MAGAZINE_TTL', 30 * MINUTE_IN_SECONDS);

/**
 * 매거진 홈 섹션 정의.
 *
 * ⚠️ 앱의 HOME_SECTIONS_CONFIG(services/wordpressApi.js)와 *이름이 정확히 같아야* 한다.
 * 화면에 그대로 찍히는 문자열이다. 카테고리 ID 도 그 파일에서 가져왔다.
 * WP_Query 의 'cat' 은 하위 카테고리를 자동 포함하므로 자식 ID 를 따로 나열하지 않는다
 * (앱은 자식을 직접 찾아 나열했는데, 그것 때문에 카테고리 목록 2페이지를 먼저 받아야 했다).
 */
function chaovn_magazine_home_sections() {
    return array(
        array('id' => 32,  'name' => '교민소식',            'cats' => array(32)),
        array('id' => 445, 'name' => '비즈니스&사회',        'cats' => array(445)),
        // 칼럼: 13(컬럼) 과 382(CHAO COLUMN) 는 부모-자식이 아니라 별개 최상위라 함께 지정
        array('id' => 13,  'name' => '칼럼&오피니언',        'cats' => array(13, 382)),
        array('id' => 124, 'name' => '교육&자녀',            'cats' => array(124)),
        array('id' => 427, 'name' => 'F&R',                 'cats' => array(427)),
        array('id' => 453, 'name' => 'Health Section',      'cats' => array(453)),
        array('id' => 413, 'name' => '골프&스포츠',          'cats' => array(413)),
        array('id' => 7,   'name' => '라이프&조이&트래블',    'cats' => array(7)),
        array('id' => 456, 'name' => 'Pet World',           'cats' => array(456)),
    );
}

/**
 * 고정 섹션에 안 잡히는 카테고리를 자동으로 찾아 섹션으로 만든다.
 *
 * 왜 필요한가 (2026-08-06 실측):
 *   잡지는 매호 새 꼭지가 생긴다. 그런데 노출은 "카테고리 9개 화이트리스트"로 굳어 있어서,
 *   최근 매거진 글 100건 중 **16건(16%)이 앱에서 아예 안 보였다** — 그것도 하필
 *   INTERVIEW·BUSINESS(피플), DESK TALK, EVENT·MOVIE 같은 간판 꼭지였다.
 *   새 카테고리(예: Lifestyle Trend)가 생기면 개발자가 코드를 고치기 전엔 영원히 안 보인다.
 *
 * 규칙:
 *   1) 데일리 뉴스(31)와 그 하위는 제외 — 매거진이 아니다. (31 은 '뉴스(6)' 밑에 있어서
 *      루트째로 묶으면 뉴스가 매거진 탭에 섞인다. 반드시 걸러야 한다.)
 *   2) 최근 글 중 기존 섹션에 안 잡히는 것을 찾아, 그 글 카테고리의
 *      "아직 커버 안 된 가장 위쪽 조상"으로 묶는다 → 꼭지 하나하나가 아니라 큰 덩어리로 묶인다.
 *      (BUSINESS·INTERVIEW → '피플' 하나로)
 *   3) 글이 MIN_POSTS 건 미만인 것은 섹션으로 만들지 않는다 (일회성 카테고리 방지).
 *   4) 관리자가 숨기고 싶으면 옵션 chaovn_magazine_hidden_sections 에 카테고리 ID 를 넣는다.
 *
 * @return array [['id'=>int,'name'=>string,'cats'=>[int]], ...]
 */
function chaovn_magazine_discover_sections($fixed_sections) {
    $LOOKBACK_MONTHS = 6;
    $MIN_POSTS       = 2;
    $SCAN_LIMIT      = 200;

    $all = get_categories(array('hide_empty' => false));
    if (empty($all)) return array();

    $children = array(); // parent_id => [child_id]
    $parent   = array(); // id => parent_id
    foreach ($all as $c) {
        $children[$c->parent][] = $c->term_id;
        $parent[$c->term_id]    = (int) $c->parent;
    }
    $descendants = function ($id) use (&$descendants, $children) {
        $out = array($id);
        if (!empty($children[$id])) {
            foreach ($children[$id] as $kid) {
                $out = array_merge($out, $descendants($kid));
            }
        }
        return $out;
    };

    // 1) 이미 보이는 카테고리 + 제외 카테고리
    $covered = array();
    foreach ($fixed_sections as $sec) {
        foreach ($sec['cats'] as $cid) {
            $covered = array_merge($covered, $descendants($cid));
        }
    }
    $covered = array_flip($covered);
    $exclude = array_flip($descendants(CHAOVN_NEWS_CAT_ID));

    // 2) 최근 매거진 글을 훑는다
    $q = new WP_Query(array(
        'post_type'      => 'post',
        'posts_per_page' => $SCAN_LIMIT,
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
        'no_found_rows'  => true,
        'fields'         => 'ids',
        'date_query'     => array(array('after' => $LOOKBACK_MONTHS . ' months ago')),
        'category__not_in' => array_keys($exclude),
    ));

    $counts = array();
    foreach ($q->posts as $pid) {
        $cats = array_diff(wp_get_post_categories($pid), array_keys($exclude));
        if (empty($cats)) continue;

        // 이미 보이는 글이면 건너뛴다
        $visible = false;
        foreach ($cats as $c) { if (isset($covered[$c])) { $visible = true; break; } }
        if ($visible) continue;

        foreach ($cats as $c) {
            // 커버 안 된 가장 위쪽 조상까지 올라간다
            $node = $c;
            while (!empty($parent[$node]) && !isset($covered[$parent[$node]]) && !isset($exclude[$parent[$node]])) {
                $node = $parent[$node];
            }
            $counts[$node] = isset($counts[$node]) ? $counts[$node] + 1 : 1;
        }
    }
    wp_reset_postdata();

    arsort($counts);
    $hidden = (array) get_option('chaovn_magazine_hidden_sections', array());
    $out    = array();
    foreach ($counts as $cid => $n) {
        if ($n < $MIN_POSTS) continue;
        if (in_array((int) $cid, array_map('intval', $hidden), true)) continue;
        $term = get_term($cid, 'category');
        if (!$term || is_wp_error($term)) continue;
        $out[] = array(
            'id'    => (int) $cid,
            // 카테고리 이름에 &amp; 같은 엔티티가 들어있다 — 화면에 그대로 찍히면 안 된다
            'name'  => html_entity_decode($term->name, ENT_QUOTES, 'UTF-8'),
            'cats'  => array((int) $cid),
            'auto'  => true,
        );
    }
    return $out;
}

function chaovn_get_magazine_home($request) {
    $force = ('1' === (string) $request->get_param('refresh'));

    if (!$force) {
        $cached = get_transient(CHAOVN_MAGAZINE_CACHE_KEY);
        if ($cached !== false) {
            $cached['_cache'] = 'hit';
            return new WP_REST_Response($cached, 200);
        }
    }

    // 고정 9개(이름·순서를 사람이 정한 것) 뒤에, 자동으로 찾아낸 섹션을 붙인다.
    $fixed    = chaovn_magazine_home_sections();
    $section_defs = array_merge($fixed, chaovn_magazine_discover_sections($fixed));

    $sections = array();
    foreach ($section_defs as $sec) {
        $q = new WP_Query(array(
            'post_type'      => 'post',
            'posts_per_page' => 4, // 앱 홈은 2x2 그리드
            'cat'            => implode(',', $sec['cats']),
            'post_status'    => 'publish',
            'orderby'        => 'date',
            'order'          => 'DESC',
            'no_found_rows'  => true,
            // 날짜 제한 없음 — 매거진은 뉴스가 아니다. 몇 년 전 칼럼도 그대로 유효하다.
        ));

        $posts = array();
        if ($q->have_posts()) {
            while ($q->have_posts()) {
                $q->the_post();
                $pid   = get_the_ID();
                $thumb = get_the_post_thumbnail_url($pid, 'medium_large');
                $posts[] = array(
                    'postId'    => $pid,
                    'title'     => array('rendered' => get_the_title($pid)),
                    'date'      => get_the_date('c', $pid),
                    'link'      => get_permalink($pid),
                    'thumbnail' => $thumb ? $thumb : '',
                    // 상세화면이 뉴스/매거진을 구분하는 데 쓴다
                    'categories' => wp_get_post_categories($pid),
                );
            }
        }
        wp_reset_postdata();

        // 기사가 없는 섹션도 그대로 내려준다 — 앱이 빈 칸을 그려 레이아웃을 유지한다.
        $sections[] = array(
            'id'    => $sec['id'],
            'name'  => $sec['name'],
            'auto'  => !empty($sec['auto']), // 자동으로 찾아낸 섹션인지 (점검·관리용)
            'posts' => $posts,
        );
    }

    // ── 이번 호 (앱 매거진 탭 맨 위 블록) ──────────────────────────
    // 표지 + 호수 + 그 호 기사 목록. 호가 아직 지정 안 됐으면 null → 앱은 이 블록을 그리지 않는다.
    $current_issue = null;
    $current_id    = (int) get_option(CHAOVN_CURRENT_ISSUE_OPT, 0);
    if ($current_id) {
        $current_issue = chaovn_get_issue_payload($current_id);
        if ($current_issue) {
            $iq = new WP_Query(array(
                'post_type'      => 'post',
                'posts_per_page' => 12, // 목차 미리보기
                'post_status'    => 'publish',
                'orderby'        => 'date',
                'order'          => 'DESC',
                'no_found_rows'  => true,
                'tax_query'      => array(array(
                    'taxonomy' => CHAOVN_ISSUE_TAX,
                    'field'    => 'term_id',
                    'terms'    => $current_id,
                )),
            ));
            $iposts = array();
            while ($iq->have_posts()) {
                $iq->the_post();
                $pid   = get_the_ID();
                $thumb = get_the_post_thumbnail_url($pid, 'medium_large');
                $cats  = get_the_category($pid);
                $iposts[] = array(
                    'postId'    => $pid,
                    'title'     => array('rendered' => get_the_title($pid)),
                    'date'      => get_the_date('c', $pid),
                    'link'      => get_permalink($pid),
                    'thumbnail' => $thumb ? $thumb : '',
                    'categories' => wp_get_post_categories($pid),
                    // 목차에 꼭지 이름을 같이 보여주면 잡지 목차처럼 읽힌다
                    'section'   => !empty($cats) ? html_entity_decode($cats[0]->name, ENT_QUOTES, 'UTF-8') : '',
                );
            }
            wp_reset_postdata();
            $current_issue['posts'] = $iposts;
        }
    }

    $data = array(
        'success'      => true,
        'currentIssue' => $current_issue,
        'sections'     => $sections,
        '_cache'       => 'miss',
    );

    // 한 섹션이라도 내용이 있어야 캐시한다 — 빈 결과를 캐시하면 30분 동안 빈 화면이 된다.
    $has_content = false;
    foreach ($sections as $s) {
        if (!empty($s['posts'])) { $has_content = true; break; }
    }
    if ($has_content) {
        set_transient(CHAOVN_MAGAZINE_CACHE_KEY, $data, CHAOVN_MAGAZINE_TTL);
    }

    return new WP_REST_Response($data, 200);
}

// 매거진 글이 새로 발행되면 캐시를 지운다 (30분을 기다리지 않게)
add_action('publish_post', 'chaovn_purge_magazine_cache');
function chaovn_purge_magazine_cache($post_id) {
    // 뉴스(카테고리 31)는 매거진 홈에 안 들어가므로 무시
    if (chaovn_is_news_post($post_id)) return;
    delete_transient(CHAOVN_MAGAZINE_CACHE_KEY);
}

function chaovn_debug_posts($request) {
    $tz   = new DateTimeZone('Asia/Ho_Chi_Minh');
    $now  = new DateTime('now', $tz);
    $date = $request->get_param('date') ?: $now->format('Y-m-d');
    $parts = explode('-', $date);

    // 쿼리 1: 카테고리 31 + 날짜 필터
    $q1 = new WP_Query(array(
        'post_type' => 'post', 'posts_per_page' => -1,
        'cat' => 31, 'post_status' => 'publish',
        'no_found_rows' => true,
        'date_query' => array(array('year'=>intval($parts[0]),'month'=>intval($parts[1]),'day'=>intval($parts[2]))),
    ));
    $cat31_ids = array();
    while ($q1->have_posts()) { $q1->the_post(); $cat31_ids[] = get_the_ID(); }
    wp_reset_postdata();

    // 쿼리 2: 카테고리 없이 날짜 필터만 (모든 포스트)
    $q2 = new WP_Query(array(
        'post_type' => 'post', 'posts_per_page' => -1,
        'post_status' => 'publish', 'no_found_rows' => true,
        'date_query' => array(array('year'=>intval($parts[0]),'month'=>intval($parts[1]),'day'=>intval($parts[2]))),
    ));
    $all_today = array();
    while ($q2->have_posts()) {
        $q2->the_post();
        $pid = get_the_ID();
        $cats = get_the_category($pid);
        $cat_names = array_map(function($c){ return $c->term_id . ':' . $c->name; }, $cats);
        $all_today[] = array('id' => $pid, 'title' => get_the_title(), 'cats' => $cat_names);
    }
    wp_reset_postdata();

    return new WP_REST_Response(array(
        'date'             => $date,
        'server_time_vn'   => $now->format('Y-m-d H:i:s'),
        'cat31_count'      => count($cat31_ids),
        'cat31_ids'        => $cat31_ids,
        'all_today_count'  => count($all_today),
        'all_today_posts'  => $all_today,
    ), 200);
}

// ============================================================
// 뉴스 터미널 API (캐시 우선)
// ============================================================
function chaovn_get_news_terminal($request) {

    if (!function_exists('jenny_get_category_order')) {
        return new WP_REST_Response(array(
            'success' => false,
            'error'   => 'Jenny Daily News Display 플러그인이 활성화되어 있지 않습니다.',
        ), 503);
    }

    try {
        $tz          = new DateTimeZone('Asia/Ho_Chi_Minh');
        $now         = new DateTime('now', $tz);
        $date_param  = $request->get_param('date');

        // 대상 날짜 결정
        if (!empty($date_param) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_param)) {
            $target_date = $date_param;
        } else {
            $target_date = chaovn_get_target_date($now, CHAOVN_NEWS_CAT_ID);
        }

        // 과거 뉴스로 채울지 여부 — 앱이 "오늘의 뉴스"를 볼 때만 1 을 붙인다.
        // "지난 뉴스 보기"(사용자가 날짜를 고른 경우)에는 그 날짜 지면을 그대로 보여줘야
        // 하므로 앱이 fill 을 안 붙이고, 여기서도 채우지 않는다.
        // ⚠️ 날짜 파라미터 유무로는 구분할 수 없다 — 앱은 오늘도 /news-terminal/2026-08-05
        //    처럼 날짜를 박아 부르기 때문. 그래서 별도 플래그가 필요하다.
        $do_fill = ('1' === (string) $request->get_param('fill'));

        // 본문(content)까지 실어 보낼지 여부. 앱이 light=1 을 붙이면 뺀다.
        //
        // 이 응답의 78%(285KB/366KB)가 기사 본문인데, 목록 화면은 제목·썸네일·요약만 쓴다.
        // 즉 "읽지도 않을 기사 95건의 본문"을 매번 내려보내고 앱은 그걸 캐시에까지 저장했다.
        //
        // ⚠️ 그런데 '빼기'를 기본값으로 하면 안 된다. OTA 는 즉시 전파되지 않는다 —
        // 아직 구버전 JS 로 도는 앱은 *목록에서 받은 본문*으로 상세화면을 그리므로,
        // 서버가 일방적으로 본문을 빼면 그 사용자들은 기사 본문 대신 요약만 보게 된다.
        // 그래서 새 앱만 light=1 을 붙이고, 그 앱은 기사를 열 때 본문을 따로 받아온다.
        $light = ('1' === (string) $request->get_param('light'));

        // ── 캐시 확인 ──────────────────────────────────────
        // 채운 지면(_f) / 본문 뺀 지면(_l) 은 내용이 다르므로 캐시도 따로 둔다.
        $cache_key  = CHAOVN_NEWS_CACHE_PREFIX . $target_date . ($do_fill ? '_f' : '') . ($light ? '_l' : '');
        $is_today   = ($target_date === $now->format('Y-m-d'));

        // 오늘 날짜는 항상 DB에서 새로 조회 (발행 중간에 캐시되는 문제 방지)
        // 앱 클라이언트의 5분 캐시가 성능을 담당
        // 과거 날짜만 서버 캐시 사용
        if (!$is_today) {
            $cached = get_transient($cache_key);
            if ($cached !== false) {
                $cached['_cache'] = 'hit';
                return new WP_REST_Response($cached, 200);
            }
        }
        // ────────────────────────────────────────────────────

        // DB 조회 및 포맷팅
        $result         = chaovn_get_posts_by_date($target_date, CHAOVN_NEWS_CAT_ID);
        $sections_config = chaovn_get_sections_config();

        // 탑뉴스 (최대 2개)
        $top_news  = array();
        $top_count = 0;
        foreach ($result['top_news'] as $post) {
            if ($top_count >= 2) break;
            $top_news[] = chaovn_format_post($post, $light);
            $top_count++;
        }

        // 섹션별 그룹화
        $grouped_posts = array();
        foreach ($result['regular'] as $post) {
            $sec_key = chaovn_get_section_key($post['category']);
            $grouped_posts[$sec_key][] = $post;
        }

        // 탑뉴스 초과분 → 해당 섹션으로
        $extra_top_count = 0;
        foreach ($result['top_news'] as $post) {
            $extra_top_count++;
            if ($extra_top_count <= 2) continue;
            $sec_key = chaovn_get_section_key($post['category']);
            array_unshift($grouped_posts[$sec_key], $post);
        }

        // ── 부족한 섹션을 과거 뉴스로 채운다 (fill=1 일 때만) ──────────────
        // 오늘치만 쓰면 섹션 대부분이 2~4건이라, 앱의 "대표카드 + 제목 7줄" 배치에서
        // 목록이 한두 줄로 텅 빈다(웹도 같은 이유로 2026-07-17에 채우기를 도입했다).
        // 한도(경제·사회 2일 / 정치·문화 3일 / 여행·음식 14일)와 실제 조회 쿼리는
        // jenny 플러그인 것을 그대로 재사용한다 — 같은 규칙을 두 곳에 적으면 반드시 어긋난다.
        // jenny 가 없으면(구버전) 그냥 건너뛴다 → 채워지지 않을 뿐 API 는 정상 동작.
        if ($do_fill && function_exists('jenny_backfill_section')) {
            $exclude = array();
            foreach ($result['top_news'] as $p) { $exclude[] = $p['post_id']; }
            foreach ($result['regular'] as $p)  { $exclude[] = $p['post_id']; }

            foreach ($sections_config as $sec_key => $sec_info) {
                $have = isset($grouped_posts[$sec_key]) ? count($grouped_posts[$sec_key]) : 0;
                $need = CHAOVN_SECTION_TARGET - $have;
                if ($need <= 0) continue;

                $filled = jenny_backfill_section(
                    $sec_key,
                    $sec_info['keys'],
                    CHAOVN_NEWS_CAT_ID,
                    $exclude,
                    $need,
                    $target_date
                );
                if (empty($filled)) continue;

                if (!isset($grouped_posts[$sec_key])) $grouped_posts[$sec_key] = array();
                foreach ($filled as $f) {
                    $grouped_posts[$sec_key][] = $f;
                    $exclude[] = $f['post_id']; // 다음 섹션에서 같은 글이 또 뽑히지 않게
                }
            }
        }

        // 섹션 배열 생성
        $news_sections = array();
        foreach ($sections_config as $sec_key => $sec_info) {
            if (!empty($grouped_posts[$sec_key])) {
                $posts = array();
                foreach ($grouped_posts[$sec_key] as $post) {
                    $posts[] = chaovn_format_post($post, $light);
                }
                $news_sections[] = array(
                    'key'         => $sec_key,
                    'name'        => $sec_info['name'],
                    'categoryKey' => $sec_key,
                    'posts'       => $posts,
                );
            }
        }

        $response_data = array(
            'success'      => true,
            'date'         => $target_date,
            'topNews'      => $top_news,
            'newsSections' => $news_sections,
            'totalCount'   => count($result['top_news']) + count($result['regular']),
            '_cache'       => 'miss',
        );

        // ── 캐시 저장 (과거 날짜만) ──────────────────────────
        $total = count($result['top_news']) + count($result['regular']);
        if (!$is_today && $total > 0) {
            // 과거 날짜 뉴스만 자정까지 캐시 (변경될 일 없으므로)
            $midnight = new DateTime('tomorrow midnight', $tz);
            $ttl      = $midnight->getTimestamp() - time();
            if ($ttl < 60) $ttl = DAY_IN_SECONDS; // 안전장치
            set_transient($cache_key, $response_data, $ttl);
        }
        // 오늘 날짜는 캐시 저장 안 함 → 발행 중 캐시 고착 문제 방지
        // ────────────────────────────────────────────────────

        return new WP_REST_Response($response_data, 200);

    } catch (Exception $e) {
        return new WP_REST_Response(array(
            'success' => false,
            'error'   => $e->getMessage(),
        ), 500);
    }
}

// ============================================================
// 뉴스 포스트 발행 시 → 해당 날짜 캐시 자동 재생성
// ============================================================
add_action('publish_post', 'chaovn_on_post_published');
add_action('post_updated',  'chaovn_on_post_updated', 10, 3);

function chaovn_on_post_published($post_id) {
    if (!chaovn_is_news_post($post_id)) return;

    $date      = get_the_date('Y-m-d', $post_id);
    $cache_key = CHAOVN_NEWS_CACHE_PREFIX . $date;

    // 기존 캐시 삭제 (재생성은 API 호출 시 Lazy Loading 하도록 위임하여 Race Condition 방지)
    // 변형이 4가지다(기본 / 채움_f / 본문뺌_l / 둘 다). 하나라도 남기면 앱에 옛 지면이 계속 나간다.
    foreach (array('', '_f', '_l', '_f_l') as $suffix) {
        delete_transient($cache_key . $suffix);
    }

    // WP-Cron 대기 스케줄 제거
    wp_clear_scheduled_hook('chaovn_rebuild_news_cache', array($date));
}

function chaovn_on_post_updated($post_id, $post_after, $post_before) {
    // 발행 상태로 변경될 때만
    if ($post_after->post_status !== 'publish') return;
    chaovn_on_post_published($post_id);
}

// WP-Cron 핸들러: 캐시 재생성
add_action('chaovn_rebuild_news_cache', 'chaovn_do_rebuild_news_cache');
function chaovn_do_rebuild_news_cache($date) {
    $request = new WP_REST_Request('GET', '/chaovn/v1/news-terminal/' . $date);
    $request->set_param('date', $date);
    // 캐시가 없는 상태이므로 DB 조회 후 자동 저장됨
    chaovn_get_news_terminal($request);
}

// 관리자 수동 갱신 엔드포인트
function chaovn_rebuild_news_cache_endpoint($request) {
    $date = $request->get_param('date') ?: (new DateTime('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
    foreach (array('', '_f', '_l', '_f_l') as $suffix) {
        delete_transient(CHAOVN_NEWS_CACHE_PREFIX . $date . $suffix);
    }
    chaovn_do_rebuild_news_cache($date);
    return array('success' => true, 'rebuilt' => $date);
}

// ============================================================
// 날씨 + 환율 사전 캐시 API
// ============================================================

/**
 * GET /wp-json/chaovn/v1/external-data
 * 날씨와 환율을 캐시에서 반환. 없으면 즉시 가져와서 저장.
 */
function chaovn_get_external_data() {
    $weather = get_transient(CHAOVN_WEATHER_CACHE_KEY);
    $rates   = get_transient(CHAOVN_RATES_CACHE_KEY);

    if ($weather === false) {
        $weather = chaovn_fetch_weather();
    }
    if ($rates === false) {
        $rates = chaovn_fetch_exchange_rates();
    }

    return new WP_REST_Response(array(
        'success' => true,
        'weather' => $weather,
        'rates'   => $rates,
    ), 200);
}

/** Open-Meteo에서 날씨 가져오기 (하노이/호치민/서울) */
function chaovn_fetch_weather() {
    $url = 'https://api.open-meteo.com/v1/forecast'
        . '?latitude=21.0285,10.8231,37.5665'
        . '&longitude=105.8542,106.6297,126.9780'
        . '&current_weather=true'
        . '&timezone=Asia%2FHo_Chi_Minh';

    $response = wp_remote_get($url, array('timeout' => 10));

    if (is_wp_error($response)) {
        return null;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);

    // 도시별로 정리
    $cities = array('하노이', '호치민', '서울');
    $result = array();
    if (isset($body[0])) {
        // Open-Meteo 다중 위치 응답 처리
        foreach (array(0, 1, 2) as $i) {
            if (isset($body[$i]['current_weather']['temperature'])) {
                $result[$cities[$i]] = round($body[$i]['current_weather']['temperature']) . '°C';
            }
        }
    } elseif (isset($body['current_weather'])) {
        // 단일 응답 fallback
        $result['호치민'] = round($body['current_weather']['temperature']) . '°C';
    }

    set_transient(CHAOVN_WEATHER_CACHE_KEY, $result, CHAOVN_WEATHER_TTL);
    return $result;
}

/** Frankfurter(ECB) 에서 환율 가져오기 */
function chaovn_fetch_exchange_rates() {
    $url      = 'https://api.frankfurter.app/latest?from=USD,KRW&to=VND';
    $response = wp_remote_get($url, array('timeout' => 10));

    if (is_wp_error($response)) {
        return null;
    }

    $body   = json_decode(wp_remote_retrieve_body($response), true);
    $result = array();

    if (!empty($body['rates'])) {
        // USD → VND
        if (isset($body['rates']['VND'])) {
            $result['USD_VND'] = number_format($body['rates']['VND'], 0);
        }
    }

    // KRW → VND 는 별도 호출 (Frankfurter는 base 1개만 지원)
    $url2      = 'https://api.frankfurter.app/latest?from=KRW&to=VND';
    $response2 = wp_remote_get($url2, array('timeout' => 10));
    if (!is_wp_error($response2)) {
        $body2 = json_decode(wp_remote_retrieve_body($response2), true);
        if (isset($body2['rates']['VND'])) {
            // 100원 기준
            $result['KRW100_VND'] = number_format($body2['rates']['VND'] * 100, 0);
        }
    }

    set_transient(CHAOVN_RATES_CACHE_KEY, $result, CHAOVN_RATES_TTL);
    return $result;
}

// ============================================================
// WP-Cron: 매일 아침 6시(베트남 시간) 외부 데이터 자동 갱신
// ============================================================
add_filter('cron_schedules', 'chaovn_add_cron_interval');
function chaovn_add_cron_interval($schedules) {
    $schedules['chaovn_daily_6am'] = array(
        'interval' => DAY_IN_SECONDS,
        'display'  => '매일 1회 (아침 6시 갱신)',
    );
    return $schedules;
}

add_action('chaovn_prefetch_external_data', 'chaovn_do_prefetch_external_data');
function chaovn_do_prefetch_external_data() {
    // 기존 캐시 삭제 후 새로 가져오기
    delete_transient(CHAOVN_WEATHER_CACHE_KEY);
    delete_transient(CHAOVN_RATES_CACHE_KEY);
    chaovn_fetch_weather();
    chaovn_fetch_exchange_rates();
}

// ============================================================
// 내부 헬퍼 함수들 (기존과 동일)
// ============================================================

function chaovn_is_news_post($post_id) {
    $cats = get_the_category($post_id);
    foreach ($cats as $cat) {
        if ((int) $cat->term_id === CHAOVN_NEWS_CAT_ID) return true;
    }
    return false;
}

function chaovn_get_target_date($now, $category_id) {
    $today = $now->format('Y-m-d');

    $today_args = array(
        'post_type'      => 'post',
        'posts_per_page' => 1,
        'cat'            => intval($category_id),
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
        'no_found_rows'  => true,
        'date_query'     => array(
            array(
                'year'  => intval($now->format('Y')),
                'month' => intval($now->format('m')),
                'day'   => intval($now->format('d')),
            ),
        ),
    );

    $today_query = new WP_Query($today_args);
    if ($today_query->have_posts()) {
        wp_reset_postdata();
        return $today;
    }
    wp_reset_postdata();

    $latest_args = array(
        'post_type'      => 'post',
        'posts_per_page' => 1,
        'cat'            => intval($category_id),
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
        'no_found_rows'  => true,
    );
    $latest_query = new WP_Query($latest_args);
    if ($latest_query->have_posts()) {
        $latest_query->the_post();
        $target_date = get_the_date('Y-m-d');
        wp_reset_postdata();
        return $target_date;
    }
    wp_reset_postdata();

    return $today;
}

function chaovn_get_posts_by_date($date, $category_id) {
    $date_parts = explode('-', $date);

    $args = array(
        'post_type'      => 'post',
        'posts_per_page' => -1,
        'cat'            => intval($category_id),
        'post_status'    => 'publish',
        'orderby'        => 'date',
        'order'          => 'DESC',
        'no_found_rows'  => true,
        'date_query'     => array(
            array(
                'year'  => intval($date_parts[0]),
                'month' => intval($date_parts[1]),
                'day'   => intval($date_parts[2]),
            ),
        ),
    );

    $query          = new WP_Query($args);
    $top_news_posts = array();
    $regular_posts  = array();
    $processed_ids  = array();

    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $post_id = get_the_ID();

            if (in_array($post_id, $processed_ids)) continue;
            $processed_ids[] = $post_id;

            $news_category = get_post_meta($post_id, 'news_category', true);
            if (empty($news_category)) {
                $categories    = get_the_category($post_id);
                $news_category = !empty($categories) ? $categories[0]->name : '기타';
            }

            $is_top_raw = get_post_meta($post_id, 'is_top_news', true);
            $is_top     = ($is_top_raw === '1' || $is_top_raw === 1 || $is_top_raw === true);

            $item = array(
                'post_id'  => $post_id,
                'category' => trim($news_category),
                'is_top'   => $is_top,
            );

            if ($is_top) {
                $top_news_posts[] = $item;
            } else {
                $regular_posts[] = $item;
            }
        }
        wp_reset_postdata();
    }

    return array(
        'top_news' => $top_news_posts,
        'regular'  => $regular_posts,
    );
}

function chaovn_format_post($post_data, $light = false) {
    $post_id  = $post_data['post_id'];
    $post_obj = get_post($post_id);

    $thumbnail = get_the_post_thumbnail_url($post_id, 'medium_large');
    if (empty($thumbnail)) $thumbnail = '';

    $excerpt = get_post_meta($post_id, 'news_summary', true);
    if (empty($excerpt)) $excerpt = trim($post_obj->post_excerpt);
    if (empty($excerpt)) {
        $content = strip_tags($post_obj->post_content);
        $excerpt = wp_trim_words($content, 50, '...');
    }

    $source = get_post_meta($post_id, 'news_source', true);
    if (empty($source)) {
        $categories = get_the_category($post_id);
        $source     = !empty($categories) ? $categories[0]->name : '';
    }

    $category_display = chaovn_get_category_display_name($post_data['category']);

    // 본문 렌더링은 비싸다 — the_content 필터가 글마다 돌면서 숏코드·임베드를 처리한다.
    // light 모드에서는 아예 만들지 않는다(전송량뿐 아니라 서버 시간도 아낀다).
    $content_html = '';
    if (!$light && !empty($post_obj->post_content)) {
        $content_html = apply_filters('the_content', $post_obj->post_content);
    }

    return array(
        'id'          => $post_id,
        'title'       => array('rendered' => get_the_title($post_id)),
        'content'     => array('rendered' => $content_html),
        'excerpt'     => $excerpt,
        'thumbnail'   => $thumbnail,
        'link'        => get_permalink($post_id),
        'date'        => get_the_date('Y.m.d', $post_id),
        'dateISO'     => get_the_date('c', $post_id),
        'category'    => $category_display,
        'categoryKey' => $post_data['category'],
        'source'      => $source,
        'originalUrl' => get_post_meta($post_id, 'news_original_url', true),
        'isTop'       => $post_data['is_top'],
        // 오늘치가 모자라 과거에서 끌어온 기사 — 앱이 날짜를 붙여 표시한다.
        // 오늘 것처럼 보이면 안 된다.
        'isPast'      => !empty($post_data['is_past']),
        'meta'        => array(
            'news_category' => $post_data['category'],
            'is_top_news'   => $post_data['is_top'] ? '1' : '',
        ),
    );
}

function chaovn_get_sections_config() {
    return array(
        'economy'       => array('name' => '경제',     'keys' => array('Economy', '경제')),
        'society'       => array('name' => '사회',     'keys' => array('Society', '사회')),
        'culture'       => array('name' => '문화/스포츠', 'keys' => array('Culture', '문화')),
        'real_estate'   => array('name' => '부동산',   'keys' => array('Real Estate', '부동산')),
        'politics'      => array('name' => '정치/정책', 'keys' => array('Politics', 'Policy', '정치', '정책')),
        'international' => array('name' => '국제',     'keys' => array('International', '국제')),
        'korea_vietnam' => array('name' => '한-베',    'keys' => array('Korea-Vietnam', '한-베', '한베')),
        'community'     => array('name' => '교민소식', 'keys' => array('Community', '교민', '교민소식')),
        'travel'        => array('name' => '여행',     'keys' => array('Travel', '여행')),
        'health'        => array('name' => '건강',     'keys' => array('Health', '건강')),
        'food'          => array('name' => '음식',     'keys' => array('Food', '음식')),
        'other'         => array('name' => '기타',     'keys' => array('Other', '기타')),
    );
}

function chaovn_get_section_key($category) {
    $sections = chaovn_get_sections_config();
    $cat      = trim($category);

    foreach ($sections as $sec_key => $sec_info) {
        if (in_array($cat, $sec_info['keys'], true)) return $sec_key;
        foreach ($sec_info['keys'] as $key) {
            if (strcasecmp($cat, $key) === 0) return $sec_key;
        }
    }
    return 'other';
}

function chaovn_get_category_display_name($category) {
    $map = array(
        'Society'       => '사회',     '사회'     => '사회',
        'Economy'       => '경제',     '경제'     => '경제',
        'Culture'       => '문화/스포츠', '문화'  => '문화/스포츠',
        'Real Estate'   => '부동산',   '부동산'   => '부동산',
        'Politics'      => '정치/정책', 'Policy'  => '정치/정책',
        '정치'          => '정치/정책', '정책'    => '정치/정책',
        'International' => '국제',     '국제'     => '국제',
        'Korea-Vietnam' => '한-베',    '한-베'    => '한-베', '한베' => '한-베',
        'Community'     => '교민소식', '교민'     => '교민소식', '교민소식' => '교민소식',
        'Travel'        => '여행',     '여행'     => '여행',
        'Health'        => '건강',     '건강'     => '건강',
        'Food'          => '음식',     '음식'     => '음식',
        'Other'         => '기타',     '기타'     => '기타',
    );

    $cat = trim($category);
    if (isset($map[$cat])) return $map[$cat];

    foreach ($map as $key => $value) {
        if (strcasecmp($cat, $key) === 0) return $value;
    }
    return $cat;
}

// ============================================================
// 플러그인 활성화 / 비활성화
// ============================================================
register_activation_hook(__FILE__, function () {
    flush_rewrite_rules();

    // 매일 아침 6시 (UTC+7 = UTC 23:00 전날) WP-Cron 등록
    if (!wp_next_scheduled('chaovn_prefetch_external_data')) {
        // 다음 UTC 23:00을 계산
        $tz      = new DateTimeZone('Asia/Ho_Chi_Minh');
        $now_vn  = new DateTime('now', $tz);
        $next_6am = new DateTime('tomorrow 06:00', $tz);
        wp_schedule_event($next_6am->getTimestamp(), 'daily', 'chaovn_prefetch_external_data');
    }

    // 활성화 즉시 외부 데이터 1회 가져오기
    chaovn_do_prefetch_external_data();
});

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
    wp_clear_scheduled_hook('chaovn_prefetch_external_data');
    wp_clear_scheduled_hook('chaovn_rebuild_news_cache');
});
