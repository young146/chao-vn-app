<?php
/**
 * Plugin Name: ChaoVN SEO Boost
 * Plugin URI: https://chaovietnam.co.kr
 * Description: Rank Math 가 채우지 못하는 두 구멍을 메운다 — (1) 구글 뉴스 전용 사이트맵, (2) 데일리 뉴스의 "편집부 번역·정리" 표기, (3) 구조화 데이터에 원문 출처 신고, (4) 탐색경로가 하위 카테고리까지 내려가게.
 *              Rank Math 를 대체하지 않는다. Rank Math 가 하는 일(title/description/canonical/구조화데이터)은 건드리지 않는다.
 * Version: 1.0.4
 * Author: Chao Vietnam Team
 * License: GPL v2 or later
 *
 * ⚠️ 이 플러그인은 Rank Math 와 *함께* 동작한다. Rank Math 를 끄지 말 것.
 */

if (!defined('ABSPATH')) {
    exit;
}

// 데일리 뉴스 카테고리. chaovn-news-api 와 같은 값이어야 한다.
// 상수가 이미 정의돼 있으면(= 뉴스 API 플러그인이 먼저 로드됐으면) 그것을 따른다 —
// 같은 숫자를 두 곳에 적으면 한쪽만 바뀌었을 때 반드시 어긋난다.
if (!defined('CHAOVN_NEWS_CAT_ID')) {
    define('CHAOVN_NEWS_CAT_ID', 31);
}

define('CHAOVN_SEO_VER', '1.0.4');

// ============================================================
// 1) 구글 뉴스 사이트맵  —  /news-sitemap.xml
// ------------------------------------------------------------
// 왜 필요한가 (2026-08-08 실측):
//   이 사이트는 데일리 뉴스를 하루 약 47건 발행한다(최근 30일 1,439건 중 1,399건).
//   그런데 뉴스 전용 사이트맵이 없었다(/news-sitemap.xml → 404).
//   Rank Math 무료판은 일반 사이트맵(sitemap_index.xml)만 만들고 뉴스 사이트맵은
//   유료 애드온(News SEO)에서만 제공한다.
//
// 일반 사이트맵과 뭐가 다른가:
//   일반 사이트맵 = "이런 페이지들이 있습니다" (색인용, 며칠~몇 주 단위)
//   뉴스 사이트맵 = "지금 막 나온 속보입니다"  (구글 '주요 뉴스' 노출 후보, 분 단위)
//   구글은 뉴스 사이트맵을 훨씬 자주 확인한다. 속보성 기사가 '주요 뉴스(Top stories)'
//   카드에 뜨려면 이 경로가 사실상 전제다.
//
// 구글 규격상의 제약 (지어낸 게 아니라 구글 문서의 조건이다):
//   · 발행 후 48시간 이내 기사만 넣는다. 오래된 걸 넣으면 사이트맵 전체가 무시된다.
//   · 최대 1,000건. 우리는 이틀치 ≈ 95건이라 여유롭다.
// ============================================================

define('CHAOVN_NEWS_SITEMAP_SLUG', 'news-sitemap.xml');
define('CHAOVN_NEWS_SITEMAP_HOURS', 48);   // 구글 규격: 48시간
define('CHAOVN_NEWS_SITEMAP_MAX', 1000);   // 구글 규격: 1,000건
define('CHAOVN_NEWS_SITEMAP_CACHE', 'chaovn_news_sitemap_v1');
define('CHAOVN_NEWS_SITEMAP_TTL', 10 * MINUTE_IN_SECONDS);

// 매체명·언어는 구글 뉴스 등록 정보와 일치해야 한다.
define('CHAOVN_PUBLICATION_NAME', 'Xin Chao Vietnam');
define('CHAOVN_PUBLICATION_LANG', 'ko');

add_action('init', 'chaovn_seo_add_rewrite');
function chaovn_seo_add_rewrite() {
    add_rewrite_rule('^' . CHAOVN_NEWS_SITEMAP_SLUG . '$', 'index.php?chaovn_news_sitemap=1', 'top');
}

