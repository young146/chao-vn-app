<?php
/**
 * Plugin Name: ChaoVN Ad API
 * Plugin URI: https://chaovietnam.co.kr
 * Description: ACF + CPT 기반 광고 관리 API - 모바일 앱용
 * Version: 2.0.0
 * Author: ChaoVietnam
 * Author URI: https://chaovietnam.co.kr
 * License: GPL v2 or later
 * Text Domain: chaovn-ad-api
 */

// 직접 접근 방지
if (!defined('ABSPATH')) {
    exit;
}

// ========================================
// 상수 정의
// ========================================
define('CHAOVN_AD_VERSION', '2.0.0');
define('CHAOVN_AD_CPT', 'app_ads');  // CPT UI에서 설정한 slug

// ========================================
// 광고 슬롯 정의 (중앙 관리)
// ========================================
function chaovn_get_ad_slots() {
    return array(
        'home_banner' => array(
            'label' => '홈 대형 배너',
            'size' => 'app-home-banner',
            'dimensions' => array(750, 300),
        ),
        'home_inline' => array(
            'label' => '홈 섹션 사이 광고',
            'size' => 'app-section',
            'dimensions' => array(750, 150),
        ),
        'header' => array(
            'label' => '리스트 상단 배너',
            'size' => 'app-banner',
            'dimensions' => array(750, 200),
        ),
        'inline' => array(
            'label' => '리스트 인라인 광고',
            'size' => 'app-inline',
            'dimensions' => array(750, 400),
        ),
        'detail_top' => array(
            'label' => '상세 페이지 상단',
            'size' => 'app-banner',
            'dimensions' => array(750, 200),
        ),
        'detail_bottom' => array(
            'label' => '상세 페이지 하단',
            'size' => 'app-banner',
            'dimensions' => array(750, 200),
        ),
        'popup' => array(
            'label' => '전면 팝업 광고',
            'size' => 'app-popup',
            'dimensions' => array(600, 800),
        ),
    );
}

// 광고 화면(섹션) 정의
function chaovn_get_ad_screens() {
    return array(
        'all' => '전체 섹션 노출',
        'startup' => '앱 시작 팝업 전용',
        'home' => '홈 화면 전용',
        'news' => '뉴스/매거진',
        'job' => '구인구직',
        'realestate' => '부동산',
        'danggn' => '당근마켓/나눔',
    );
}

// ========================================
// 앱용 이미지 사이즈 등록
// ========================================
add_action('after_setup_theme', function() {
    add_image_size('app-home-banner', 750, 300, true);  // 홈 대형 배너
    add_image_size('app-banner', 750, 200, true);       // 일반 배너
    add_image_size('app-inline', 750, 400, true);       // 인라인
    add_image_size('app-popup', 600, 800, true);        // 전면 팝업
    add_image_size('app-section', 750, 150, true);      // 섹션
});

// ========================================
// REST API 엔드포인트 등록
// ========================================
add_action('rest_api_init', function() {
    // v2 API - ACF/CPT 기반
    
    // 광고 목록 (슬롯별 그룹화)
    register_rest_route('chaovn/v2', '/ads', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_ads_v2',
        'permission_callback' => '__return_true',
        'args' => array(
            'screen' => array(
                'default' => 'all',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        ),
    ));
    
    // 특정 슬롯의 광고만 조회
    register_rest_route('chaovn/v2', '/ads/slot/(?P<slot>[a-z_]+)', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_ads_by_slot',
        'permission_callback' => '__return_true',
        'args' => array(
            'screen' => array(
                'default' => 'all',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        ),
    ));
    
    // 광고 클릭 추적
    register_rest_route('chaovn/v2', '/ads/(?P<id>\d+)/click', array(
        'methods' => 'POST',
        'callback' => 'chaovn_track_ad_click',
        'permission_callback' => '__return_true',
    ));
    
    // 슬롯 목록 조회 (앱에서 슬롯 정보 확인용)
    register_rest_route('chaovn/v2', '/ads/slots', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_slots_info',
        'permission_callback' => '__return_true',
    ));
    
    // 디버그용 (임시 공개 - 테스트 후 다시 제한할 것)
    register_rest_route('chaovn/v2', '/ads/debug', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_ads_debug_v2',
        'permission_callback' => '__return_true',
    ));
    
    // 하위 호환성: v1 API도 v2로 리다이렉트
    register_rest_route('chaovn/v1', '/ads', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_ads_v2',
        'permission_callback' => '__return_true',
    ));
});

