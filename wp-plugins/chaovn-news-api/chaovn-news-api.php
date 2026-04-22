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
});

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

        // ── 캐시 확인 ──────────────────────────────────────
        $cache_key  = CHAOVN_NEWS_CACHE_PREFIX . $target_date;
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
            $top_news[] = chaovn_format_post($post);
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

        // 섹션 배열 생성
        $news_sections = array();
        foreach ($sections_config as $sec_key => $sec_info) {
            if (!empty($grouped_posts[$sec_key])) {
                $posts = array();
                foreach ($grouped_posts[$sec_key] as $post) {
                    $posts[] = chaovn_format_post($post);
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
    delete_transient($cache_key);

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
    delete_transient(CHAOVN_NEWS_CACHE_PREFIX . $date);
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

function chaovn_format_post($post_data) {
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

    $content_html = '';
    if (!empty($post_obj->post_content)) {
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