add_filter('query_vars', 'chaovn_seo_query_vars');
function chaovn_seo_query_vars($vars) {
    $vars[] = 'chaovn_news_sitemap';
    return $vars;
}

/**
 * 리라이트 규칙을 "필요할 때 딱 한 번" 다시 만든다 — 자가 치유.
 *
 * 왜 필요한가 (2026-08-08 실물에서 터짐):
 *   register_activation_hook 안에서 flush 하는 정석 방식이 이 사이트에서 안 먹었다.
 *   활성화 요청 시점에는 워드프레스의 주소 해석 단계(init)가 이미 지나간 뒤라,
 *   방금 include 된 플러그인의 규칙이 표에 반영되지 않는다.
 *   → 결과: 플러그인은 정상 동작(/?chaovn_news_sitemap=1 = 200)하는데
 *          /news-sitemap.xml 만 404. 원인 찾기가 유난히 헷갈리는 실패 모양이다.
 *
 * 그래서 활성화 훅에 기대지 않고, 부팅 때마다 "내 버전으로 플러시했는가"를 확인한다.
 * 한 번 하고 나면 옵션에 기록되므로 이후 요청에는 아무 비용도 없다.
 *
 * ⚠️ flush_rewrite_rules(false) — hard=false 로 부른다.
 *    true 면 .htaccess 를 다시 쓰는데, 이 서버 .htaccess 에는 LiteSpeed 규칙이 들어 있다.
 *    사이트맵 하나 만들자고 캐시 설정을 건드릴 이유가 없다.
 */
add_action('init', 'chaovn_seo_maybe_flush', 99);
function chaovn_seo_maybe_flush() {
    if (get_option('chaovn_seo_rewrite_ver') === CHAOVN_SEO_VER) return;
    flush_rewrite_rules(false);
    update_option('chaovn_seo_rewrite_ver', CHAOVN_SEO_VER, false);
}

/**
 * 안전망 — 리라이트 규칙이 없어도 /news-sitemap.xml 이 동작하게 한다.
 *
 * 위의 자가 치유가 어떤 이유로든(캐시 플러그인, 다른 플러그인의 규칙 선점 등) 실패해도
 * 사이트맵은 나와야 한다. 주소를 직접 읽어 처리하므로 워드프레스 규칙표와 무관하다.
 * 규칙표가 정상이면 이쪽이 먼저 잡고 끝내므로 결과는 같다 — 중복 출력은 없다.
 */
add_action('parse_request', 'chaovn_seo_catch_news_sitemap', 0);
function chaovn_seo_catch_news_sitemap() {
    if (empty($_SERVER['REQUEST_URI'])) return;
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (!$path) return;
    if (strtolower(trim($path, '/')) !== CHAOVN_NEWS_SITEMAP_SLUG) return;
    chaovn_seo_render_news_sitemap(true);
}