// ========================================
// 메인 광고 API (v2)
// ========================================
function chaovn_get_ads_v2(WP_REST_Request $request) {
    $screen = $request->get_param('screen') ?: 'all';
    $slots = chaovn_get_ad_slots();
    
    // 슬롯별 빈 배열 초기화
    $ads = array();
    foreach (array_keys($slots) as $slot) {
        $ads[$slot] = array();
    }
    
    // 현재 날짜
    $today = date('Y-m-d');
    
    // ACF 기반 광고 포스트 조회
    $query_args = array(
        'post_type' => CHAOVN_AD_CPT,
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'meta_query' => array(
            'relation' => 'AND',
            // 활성화된 광고만
            array(
                'key' => 'ad_active',
                'value' => '1',
                'compare' => '=',
            ),
        ),
    );
    
    // 시작일 조건 추가
    $query_args['meta_query'][] = array(
        'relation' => 'OR',
        array(
            'key' => 'ad_start_date',
            'compare' => 'NOT EXISTS',
        ),
        array(
            'key' => 'ad_start_date',
            'value' => '',
            'compare' => '=',
        ),
        array(
            'key' => 'ad_start_date',
            'value' => $today,
            'compare' => '<=',
            'type' => 'DATE',
        ),
    );
    
    // 종료일 조건 추가
    $query_args['meta_query'][] = array(
        'relation' => 'OR',
        array(
            'key' => 'ad_end_date',
            'compare' => 'NOT EXISTS',
        ),
        array(
            'key' => 'ad_end_date',
            'value' => '',
            'compare' => '=',
        ),
        array(
            'key' => 'ad_end_date',
            'value' => $today,
            'compare' => '>=',
            'type' => 'DATE',
        ),
    );
    
    $query = new WP_Query($query_args);
    
    while ($query->have_posts()) {
        $query->the_post();
        $post_id = get_the_ID();
        
        // ACF 필드 가져오기
        $ad_slot = get_field('ad_slot', $post_id);
        $ad_screen = get_field('ad_screen', $post_id);
        $ad_image = get_field('ad_image', $post_id);
        $ad_link = get_field('ad_link', $post_id);
        $ad_priority = get_field('ad_priority', $post_id);
        
        // 이미지 없으면 스킵
        if (!$ad_image || !is_array($ad_image) || empty($ad_image['url'])) {
            continue;
        }
        
        // ad_slot과 ad_screen을 배열로 정규화
        $ad_slots_array = is_array($ad_slot) ? $ad_slot : array($ad_slot);
        $ad_screens_array = is_array($ad_screen) ? $ad_screen : array($ad_screen);
        
        // 화면(섹션) 필터링
        // ad_screen에 'all'이 포함되면 모든 화면에 표시
        // 그렇지 않으면 요청된 screen과 일치하거나 'all' 요청일 때만 표시
        $screen_match = in_array('all', $ad_screens_array) || 
                        $screen === 'all' || 
                        in_array($screen, $ad_screens_array);
        
        if (!$screen_match) {
            continue;
        }
        
        // 광고 데이터 구성
        $ad_data = array(
            'id' => $post_id,
            'name' => get_the_title(),
            'imageUrl' => $ad_image['url'],
            'linkUrl' => !empty($ad_link) ? $ad_link : 'https://chaovietnam.co.kr',
            'priority' => intval($ad_priority) ?: 10,
            'screen' => $ad_screens_array,
            'thumbnails' => array(
                'home_banner' => isset($ad_image['sizes']['app-home-banner']) ? $ad_image['sizes']['app-home-banner'] : $ad_image['url'],
                'banner' => isset($ad_image['sizes']['app-banner']) ? $ad_image['sizes']['app-banner'] : $ad_image['url'],
                'inline' => isset($ad_image['sizes']['app-inline']) ? $ad_image['sizes']['app-inline'] : $ad_image['url'],
                'section' => isset($ad_image['sizes']['app-section']) ? $ad_image['sizes']['app-section'] : $ad_image['url'],
                'popup' => isset($ad_image['sizes']['app-popup']) ? $ad_image['sizes']['app-popup'] : $ad_image['url'],
            ),
        );
        
        // 각 슬롯에 광고 추가 (다중 슬롯 지원)
        foreach ($ad_slots_array as $single_slot) {
            if (isset($ads[$single_slot])) {
                $ads[$single_slot][] = $ad_data;
            }
        }
    }
    wp_reset_postdata();
    
    // 각 슬롯별로 우선순위 정렬 (높은 순)
    foreach ($ads as $slot => &$slot_ads) {
        usort($slot_ads, function($a, $b) {
            return $b['priority'] - $a['priority'];
        });
    }
    unset($slot_ads);
    
    // 전체 광고 수 계산
    $total = 0;
    foreach ($ads as $slot_ads) {
        $total += count($slot_ads);
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'data' => $ads,
        'meta' => array(
            'total' => $total,
            'slots' => array_keys($slots),
            'screen' => $screen,
            'version' => CHAOVN_AD_VERSION,
            'generated_at' => current_time('c'),
        ),
    ), 200);
}

