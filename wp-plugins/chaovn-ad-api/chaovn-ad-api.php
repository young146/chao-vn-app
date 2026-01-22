<?php
/**
 * Plugin Name: ChaoVN Ad API
 * Plugin URI: https://chaovietnam.co.kr
 * Description: Ad Inserter 광고 데이터를 REST API로 노출하여 모바일 앱에서 사용할 수 있게 합니다.
 * Version: 1.1.0
 * Author: ChaoVietnam
 * Author URI: https://chaovietnam.co.kr
 * License: GPL v2 or later
 * Text Domain: chaovn-ad-api
 */

// 직접 접근 방지
if (!defined('ABSPATH')) {
    exit;
}

/**
 * REST API 엔드포인트 등록
 */
add_action('rest_api_init', function () {
    // 광고 목록 가져오기 (공개)
    register_rest_route('chaovn/v1', '/ads', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_ads',
        'permission_callback' => '__return_true',
    ));
    
    // 디버그용 - Ad Inserter 원본 데이터 확인 (관리자 전용)
    register_rest_route('chaovn/v1', '/ads/debug', array(
        'methods' => 'GET',
        'callback' => 'chaovn_get_ads_debug',
        'permission_callback' => function() {
            return current_user_can('administrator');
        },
    ));
});

/**
 * Ad Inserter 광고 데이터 가져오기
 */
function chaovn_get_ads() {
    $ads = array(
        'banner' => array(),
        'inline' => array(),
        'section' => array(),
    );
    
    // Ad Inserter 메인 옵션 가져오기
    $ai_options = chaovn_get_ad_inserter_options();
    
    if (empty($ai_options)) {
        return new WP_REST_Response(array(
            'success' => true,
            'data' => $ads,
            'meta' => array(
                'total' => 0,
                'message' => 'Ad Inserter 데이터를 찾을 수 없습니다. 디버그 API로 확인해주세요.',
                'generated_at' => current_time('c'),
            ),
        ), 200);
    }
    
    // Ad Inserter는 1-16번 블록까지 지원 (Pro는 96개)
    $max_blocks = 16;
    if (defined('AD_INSERTER_PRO') && AD_INSERTER_PRO) {
        $max_blocks = 96;
    }
    
    for ($i = 1; $i <= $max_blocks; $i++) {
        $ad_data = chaovn_extract_block_data($ai_options, $i);
        
        if ($ad_data && !empty($ad_data['imageUrl'])) {
            $position = chaovn_determine_position($ad_data['name'], $i);
            $ads[$position][] = $ad_data;
        }
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'data' => $ads,
        'meta' => array(
            'total' => count($ads['banner']) + count($ads['inline']) + count($ads['section']),
            'generated_at' => current_time('c'),
        ),
    ), 200);
}

/**
 * Ad Inserter 옵션 가져오기 (여러 저장 방식 지원)
 */
function chaovn_get_ad_inserter_options() {
    // 방법 1: Ad Inserter 메인 옵션
    $options = get_option('ad_inserter');
    
    if (!empty($options)) {
        // 문자열인 경우 파싱
        if (is_string($options)) {
            $parsed = chaovn_parse_ad_inserter_data($options);
            if ($parsed !== null) {
                return $parsed;
            }
        }
        
        // 이미 배열이면 그대로 반환
        if (is_array($options)) {
            return $options;
        }
    }
    
    // 방법 2: ai_options
    $options = get_option('ai_options');
    if (!empty($options)) {
        if (is_string($options)) {
            $parsed = chaovn_parse_ad_inserter_data($options);
            if ($parsed !== null) {
                return $parsed;
            }
        }
        if (is_array($options)) {
            return $options;
        }
    }
    
    return null;
}

/**
 * Ad Inserter 데이터 파싱 (AI: 접두사 + base64 + serialize 처리)
 */
function chaovn_parse_ad_inserter_data($data) {
    if (empty($data) || !is_string($data)) {
        return null;
    }
    
    // BOM 및 공백 제거
    $data = trim($data);
    $data = preg_replace('/^\xEF\xBB\xBF/', '', $data); // UTF-8 BOM 제거
    
    // "AI:" 찾아서 제거 (위치 상관없이)
    $ai_pos = strpos($data, 'AI:');
    if ($ai_pos !== false) {
        $data = substr($data, $ai_pos + 3);
    }
    
    // base64 디코딩 시도
    $decoded = base64_decode($data, true);
    if ($decoded !== false && !empty($decoded)) {
        // 역직렬화
        $unserialized = @unserialize($decoded);
        if ($unserialized !== false && is_array($unserialized)) {
            return $unserialized;
        }
    }
    
    // 직접 역직렬화 시도
    $unserialized = @unserialize($data);
    if ($unserialized !== false && is_array($unserialized)) {
        return $unserialized;
    }
    
    return null;
}

