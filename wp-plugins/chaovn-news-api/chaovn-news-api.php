<?php
/**
 * Plugin Name: ChaoVN News Terminal REST API
 * Plugin URI: https://chaovietnam.co.kr
 * Description: Jenny Daily News 플러그인의 뉴스 데이터를 REST API로 제공합니다. Jenny 플러그인과 함께 사용해야 합니다.
 * Version: 1.0.0
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

/**
 * REST API 엔드포인트 등록
 */
add_action('rest_api_init', function() {
    // 뉴스 터미널 API
    register_rest_route('chaovn/v1', '/news-terminal', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_news_terminal',
        'permission_callback' => '__return_true', // 공개 API
    ));
    
    // 뉴스 터미널 API (날짜 지정)
    register_rest_route('chaovn/v1', '/news-terminal/(?P<date>\d{4}-\d{2}-\d{2})', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_news_terminal',
        'permission_callback' => '__return_true',
    ));
});

/**
 * 뉴스 터미널 데이터 API
 * Jenny 플러그인의 함수들을 활용하여 동일한 데이터를 JSON으로 반환
 */
function chaovn_get_news_terminal($request) {
    // Jenny 플러그인 함수 존재 확인
    if (!function_exists('jenny_get_category_order')) {
        return new WP_REST_Response(array(
            'success' => false,
            'error' => 'Jenny Daily News Display 플러그인이 활성화되어 있지 않습니다.',
        ), 503);
    }
    
    try {
        // 날짜 파라미터 확인
        $date_param = $request->get_param('date');
        $category_id = 31; // 뉴스/데일리뉴스 카테고리
        
        // 베트남 시간대
        $tz = new DateTimeZone('Asia/Ho_Chi_Minh');
        $now = new DateTime('now', $tz);
        
        // 대상 날짜 결정
        if (!empty($date_param) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_param)) {
            $target_date = $date_param;
        } else {
            // 오늘 날짜 또는 최근 발행일
            $target_date = chaovn_get_target_date($now, $category_id);
        }
        
        // 포스트 가져오기
        $result = chaovn_get_posts_by_date($target_date, $category_id);
        
        // 섹션별로 그룹화
        $sections_config = chaovn_get_sections_config();
        
        // 탑뉴스
        $top_news = array();
        $top_count = 0;
        foreach ($result['top_news'] as $post) {
            if ($top_count >= 2) break; // 최대 2개
            $top_news[] = chaovn_format_post($post);
            $top_count++;
        }
        
        // 섹션별 뉴스 그룹화
        $grouped_posts = array();
        foreach ($result['regular'] as $post) {
            $sec_key = chaovn_get_section_key($post['category']);
            if (!isset($grouped_posts[$sec_key])) {
                $grouped_posts[$sec_key] = array();
            }
            $grouped_posts[$sec_key][] = $post;
        }
        
        // 2개 초과 탑뉴스는 해당 섹션으로 이동
        $extra_top_count = 0;
        foreach ($result['top_news'] as $post) {
            $extra_top_count++;
            if ($extra_top_count <= 2) continue;
            
            $sec_key = chaovn_get_section_key($post['category']);
            if (!isset($grouped_posts[$sec_key])) {
                $grouped_posts[$sec_key] = array();
            }
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
                    'key' => $sec_key,
                    'name' => $sec_info['name'],
                    'categoryKey' => $sec_key,
                    'posts' => $posts,
                );
            }
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'date' => $target_date,
            'topNews' => $top_news,
            'newsSections' => $news_sections,
            'totalCount' => count($result['top_news']) + count($result['regular']),
        ), 200);
        
    } catch (Exception $e) {
        return new WP_REST_Response(array(
            'success' => false,
            'error' => $e->getMessage(),
        ), 500);
    }
}

/**
 * 오늘 날짜 또는 최근 발행일 가져오기
 */