add_action('template_redirect', 'chaovn_seo_render_news_sitemap');
function chaovn_seo_render_news_sitemap($forced = false) {
    if (!$forced && !get_query_var('chaovn_news_sitemap')) return;

    $xml = get_transient(CHAOVN_NEWS_SITEMAP_CACHE);
    if ($xml === false) {
        $xml = chaovn_seo_build_news_sitemap();
        // 빈 결과를 캐시하면 10분 동안 빈 사이트맵이 나간다 — 내용이 있을 때만 저장한다.
        if (strlen($xml) > 300) {
            set_transient(CHAOVN_NEWS_SITEMAP_CACHE, $xml, CHAOVN_NEWS_SITEMAP_TTL);
        }
    }

    // LiteSpeed 가 이 주소를 캐시하지 못하게 막는다.
    //
    // 왜 (2026-08-08 실물에서 물림): 뉴스 사이트맵은 하루 47건이 들고 나므로 30분만 묵어도
    // 거짓말이 된다 — '속보 목록'인데 속보가 아니게 된다. 그런데 LiteSpeed 는 이 주소를
    // 다른 페이지처럼 통째로 캐시하고, 심지어 **플러그인을 켜기 전의 404 응답까지** 붙들고 있었다.
    // (관리자는 로그인 상태라 캐시를 건너뛰어 정상으로 보이고, 구글봇만 404 를 받는 상태가 됐다)
    //
    // 부하 걱정은 없다 — 바로 위 transient 가 10분 캐시를 이미 담당한다.
    // LiteSpeed 가 없는 환경이면 이 액션은 아무 일도 하지 않는다.
    do_action('litespeed_control_set_nocache', 'chaovn news sitemap must stay fresh');
    nocache_headers();

    // 브라우저·크롤러가 XML 로 읽게 한다. HTML 로 나가면 구글이 파싱을 포기한다.
    header('Content-Type: application/xml; charset=UTF-8', true, 200);
    header('X-Robots-Tag: noindex', true); // 사이트맵 자체는 검색결과에 뜰 필요가 없다
    echo $xml;
    exit;
}

function chaovn_seo_build_news_sitemap() {
    $q = new WP_Query(array(
        'post_type'      => 'post',
        'post_status'    => 'publish',
        'posts_per_page' => CHAOVN_NEWS_SITEMAP_MAX,
        'cat'            => CHAOVN_NEWS_CAT_ID, // 하위 카테고리 자동 포함
        'orderby'        => 'date',
        'order'          => 'DESC',
        'no_found_rows'  => true,
        'ignore_sticky_posts' => true,
        'date_query'     => array(
            array('after' => CHAOVN_NEWS_SITEMAP_HOURS . ' hours ago'),
        ),
    ));

    $out  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $out .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
    $out .= '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' . "\n";

    while ($q->have_posts()) {
        $q->the_post();
        $pid = get_the_ID();

        // noindex 로 지정된 글은 사이트맵에 넣지 않는다.
        // 넣으면 구글에 "색인해달라"와 "색인하지 마라"를 동시에 보내는 모순이 된다.
        $robots = get_post_meta($pid, 'rank_math_robots', true);
        if (is_array($robots) && in_array('noindex', $robots, true)) continue;

        $out .= "  <url>\n";
        $out .= '    <loc>' . esc_url(get_permalink($pid)) . "</loc>\n";
        $out .= "    <news:news>\n";
        $out .= "      <news:publication>\n";
        $out .= '        <news:name>' . esc_html(CHAOVN_PUBLICATION_NAME) . "</news:name>\n";
        $out .= '        <news:language>' . esc_html(CHAOVN_PUBLICATION_LANG) . "</news:language>\n";
        $out .= "      </news:publication>\n";
        // W3C 형식(예: 2026-08-08T09:03:00+07:00). get_the_date('c') 가 그대로 그 형식이다.
        $out .= '      <news:publication_date>' . esc_html(get_the_date('c', $pid)) . "</news:publication_date>\n";
        $out .= '      <news:title>' . esc_html(html_entity_decode(get_the_title($pid), ENT_QUOTES, 'UTF-8')) . "</news:title>\n";
        $out .= "    </news:news>\n";
        $out .= "  </url>\n";
    }
    wp_reset_postdata();

    $out .= '</urlset>';
    return $out;
}

// 뉴스가 발행되면 사이트맵 캐시를 즉시 버린다. 속보인데 10분 기다릴 이유가 없다.
add_action('publish_post', 'chaovn_seo_purge_news_sitemap');
function chaovn_seo_purge_news_sitemap($post_id) {
    if (!chaovn_seo_is_news_post($post_id)) return;
    delete_transient(CHAOVN_NEWS_SITEMAP_CACHE);
}

/**
 * robots.txt 에 뉴스 사이트맵 줄을 더한다.
 *
 * ⚠️ Rank Math 에서 robots.txt 를 직접 편집해 두면 이 필터가 안 먹을 수 있다.
 *    그때는 Rank Math → 일반 설정 → Robots.txt 편집 에 직접 한 줄 넣어야 한다.
 *    (사이트맵은 Search Console 에 직접 제출하는 것이 정식 경로이므로, 이건 보조 수단이다)
 */