/**
 * 디버깅용 - 파싱 단계별 결과 확인
 */
function chaovn_debug_parse_steps($data) {
    $result = array(
        'original_length' => strlen($data),
        'first_10_chars' => substr($data, 0, 10),
        'first_10_hex' => bin2hex(substr($data, 0, 10)),
    );
    
    // BOM 및 공백 제거
    $data = trim($data);
    $data = preg_replace('/^\xEF\xBB\xBF/', '', $data);
    $result['after_trim_length'] = strlen($data);
    
    // AI: 위치 찾기
    $ai_pos = strpos($data, 'AI:');
    $result['AI_position'] = $ai_pos;
    
    // AI: 제거
    if ($ai_pos !== false) {
        $data = substr($data, $ai_pos + 3);
        $result['after_remove_AI_length'] = strlen($data);
        $result['data_start_after_AI'] = substr($data, 0, 30);
    }
    
    // base64 디코딩
    $decoded = base64_decode($data, true);
    $result['base64_decode_success'] = ($decoded !== false && !empty($decoded));
    $result['decoded_length'] = $decoded !== false ? strlen($decoded) : 0;
    $result['decoded_preview'] = $decoded !== false ? substr($decoded, 0, 100) : null;
    
    // 역직렬화
    if ($decoded !== false && !empty($decoded)) {
        $unserialized = @unserialize($decoded);
        $result['unserialize_success'] = ($unserialized !== false);
        $result['unserialize_type'] = $unserialized !== false ? gettype($unserialized) : null;
        $result['unserialize_count'] = is_array($unserialized) ? count($unserialized) : null;
        $result['unserialize_keys_sample'] = is_array($unserialized) ? array_slice(array_keys($unserialized), 0, 10) : null;
    }
    
    return $result;
}

/**
 * Ad Inserter 블록 데이터 추출
 */
function chaovn_extract_block_data($options, $block_number) {
    if (!is_array($options)) {
        return null;
    }
    
    // Ad Inserter 데이터 구조 접근
    // 구조 1: $options[$block_number] 직접 접근
    // 구조 2: $options['block'][$block_number]
    // 구조 3: $options["BLOCK_{$block_number}"]
    
    $block_data = null;
    
    // 시도 1: 직접 인덱스
    if (isset($options[$block_number])) {
        $block_data = $options[$block_number];
    }
    // 시도 2: 문자열 인덱스
    elseif (isset($options["$block_number"])) {
        $block_data = $options["$block_number"];
    }
    // 시도 3: BLOCK_ 접두사
    elseif (isset($options["BLOCK_{$block_number}"])) {
        $block_data = $options["BLOCK_{$block_number}"];
    }
    // 시도 4: block 배열
    elseif (isset($options['block'][$block_number])) {
        $block_data = $options['block'][$block_number];
    }
    
    if (empty($block_data)) {
        return null;
    }
    
    // 문자열인 경우 (직접 코드가 저장된 경우)
    if (is_string($block_data)) {
        $ad_code = $block_data;
        $ad_name = "Ad Block {$block_number}";
    }
    // 배열인 경우
    elseif (is_array($block_data)) {
        // Ad Inserter 옵션 키 매핑 (여러 가능한 키 시도)
        $possible_code_keys = array('code', 'ad', 'ad_code', 'content', 'html', 'CODE');
        $possible_name_keys = array('name', 'block_name', 'title', 'NAME');
        
        $ad_code = '';
        $ad_name = "Ad Block {$block_number}";
        
        foreach ($possible_code_keys as $key) {
            if (!empty($block_data[$key])) {
                $ad_code = $block_data[$key];
                break;
            }
        }
        
        foreach ($possible_name_keys as $key) {
            if (!empty($block_data[$key])) {
                $ad_name = $block_data[$key];
                break;
            }
        }
        
        // 비활성화된 블록 체크
        $disable_keys = array('display_type', 'enabled', 'disable', 'DISABLE_INSERTION');
        foreach ($disable_keys as $key) {
            if (isset($block_data[$key])) {
                $val = $block_data[$key];
                // display_type == 0 또는 enabled == false 또는 disable == true
                if ($val === 0 || $val === '0' || $val === false || $val === 'false' || 
                    ($key === 'disable' && ($val === true || $val === '1' || $val === 1))) {
                    return null;
                }
            }
        }
    }
    else {
        return null;
    }
    
    if (empty($ad_code)) {
        return null;
    }
    
    // HTML에서 이미지/링크 추출
    $image_url = chaovn_extract_image_url($ad_code);
    $link_url = chaovn_extract_link_url($ad_code);
    
    if (empty($image_url)) {
        return null;
    }
    
    return array(
        'id' => $block_number,
        'name' => $ad_name,
        'imageUrl' => $image_url,
        'linkUrl' => !empty($link_url) ? $link_url : 'https://chaovietnam.co.kr',
    );
}