// ========================================
// 특정 슬롯 광고 API
// ========================================
function chaovn_get_ads_by_slot(WP_REST_Request $request) {
    $slot = $request->get_param('slot');
    $screen = $request->get_param('screen') ?: 'all';
    $slots = chaovn_get_ad_slots();
    
    if (!isset($slots[$slot])) {
        return new WP_REST_Response(array(
            'success' => false,
            'message' => '유효하지 않은 슬롯입니다: ' . $slot,
            'available_slots' => array_keys($slots),
        ), 400);
    }
    
    // 전체 광고 가져온 후 해당 슬롯만 필터링
    $all_ads = chaovn_get_ads_v2($request);
    $data = $all_ads->get_data();
    
    return new WP_REST_Response(array(
        'success' => true,
        'data' => $data['data'][$slot] ?? array(),
        'slot_info' => $slots[$slot],
        'screen' => $screen,
    ), 200);
}

// ========================================
// 광고 클릭 추적 API
// ========================================
function chaovn_track_ad_click(WP_REST_Request $request) {
    $ad_id = intval($request->get_param('id'));
    
    // 유효성 검사
    if (!$ad_id || get_post_type($ad_id) !== CHAOVN_AD_CPT) {
        return new WP_REST_Response(array(
            'success' => false,
            'message' => '유효하지 않은 광고입니다.',
        ), 400);
    }
    
    // 클릭 수 증가
    $current_clicks = intval(get_field('ad_clicks_count', $ad_id)) ?: 0;
    update_field('ad_clicks_count', $current_clicks + 1, $ad_id);
    
    // 링크 가져오기
    $link = get_field('ad_link', $ad_id);
    
    return new WP_REST_Response(array(
        'success' => true,
        'clicks' => $current_clicks + 1,
        'redirect' => $link ?: 'https://chaovietnam.co.kr',
    ), 200);
}

// ========================================
// 슬롯 정보 API
// ========================================
function chaovn_get_slots_info() {
    return new WP_REST_Response(array(
        'success' => true,
        'slots' => chaovn_get_ad_slots(),
        'screens' => chaovn_get_ad_screens(),
    ), 200);
}

// ========================================
// 디버그 API (v2)
// ========================================
function chaovn_get_ads_debug_v2() {
    $debug = array(
        'version' => CHAOVN_AD_VERSION,
        'cpt_slug' => CHAOVN_AD_CPT,
        'slots' => chaovn_get_ad_slots(),
        'screens' => chaovn_get_ad_screens(),
        'acf_active' => function_exists('get_field'),
        'today' => date('Y-m-d'),
    );
    
    // 모든 광고 포스트 조회 (상태 무관)
    $query = new WP_Query(array(
        'post_type' => CHAOVN_AD_CPT,
        'post_status' => array('publish', 'draft', 'pending'),
        'posts_per_page' => -1,
    ));
    
    $debug['total_ads'] = $query->found_posts;
    $debug['ads'] = array();
    
    while ($query->have_posts()) {
        $query->the_post();
        $post_id = get_the_ID();
        
        $ad_image = get_field('ad_image', $post_id);
        
        $image_data = null;
        if ($ad_image && is_array($ad_image)) {
            $image_data = array(
                'id' => isset($ad_image['ID']) ? $ad_image['ID'] : null,
                'url' => isset($ad_image['url']) ? $ad_image['url'] : null,
                'sizes' => isset($ad_image['sizes']) && is_array($ad_image['sizes']) ? array_keys($ad_image['sizes']) : array(),
            );
        }
        
        $debug['ads'][] = array(
            'id' => $post_id,
            'title' => get_the_title(),
            'status' => get_post_status(),
            'ad_slot' => get_field('ad_slot', $post_id),
            'ad_screen' => get_field('ad_screen', $post_id),
            'ad_link' => get_field('ad_link', $post_id),
            'ad_priority' => get_field('ad_priority', $post_id),
            'ad_active' => get_field('ad_active', $post_id),
            'ad_start_date' => get_field('ad_start_date', $post_id),
            'ad_end_date' => get_field('ad_end_date', $post_id),
            'ad_clicks_count' => get_field('ad_clicks_count', $post_id),
            'ad_image' => $image_data,
        );
    }
    wp_reset_postdata();
    
    return new WP_REST_Response(array(
        'success' => true,
        'debug' => $debug,
        'generated_at' => current_time('c'),
    ), 200);
}