add_filter('robots_txt', 'chaovn_seo_robots_txt', 20, 2);
function chaovn_seo_robots_txt($output, $public) {
    if (!$public) return $output;
    $line = 'Sitemap: ' . home_url('/' . CHAOVN_NEWS_SITEMAP_SLUG);
    if (strpos($output, CHAOVN_NEWS_SITEMAP_SLUG) === false) {
        $output .= "\n" . $line . "\n";
    }
    return $output;
}

// ============================================================
// 2) 데일리 뉴스에 "편집부 번역·정리" 표기
// ------------------------------------------------------------
// 왜 필요한가 — 이게 이 플러그인의 진짜 목적이다:
//   구글은 2024년 3월 스팸정책에 '대규모 콘텐츠 남용(scaled content abuse)'을 신설했고,
//   **자동 번역된 페이지**를 위반 예시로 명시했다. 2026년 3월 코어 업데이트가 이를 정조준했다.
//   이 사이트는 최근 30일 발행분의 97%가 베트남 매체 번역 기사다 — 자동 탐지기 눈에는
//   정확히 그 패턴의 모양을 하고 있다.
//
//   구글이 봐주는 기준은 "자동화 여부"가 아니라 **부가가치가 있는가**이다.
//   씬짜오베트남에는 부가가치가 실제로 있다(베트남어를 못 읽는 한인 독자를 위한
//   선별·번역·분류, 25년 역사의 실존 매체). 문제는 그게 **페이지에 안 적혀 있어서
//   크롤러 눈에 안 보인다**는 것이다. 크롤러는 회사 역사를 모른다. 적힌 것만 본다.
//
// 무엇을 하는가:
//   이미 본문에 들어있는 출처 상자(.news-source-header — 출처/날짜/원문보기)에
//   "씬짜오베트남 편집부 번역·정리" 한 줄을 얹는다. 출처 상자가 없는 옛 글은
//   메타(news_source / news_original_url)로 상자를 통째로 만들어 준다.
//
// 왜 발행 파이프라인이 아니라 여기서 하는가:
//   파이프라인을 고치면 *앞으로 나올 글*만 바뀐다. 이미 쌓인 19,707건은 그대로다.
//   위험한 것은 누적된 19,707건 쪽이다. 필터로 처리하면 옛 글까지 한 번에 적용된다.
//
// 어디에만 적용하는가 — 웹 기사 본문 화면 하나뿐:
//   · 앱(REST) 제외  → 앱 화면 배치를 건드리지 않는다
//   · 피드/목록 제외 → 요약문에 섞여 들어가지 않는다
//   구글이 읽는 곳은 웹 기사 페이지이고, 거기만 바꾸면 목적이 달성된다.
//   (CLAUDE.md 규칙 4 — 요청 범위 밖을 건드리지 않는다)
// ============================================================

define('CHAOVN_EDITORIAL_LINE', '씬짜오베트남 편집부 번역·정리');