/**
 * HTML에서 이미지 URL 추출
 */
function chaovn_extract_image_url($html) {
    if (empty($html) || !is_string($html)) {
        return '';
    }
    
    // 1. img 태그에서 src 추출
    if (preg_match('/<img[^>]+src=["\']([^"\']+)["\'][^>]*>/i', $html, $matches)) {
        return esc_url($matches[1]);
    }
    
    // 2. background-image에서 URL 추출
    if (preg_match('/background(?:-image)?\s*:\s*url\(["\']?([^"\')\s]+)["\']?\)/i', $html, $matches)) {
        return esc_url($matches[1]);
    }
    
    // 3. srcset에서 첫 번째 이미지 추출
    if (preg_match('/srcset=["\']([^\s"\']+)/i', $html, $matches)) {
        return esc_url($matches[1]);
    }
    
    // 4. data-src (lazy loading) 추출
    if (preg_match('/data-src=["\']([^"\']+)["\']/', $html, $matches)) {
        return esc_url($matches[1]);
    }
    
    // 5. 직접 이미지 URL 찾기
    if (preg_match('/(https?:\/\/[^\s"\'<>]+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?[^\s"\'<>]*)?)/i', $html, $matches)) {
        return esc_url($matches[1]);
    }
    
    return '';
}

/**
 * HTML에서 링크 URL 추출 (외부 링크 우선)
 */
function chaovn_extract_link_url($html) {
    if (empty($html) || !is_string($html)) {
        return '';
    }
    
    // 모든 a 태그의 href 추출
    preg_match_all('/<a[^>]+href=["\']([^"\']+)["\'][^>]*>/i', $html, $matches);
    
    $found_urls = isset($matches[1]) ? $matches[1] : array();
    
    // 외부 링크 우선 (chaovietnam.co.kr이 아닌 링크)
    foreach ($found_urls as $url) {
        if (chaovn_is_valid_ad_link($url) && strpos($url, 'chaovietnam.co.kr') === false) {
            return esc_url($url);
        }
    }
    
    // 외부 링크가 없으면 첫 번째 유효한 링크 반환
    foreach ($found_urls as $url) {
        if (chaovn_is_valid_ad_link($url)) {
            return esc_url($url);
        }
    }
    
    // onclick 이벤트에서 URL 추출
    if (preg_match('/(?:window\.open|location\.href)\s*[\(=]\s*["\']([^"\']+)["\']/i', $html, $matches)) {
        if (chaovn_is_valid_ad_link($matches[1])) {
            return esc_url($matches[1]);
        }
    }
    
    // data-href 속성에서 추출
    if (preg_match('/data-(?:href|url|link)=["\']([^"\']+)["\']/i', $html, $matches)) {
        if (chaovn_is_valid_ad_link($matches[1])) {
            return esc_url($matches[1]);
        }
    }
    
    return '';
}

/**
 * 유효한 광고 링크인지 확인
 */
function chaovn_is_valid_ad_link($url) {
    if (empty($url)) {
        return false;
    }
    
    // http로 시작해야 함
    if (strpos($url, 'http') !== 0) {
        return false;
    }
    
    // 이미지 파일은 제외
    if (preg_match('/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i', $url)) {
        return false;
    }
    
    // javascript: 링크 제외
    if (strpos($url, 'javascript:') !== false) {
        return false;
    }
    
    return true;
}

/**
 * 블록 이름/번호로 광고 위치 결정
 */