function chaovn_get_target_date($now, $category_id) {
    $today = $now->format('Y-m-d');
    
    // 오늘 날짜의 뉴스 확인
    $today_args = array(
        'post_type' => 'post',
        'posts_per_page' => 1,
        'cat' => intval($category_id),
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
        'date_query' => array(
            array(
                'year' => intval($now->format('Y')),
                'month' => intval($now->format('m')),
                'day' => intval($now->format('d')),
            ),
        ),
    );
    
    $today_query = new WP_Query($today_args);
    if ($today_query->have_posts()) {
        wp_reset_postdata();
        return $today;
    }
    wp_reset_postdata();
    
    // 오늘 뉴스가 없으면 가장 최근 발행일
    $latest_args = array(
        'post_type' => 'post',
        'posts_per_page' => 1,
        'cat' => intval($category_id),
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
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

/**
 * 특정 날짜의 포스트 가져오기
 */
function chaovn_get_posts_by_date($date, $category_id) {
    $date_parts = explode('-', $date);
    
    $args = array(
        'post_type' => 'post',
        'posts_per_page' => -1,
        'cat' => intval($category_id),
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
        'date_query' => array(
            array(
                'year' => intval($date_parts[0]),
                'month' => intval($date_parts[1]),
                'day' => intval($date_parts[2]),
            ),
        ),
    );
    
    $query = new WP_Query($args);
    $top_news_posts = array();
    $regular_posts = array();
    $processed_ids = array();
    
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $post_id = get_the_ID();
            
            // 중복 방지
            if (in_array($post_id, $processed_ids)) {
                continue;
            }
            $processed_ids[] = $post_id;
            
            // 카테고리 가져오기
            $news_category = get_post_meta($post_id, 'news_category', true);
            if (empty($news_category)) {
                $categories = get_the_category($post_id);
                $news_category = !empty($categories) ? $categories[0]->name : '기타';
            }
            
            // 탑뉴스 여부
            $is_top_raw = get_post_meta($post_id, 'is_top_news', true);
            $is_top = ($is_top_raw === '1' || $is_top_raw === 1 || $is_top_raw === true);
            
            $item = array(
                'post_id' => $post_id,
                'category' => trim($news_category),
                'is_top' => $is_top,
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
        'regular' => $regular_posts,
    );
}

/**
 * 포스트 데이터 포맷팅
 */
function chaovn_format_post($post_data) {
    $post_id = $post_data['post_id'];
    $post_obj = get_post($post_id);
    
    // 썸네일
    $thumbnail = get_the_post_thumbnail_url($post_id, 'medium_large');
    if (empty($thumbnail)) {
        $thumbnail = '';
    }
    
    // 요약문
    $excerpt = get_post_meta($post_id, 'news_summary', true);
    if (empty($excerpt)) {
        $excerpt = trim($post_obj->post_excerpt);
    }
    if (empty($excerpt)) {
        $content = strip_tags($post_obj->post_content);
        $excerpt = wp_trim_words($content, 50, '...');
    }
    
    // 출처
    $source = get_post_meta($post_id, 'news_source', true);
    if (empty($source)) {
        $categories = get_the_category($post_id);
        $source = !empty($categories) ? $categories[0]->name : '';
    }
    
    // 카테고리 표시명
    $category_display = chaovn_get_category_display_name($post_data['category']);
    
    return array(
        'id' => $post_id,
        'title' => array('rendered' => get_the_title($post_id)),
        'excerpt' => $excerpt,
        'thumbnail' => $thumbnail,
        'link' => get_permalink($post_id),
        'date' => get_the_date('Y.m.d', $post_id),
        'dateISO' => get_the_date('c', $post_id),
        'category' => $category_display,
        'categoryKey' => $post_data['category'],
        'source' => $source,
        'originalUrl' => get_post_meta($post_id, 'news_original_url', true),
        'isTop' => $post_data['is_top'],
        'meta' => array(
            'news_category' => $post_data['category'],
            'is_top_news' => $post_data['is_top'] ? '1' : '',
        ),
    );
}

/**
 * 섹션 설정
 */
function chaovn_get_sections_config() {
    return array(
        'economy' => array('name' => '경제', 'keys' => array('Economy', '경제')),
        'society' => array('name' => '사회', 'keys' => array('Society', '사회')),
        'culture' => array('name' => '문화/스포츠', 'keys' => array('Culture', '문화')),
        'real_estate' => array('name' => '부동산', 'keys' => array('Real Estate', '부동산')),
        'politics' => array('name' => '정치/정책', 'keys' => array('Politics', 'Policy', '정치', '정책')),
        'international' => array('name' => '국제', 'keys' => array('International', '국제')),
        'korea_vietnam' => array('name' => '한-베', 'keys' => array('Korea-Vietnam', '한-베', '한베')),
        'community' => array('name' => '교민소식', 'keys' => array('Community', '교민', '교민소식')),
        'travel' => array('name' => '여행', 'keys' => array('Travel', '여행')),
        'health' => array('name' => '건강', 'keys' => array('Health', '건강')),
        'food' => array('name' => '음식', 'keys' => array('Food', '음식')),
        'other' => array('name' => '기타', 'keys' => array('Other', '기타')),
    );
}

/**
 * 카테고리를 섹션 키로 변환
 */
function chaovn_get_section_key($category) {
    $sections = chaovn_get_sections_config();
    $cat = trim($category);
    
    foreach ($sections as $sec_key => $sec_info) {
        if (in_array($cat, $sec_info['keys'], true)) {
            return $sec_key;
        }
        foreach ($sec_info['keys'] as $key) {
            if (strcasecmp($cat, $key) === 0) {
                return $sec_key;
            }
        }
    }
    return 'other';
}

/**
 * 카테고리 표시명 변환
 */
function chaovn_get_category_display_name($category) {
    $map = array(
        'Society' => '사회', '사회' => '사회',
        'Economy' => '경제', '경제' => '경제',
        'Culture' => '문화/스포츠', '문화' => '문화/스포츠',
        'Real Estate' => '부동산', '부동산' => '부동산',
        'Politics' => '정치/정책', 'Policy' => '정치/정책',
        '정치' => '정치/정책', '정책' => '정치/정책',
        'International' => '국제', '국제' => '국제',
        'Korea-Vietnam' => '한-베', '한-베' => '한-베', '한베' => '한-베',
        'Community' => '교민소식', '교민' => '교민소식', '교민소식' => '교민소식',
        'Travel' => '여행', '여행' => '여행',
        'Health' => '건강', '건강' => '건강',
        'Food' => '음식', '음식' => '음식',
        'Other' => '기타', '기타' => '기타',
    );
    
    $cat = trim($category);
    if (isset($map[$cat])) {
        return $map[$cat];
    }
    
    foreach ($map as $key => $value) {
        if (strcasecmp($cat, $key) === 0) {
            return $value;
        }
    }
    
    return $cat;
}

/**
 * 플러그인 활성화 시
 */
register_activation_hook(__FILE__, function() {
    flush_rewrite_rules();
});

/**
 * 플러그인 비활성화 시
 */
register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});