add_filter('the_content', 'chaovn_seo_add_editorial_note', 20);
function chaovn_seo_add_editorial_note($content) {
    // REST(앱)·피드·관리화면·목록에서는 손대지 않는다
    if (defined('REST_REQUEST') && REST_REQUEST) return $content;
    if (is_admin() || is_feed())                 return $content;
    if (!is_singular('post') || !in_the_loop() || !is_main_query()) return $content;

    $pid = get_the_ID();
    if (!$pid || !chaovn_seo_is_news_post($pid)) return $content;

    // 이미 붙어 있으면 두 번 붙이지 않는다 (다른 플러그인이 the_content 를 두 번 돌릴 수 있다)
    if (strpos($content, 'chaovn-editorial-line') !== false) return $content;

    $note = '<div class="news-source-line chaovn-editorial-line">'
          . '<strong>' . esc_html(CHAOVN_EDITORIAL_LINE) . '</strong>'
          . '</div>';

    // (a) 출처 상자가 이미 있는 글 — 그 상자 첫 줄로 얹는다
    if (strpos($content, 'news-source-header') !== false) {
        return preg_replace(
            '#(<div class="news-source-header"[^>]*>)#',
            '$1' . $note,
            $content,
            1 // 첫 번째 하나만
        );
    }

    // (b) 출처 상자가 없는 옛 글 — 메타로 상자를 만들어 본문 맨 앞에 붙인다
    $source = trim((string) get_post_meta($pid, 'news_source', true));
    $origin = trim((string) get_post_meta($pid, 'news_original_url', true));
    if ($source === '' && $origin === '') return $content; // 근거가 없으면 아무것도 지어내지 않는다

    $box  = '<div class="news-source-header">' . $note;
    if ($source !== '') {
        $box .= '<div class="news-source-line">출처: ' . esc_html($source) . '</div>';
    }
    if ($origin !== '') {
        $box .= '<div class="news-source-line"><a href="' . esc_url($origin) . '"'
              . ' target="_blank" rel="noopener noreferrer nofollow">원문보기</a></div>';
    }
    $box .= '</div>';

    return $box . $content;
}

/**
 * 스타일. 출처 상자의 기존 CSS(.news-source-header / .news-source-line)는
 * 본문 안에 함께 들어오므로 재정의하지 않고, 우리 줄에만 색을 준다.
 * 옛 글(b 경로)은 그 CSS 가 없을 수 있어 최소한의 모양만 함께 넣는다.
 */
add_action('wp_head', 'chaovn_seo_editorial_style', 99);
function chaovn_seo_editorial_style() {
    if (!is_singular('post')) return;
    echo '<style>'
       . '.chaovn-editorial-line{color:#ea580c;margin-bottom:6px}'
       . '.news-source-header{margin-bottom:16px;font-size:14px;line-height:1.6}'
       . '.news-source-line{display:block;margin-bottom:4px}'
       . '</style>';
}

// ============================================================
// 3) 구조화 데이터에 "원문 출처" 를 기계가 읽는 형태로 선언
// ------------------------------------------------------------
// 왜 필요한가:
//   2)번에서 붙인 "편집부 번역·정리" 는 **사람이 읽는** 근거다. 그런데 구글의
//   '대규모 콘텐츠 남용' 판정은 상당 부분 자동으로 이뤄진다 — 기계가 읽는 근거도 있어야 한다.
//
//   현재 Rank Math 가 내보내는 NewsArticle 에는 출처 선언이 **하나도 없다**(실측:
//   isBasedOn / citation / sourceOrganization 전부 0회). 본문에는 "출처: Thanh Nien" 이
//   글자로 적혀 있지만, 그건 구글이 *해석*해야 알 수 있는 것이다.
//
//   schema.org 의 isBasedOn 은 "이 저작물은 저 자료에서 파생되었다"를 뜻하는 표준 항목이다.
//   이걸 붙이면 우리 입장이 "몰래 베낀 것"이 아니라 **"출처를 명시적으로 신고한 번역물"** 이 된다.
//   숨기지 않는 쪽이 언제나 유리하다 — 어차피 구글은 원문을 이미 알고 있다.
//
// ⚠️ 정직하게 말해 두는 것:
//   이건 순위를 올리는 지렛대가 아니라 **투명성·신뢰(E-E-A-T) 신호**다.
//   당장 숫자로 확인되는 효과를 약속할 수 없다. 다만 비용이 0 이고, 위험도 없다
//   (canonical 은 그대로 자기 자신을 가리키므로 색인 구조는 아무것도 안 바뀐다).
//
// 근거 데이터는 이미 다 있다 — 실측상 뉴스 46건 전수에 news_original_url 이 채워져 있었다.
// ============================================================