function chaovn_determine_position($name, $block_number) {
    $name_lower = strtolower($name);
    
    // 이름에 키워드가 포함된 경우
    $banner_keywords = array('banner', '배너', 'header', 'top', '상단');
    $inline_keywords = array('inline', '인라인', 'middle', 'content', '중간', '콘텐츠');
    $section_keywords = array('section', '섹션', 'footer', 'bottom', '하단', 'sidebar');
    
    foreach ($banner_keywords as $keyword) {
        if (strpos($name_lower, $keyword) !== false) {
            return 'banner';
        }
    }
    
    foreach ($inline_keywords as $keyword) {
        if (strpos($name_lower, $keyword) !== false) {
            return 'inline';
        }
    }
    
    foreach ($section_keywords as $keyword) {
        if (strpos($name_lower, $keyword) !== false) {
            return 'section';
        }
    }
    
    // 이름에 키워드가 없으면 블록 번호로 결정
    // 1-5: banner, 6-10: inline, 11+: section
    if ($block_number <= 5) {
        return 'banner';
    } elseif ($block_number <= 10) {
        return 'inline';
    } else {
        return 'section';
    }
}

/**
 * 디버그용 - Ad Inserter 원본 데이터 확인
 */
function chaovn_get_ads_debug() {
    $debug_data = array(
        'plugin_version' => '1.3.0',  // 버전 확인용
        'step1_raw_option' => array(),
        'step1b_parse_steps' => array(),
        'step2_after_parse' => array(),
        'step3_extracted_ads' => array(),
    );
    
    // Step 1: 원본 옵션 확인
    $raw_option = get_option('ad_inserter');
    $debug_data['step1_raw_option'] = array(
        'exists' => ($raw_option !== false),
        'type' => gettype($raw_option),
        'length' => is_string($raw_option) ? strlen($raw_option) : null,
        'preview' => is_string($raw_option) ? substr($raw_option, 0, 300) : null,
    );
    
    // Step 1b: 파싱 단계별 디버깅
    if (is_string($raw_option)) {
        $debug_data['step1b_parse_steps'] = chaovn_debug_parse_steps($raw_option);
    }
    
    // Step 2: 파싱 후 확인
    $parsed_options = chaovn_get_ad_inserter_options();
    if ($parsed_options && is_array($parsed_options)) {
        $debug_data['step2_after_parse'] = array(
            'success' => true,
            'type' => 'array',
            'count' => count($parsed_options),
            'keys' => array_keys($parsed_options),
            'sample_keys' => array_slice(array_keys($parsed_options), 0, 20),
        );
        
        // 블록 1-16의 데이터 구조 확인
        for ($i = 1; $i <= 16; $i++) {
            $block_key = null;
            
            // 여러 가능한 키 형태 확인
            if (isset($parsed_options[$i])) {
                $block_key = $i;
            } elseif (isset($parsed_options["$i"])) {
                $block_key = "$i";
            } elseif (isset($parsed_options["block_$i"])) {
                $block_key = "block_$i";
            } elseif (isset($parsed_options["BLOCK_$i"])) {
                $block_key = "BLOCK_$i";
            }
            
            if ($block_key !== null) {
                $block_data = $parsed_options[$block_key];
                $debug_data['step2_after_parse']["block_{$i}_info"] = array(
                    'key_used' => $block_key,
                    'type' => gettype($block_data),
                    'is_array' => is_array($block_data),
                    'keys' => is_array($block_data) ? array_keys($block_data) : null,
                    'code_preview' => is_array($block_data) && isset($block_data['code']) 
                        ? substr($block_data['code'], 0, 300) 
                        : (is_string($block_data) ? substr($block_data, 0, 300) : null),
                );
            }
        }
    } else {
        $debug_data['step2_after_parse'] = array(
            'success' => false,
            'parsed_result' => $parsed_options,
        );
    }
    
    // Step 3: 광고 추출 결과
    for ($i = 1; $i <= 16; $i++) {
        $block_data = chaovn_extract_block_data($parsed_options, $i);
        if ($block_data) {
            $debug_data['step3_extracted_ads']["block_{$i}"] = $block_data;
        }
    }
    
    // DB에서 관련 옵션 목록
    global $wpdb;
    $db_options = $wpdb->get_results(
        "SELECT option_name, LENGTH(option_value) as value_length 
         FROM {$wpdb->options} 
         WHERE option_name LIKE 'ad_inserter%' 
            OR option_name LIKE 'ai_%'
         ORDER BY option_name 
         LIMIT 30",
        ARRAY_A
    );
    $debug_data['db_options'] = $db_options;
    
    return new WP_REST_Response(array(
        'success' => true,
        'debug' => $debug_data,
        'generated_at' => current_time('c'),
    ), 200);
}

/**
 * 플러그인 활성화 시 실행
 */
register_activation_hook(__FILE__, function() {
    flush_rewrite_rules();
});

/**
 * 플러그인 비활성화 시 실행
 */
register_deactivation_hook(__FILE__, function() {
    flush_rewrite_rules();
});