// ========================================
// 관리자 컬럼 추가 (광고 목록에서 정보 표시)
// ========================================
add_filter('manage_' . CHAOVN_AD_CPT . '_posts_columns', function($columns) {
    $new_columns = array();
    foreach ($columns as $key => $value) {
        $new_columns[$key] = $value;
        if ($key === 'title') {
            $new_columns['ad_thumbnail'] = '이미지';
            $new_columns['ad_slot'] = '노출 위치';
            $new_columns['ad_screen'] = '노출 섹션';
            $new_columns['ad_period'] = '게시 기간';
            $new_columns['ad_priority'] = '우선순위';
            $new_columns['ad_clicks'] = '클릭수';
            $new_columns['ad_status'] = '상태';
        }
    }
    return $new_columns;
});

add_action('manage_' . CHAOVN_AD_CPT . '_posts_custom_column', function($column, $post_id) {
    $slots = chaovn_get_ad_slots();
    $screens = chaovn_get_ad_screens();
    
    switch ($column) {
        case 'ad_thumbnail':
            $image = get_field('ad_image', $post_id);
            if ($image && isset($image['sizes']['thumbnail'])) {
                echo '<img src="' . esc_url($image['sizes']['thumbnail']) . '" style="max-width:80px;height:auto;" />';
    } else {
                echo '-';
            }
            break;
            
        case 'ad_slot':
            $slot = get_field('ad_slot', $post_id);
            echo isset($slots[$slot]) ? esc_html($slots[$slot]['label']) : esc_html($slot);
            break;
            
        case 'ad_screen':
            $screen = get_field('ad_screen', $post_id);
            echo isset($screens[$screen]) ? esc_html($screens[$screen]) : esc_html($screen);
            break;
            
        case 'ad_period':
            $start = get_field('ad_start_date', $post_id);
            $end = get_field('ad_end_date', $post_id);
            $start_text = $start ?: '시작일 없음';
            $end_text = $end ?: '종료일 없음';
            echo esc_html($start_text) . '<br>~<br>' . esc_html($end_text);
            break;
            
        case 'ad_priority':
            echo intval(get_field('ad_priority', $post_id)) ?: 10;
            break;
            
        case 'ad_clicks':
            echo number_format(intval(get_field('ad_clicks_count', $post_id)) ?: 0);
            break;
            
        case 'ad_status':
            $active = get_field('ad_active', $post_id);
            $today = date('Y-m-d');
            $start = get_field('ad_start_date', $post_id);
            $end = get_field('ad_end_date', $post_id);
            
            if (!$active) {
                echo '<span style="color:#999;">⏸️ 비활성</span>';
            } elseif ($start && $start > $today) {
                echo '<span style="color:#f39c12;">⏳ 예약</span>';
            } elseif ($end && $end < $today) {
                echo '<span style="color:#e74c3c;">⏹️ 만료</span>';
            } else {
                echo '<span style="color:#27ae60;">✅ 게시중</span>';
            }
            break;
    }
}, 10, 2);

// 컬럼 정렬 가능하게 설정
add_filter('manage_edit-' . CHAOVN_AD_CPT . '_sortable_columns', function($columns) {
    $columns['ad_priority'] = 'ad_priority';
    $columns['ad_clicks'] = 'ad_clicks_count';
    return $columns;
});

// ========================================
// 플러그인 활성화/비활성화
// ========================================
register_activation_hook(__FILE__, function() {
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});