add_filter('rank_math/json_ld', 'chaovn_seo_declare_source', 99, 2);
function chaovn_seo_declare_source($data, $jsonld) {
    if (!is_singular('post')) return $data;

    $pid = get_the_ID();
    if (!$pid || !chaovn_seo_is_news_post($pid)) return $data;

    $origin = trim((string) get_post_meta($pid, 'news_original_url', true));
    if ($origin === '' || !filter_var($origin, FILTER_VALIDATE_URL)) return $data;
    $source = trim((string) get_post_meta($pid, 'news_source', true));

    // Rank Math 는 기사 스키마를 'richSnippet' 키에 담지만, 버전마다 키 이름이 달라질 수 있다.
    // 그래서 키를 찍지 않고 **@type 을 보고** 찾는다 — 이름이 바뀌어도 계속 동작한다.
    $article_types = array('NewsArticle', 'Article', 'BlogPosting', 'ReportageNewsArticle');

    foreach ($data as $key => $entity) {
        if (!is_array($entity) || empty($entity['@type'])) continue;
        $types = (array) $entity['@type'];
        if (!array_intersect($types, $article_types)) continue;

        // 이 기사는 저 원문에서 파생되었다 — 표준 항목으로 신고
        $data[$key]['isBasedOn'] = $origin;

        // 어느 매체인지까지 밝힌다 (Cafef / Thanh Nien / VnExpress / Yonhap ...)
        if ($source !== '') {
            $data[$key]['citation'] = array(
                '@type' => 'CreativeWork',
                'name'  => $source,
                'url'   => $origin,
            );
        }

        // 한국어 결과물임을 명시. 베트남어 원문과 별개의 저작물이라는 뜻이 된다.
        if (empty($data[$key]['inLanguage'])) {
            $data[$key]['inLanguage'] = 'ko-KR';
        }
    }

    return $data;
}

// ============================================================
// 4) 탐색경로(Breadcrumbs)가 하위 카테고리에서 멈추는 문제
// ------------------------------------------------------------
// 증상 (2026-08-08 사장님 확인):
//   Rank Math 탐색경로를 켰는데  홈 > 뉴스 > (제목)  까지만 나오고
//   '데일리 뉴스'가 빠진다. "모든 카테고리 표시"를 켜도 그대로다.
//
// 원인 — 설정이 아니라 카테고리가 두 개 붙어 있기 때문이다 (실측):
//   이 기사에 붙은 카테고리:  뉴스(id 6, 부모 없음)  +  데일리 뉴스(id 31, 부모=6)
//   즉 부모와 자식이 *둘 다* 붙어 있다.
//   Rank Math 는 '대표 카테고리'가 지정돼 있지 않으면 목록의 첫 번째를 쓰는데,
//   워드프레스는 카테고리를 id 순으로 돌려주므로 **6(뉴스)** 이 먼저 잡힌다.
//   6 은 최상위라 조상이 없다 → 거기서 경로가 끝나고, 더 구체적인 31 은 통째로 버려진다.
//
//   "모든 카테고리 표시" 가 안 듣는 이유: 그 옵션은 *같은 레벨의 여러 카테고리를 나열*하는
//   것이지 *계층을 따라 내려가는* 것이 아니다. 애초에 다른 기능이다.
//
// 왜 대표 카테고리 지정으로 안 푸는가:
//   글마다 손으로 지정해야 한다. 뉴스만 19,707건이다. 앞으로 하루 47건씩 더 쌓인다.
//
// 무엇을 하는가:
//   붙어 있는 카테고리 중 **가장 깊은 것**을 고르고, 그 조상 사슬을 전부 펼친다.
//     홈 > 뉴스 > 데일리 뉴스 > (제목)
//   뉴스 전용이 아니라 일반 규칙이다 — 매거진도 '피플 > INTERVIEW' 처럼 제대로 나온다.
//   부모-자식 관계가 없으면(최상위 카테고리 하나뿐이면) 아무것도 건드리지 않는다.
//
// 이 필터는 화면과 구조화 데이터(BreadcrumbList) 양쪽에 동시에 반영된다 — Rank Math 공식 동작.
// ============================================================

add_filter('rank_math/frontend/breadcrumb/items', 'chaovn_seo_deepen_breadcrumb', 20, 2);
function chaovn_seo_deepen_breadcrumb($crumbs, $class) {
    if (!is_singular('post'))                  return $crumbs;
    if (!is_array($crumbs) || count($crumbs) < 2) return $crumbs;

    $pid = get_the_ID();
    if (!$pid) return $crumbs;

    $cats = get_the_category($pid);
    if (empty($cats) || count($cats) < 2) return $crumbs; // 하나뿐이면 손댈 이유가 없다

    // 가장 깊은 카테고리 = 조상이 가장 많은 것
    $deepest = null;
    $max_depth = -1;
    foreach ($cats as $cat) {
        $depth = count(get_ancestors($cat->term_id, 'category', 'taxonomy'));
        if ($depth > $max_depth) {
            $max_depth = $depth;
            $deepest   = $cat;
        }
    }
    // 계층이 없으면(전부 최상위) Rank Math 기본 동작이 이미 옳다 — 건드리지 않는다
    if (!$deepest || $max_depth < 1) return $crumbs;

    // 조상 → 자신 순서로 사슬을 만든다 (get_ancestors 는 가까운 조상부터 주므로 뒤집는다)
    $chain = array_reverse(get_ancestors($deepest->term_id, 'category', 'taxonomy'));
    $chain[] = $deepest->term_id;

    $middle = array();
    foreach ($chain as $tid) {
        $term = get_term($tid, 'category');
        if (!$term || is_wp_error($term)) continue;
        $link = get_term_link($term);
        $middle[] = array(
            // 카테고리 이름에 &amp; 같은 엔티티가 들어있다 — 화면에 그대로 찍히면 안 된다
            html_entity_decode($term->name, ENT_QUOTES, 'UTF-8'),
            is_wp_error($link) ? '' : $link,
        );
    }
    if (empty($middle)) return $crumbs; // 만들다 실패하면 원본을 그대로 둔다

    // 첫 항목(홈)과 마지막 항목(글 제목)은 Rank Math 것을 그대로 쓰고, 가운데만 갈아끼운다.
    // 이렇게 해야 홈 라벨·접두어 설정 등 사용자가 정한 값이 보존된다.
    $home  = $crumbs[0];
    $title = $crumbs[count($crumbs) - 1];

    return array_merge(array($home), $middle, array($title));
}

// ============================================================
// 공통 헬퍼
// ============================================================

/** 데일리 뉴스 글인가 (하위 카테고리 포함) */
function chaovn_seo_is_news_post($post_id) {
    // 뉴스 API 플러그인에 같은 판정이 있으면 그것을 쓴다 — 규칙을 두 벌로 두지 않는다.
    if (function_exists('chaovn_is_news_post')) {
        return chaovn_is_news_post($post_id);
    }
    $cats = get_the_category($post_id);
    foreach ($cats as $cat) {
        if ((int) $cat->term_id === CHAOVN_NEWS_CAT_ID) return true;
        if ((int) $cat->parent  === CHAOVN_NEWS_CAT_ID) return true;
    }
    return false;
}

// ============================================================
// 활성화 / 비활성화
// ============================================================
register_activation_hook(__FILE__, function () {
    // 여기서 flush 해도 이 사이트에서는 반영되지 않았다(위 chaovn_seo_maybe_flush 주석 참고).
    // 그래서 "아직 안 했음" 표시만 남기고, 실제 작업은 다음 요청의 init 에서 한다.
    delete_option('chaovn_seo_rewrite_ver');
});

register_deactivation_hook(__FILE__, function () {
    delete_option('chaovn_seo_rewrite_ver'); // 다시 켤 때 규칙을 새로 만들게
    flush_rewrite_rules(false);
    delete_transient(CHAOVN_NEWS_SITEMAP_CACHE);
});
