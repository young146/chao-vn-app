<?php
/**
 * Plugin Name: Xinchao Company Directory
 * Description: 베트남 진출 한국기업 디렉토리 — [company_directory] shortcode로 검색·필터·리스트 표시. 어드민 메뉴에서 CSV 일괄 업로드 가능. 이메일은 보관하지 않음 (개인정보 보호).
 * Version: 1.0.0
 * Author: Xinchao News
 * Text Domain: xinchao-cd
 *
 * 설치:
 *   1. 이 파일을 /wp-content/plugins/xinchao-company-directory.php 에 업로드 (단일 PHP 파일, 폴더 X)
 *   2. WP 관리자 → 플러그인 → "Xinchao Company Directory" 활성화
 *   3. 어드민 메뉴 → "기업 디렉토리" → CSV 업로드
 *   4. 페이지에 [company_directory] shortcode 삽입
 *
 * 마스터 CSV 위치 (편집/백업용):
 *   C:\Users\XINCHAO\OneDrive\Manager-Workspace\data\companies-master.csv
 *   - 출처: phpMyAdmin → wp_xinchao_companies 테이블 export
 *   - 인코딩: UTF-8 with BOM (엑셀에서 한글 정상)
 *   - 약 5,381개 레코드 (코참 회원사 기준)
 *   - 편집 후 WP 어드민에서 "기존 데이터 비우기 체크 + 재업로드" + "검색 인덱스 재구축" 실행
 */

if (!defined('ABSPATH')) {
    exit;
}

// ============================================================================
// 상수
// ============================================================================

define('XCD_VERSION', '1.1.0');
define('XCD_TABLE', 'xinchao_companies');  // wp_ 접두사 미포함 (wpdb가 자동)
define('XCD_PER_PAGE', 24);
define('XCD_AJAX_ACTION', 'xcd_search');

// ============================================================================
// 활성화: 테이블 생성
// ============================================================================

function xcd_activate() {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        company VARCHAR(255) NOT NULL,
        director VARCHAR(120) DEFAULT NULL,
        industry_group VARCHAR(50) DEFAULT NULL,
        industry_detail VARCHAR(255) DEFAULT NULL,
        area VARCHAR(50) DEFAULT NULL,
        address VARCHAR(500) DEFAULT NULL,
        tel VARCHAR(80) DEFAULT NULL,
        homepage VARCHAR(255) DEFAULT NULL,
        email VARCHAR(500) DEFAULT NULL,
        source VARCHAR(50) DEFAULT NULL,
        source_url VARCHAR(500) DEFAULT NULL,
        search_text TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT DEFAULT NULL,
        products TEXT DEFAULT NULL,
        employees VARCHAR(200) DEFAULT NULL,
        country VARCHAR(50) DEFAULT NULL,
        mobile VARCHAR(80) DEFAULT NULL,
        additional_emails VARCHAR(500) DEFAULT NULL,
        founded_year VARCHAR(20) DEFAULT NULL,
        enriched_at DATETIME NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_area (area),
        KEY idx_group (industry_group),
        KEY idx_company (company(100))
    ) $charset;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'xcd_activate');

// 비활성화: 테이블은 유지 (실수로 데이터 잃지 않도록)
// 완전 삭제 원하면 phpMyAdmin에서 수동 DROP

// ============================================================================
// 어드민 메뉴
// ============================================================================

function xcd_admin_menu() {
    add_menu_page(
        '기업 디렉토리',
        '기업 디렉토리',
        'manage_options',
        'xcd-admin',
        'xcd_admin_page',
        'dashicons-building',
        30
    );
}
add_action('admin_menu', 'xcd_admin_menu');

function xcd_admin_page() {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    // CSV 업로드 처리
    $msg = '';
    if (!empty($_POST['xcd_action']) && check_admin_referer('xcd_import_nonce')) {
        if ($_POST['xcd_action'] === 'import' && !empty($_FILES['csv_file']['tmp_name'])) {
            $result = xcd_import_csv($_FILES['csv_file']['tmp_name'], !empty($_POST['truncate']));
            $msg = '<div class="notice notice-success"><p>' . esc_html($result) . '</p></div>';
        } elseif ($_POST['xcd_action'] === 'truncate') {
            $wpdb->query("TRUNCATE TABLE $table");
            $msg = '<div class="notice notice-warning"><p>전체 삭제 완료 (테이블 비움)</p></div>';
        }
    }

    // DB 스키마 업그레이드 처리
    if (!empty($_POST['xcd_upgrade_action']) && check_admin_referer('xcd_upgrade_nonce', 'xcd_upgrade_nonce_field')) {
        xcd_activate();
        $msg = '<div class="notice notice-success"><p>✅ DB 스키마 업그레이드 완료 — 새 컬럼(description, products, employees, country, mobile, additional_emails, founded_year, enriched_at)이 추가(또는 이미 존재)됩니다.</p></div>';
    }

    // 검색 인덱스 재구축 처리 (POST, 별도 nonce)
    if (!empty($_POST['xcd_rebuild_action']) && check_admin_referer('xcd_rebuild_nonce', 'xcd_rebuild_nonce_field')) {
        $offset = max(0, intval($_POST['xcd_rebuild_offset'] ?? 0));
        $batch_size = 200;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, company, director, industry_group, industry_detail, area, address, tel, email, description, products, employees FROM $table LIMIT %d OFFSET %d",
            $batch_size, $offset
        ));
        $updated = 0;
        foreach ($rows as $r) {
            $st = strtolower(
                ($r->company ?? '') . ' ' . ($r->director ?? '') . ' ' .
                ($r->industry_group ?? '') . ' ' . ($r->industry_detail ?? '') . ' ' .
                ($r->area ?? '') . ' ' . ($r->address ?? '') . ' ' .
                ($r->tel ?? '') . ' ' . ($r->email ?? '') . ' ' .
                ($r->description ?? '') . ' ' . ($r->products ?? '') . ' ' .
                ($r->employees ?? '')
            );
            $wpdb->update($table, ['search_text' => $st], ['id' => $r->id]);
            $updated++;
        }
        $total_count = (int)$wpdb->get_var("SELECT COUNT(*) FROM $table");
        $done = $offset + $updated;
        if ($updated < $batch_size) {
            $msg = '<div class="notice notice-success"><p>검색 인덱스 재구축 완료 — 총 ' . number_format($done) . '건 갱신됨.</p></div>';
        } else {
            $msg = '<div class="notice notice-info"><p>' . number_format($done) . ' / ' . number_format($total_count) . '건 갱신 완료 — 다음 배치 계속 진행 중...</p>'
                 . '<form method="post" style="margin-top:8px;">'
                 . wp_nonce_field('xcd_rebuild_nonce', 'xcd_rebuild_nonce_field', true, false)
                 . '<input type="hidden" name="xcd_rebuild_action" value="rebuild">'
                 . '<input type="hidden" name="xcd_rebuild_offset" value="' . esc_attr($done) . '">'
                 . '<input type="submit" class="button button-primary" value="다음 ' . $batch_size . '건 계속 →">'
                 . '</form></div>';
        }
    }

    $count = $wpdb->get_var("SELECT COUNT(*) FROM $table");
    $area_stats = $wpdb->get_results("SELECT area, COUNT(*) AS c FROM $table GROUP BY area ORDER BY c DESC LIMIT 10");
    ?>
    <div class="wrap">
        <h1>기업 디렉토리 관리</h1>
        <?php echo $msg; ?>

        <h2>현재 상태</h2>
        <p><strong>총 등록 회사: <?php echo number_format($count); ?>개</strong></p>
        <?php if ($count > 0): ?>
            <p>지역별 상위 10:</p>
            <ul style="list-style: disc; padding-left: 20px;">
                <?php foreach ($area_stats as $row): ?>
                    <li><?php echo esc_html($row->area ?: '(미상)') . ' — ' . number_format($row->c) . '개'; ?></li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>

        <hr>

        <h2>CSV 업로드</h2>
        <p>CSV 컬럼 순서: <code>company, director, industry_group, industry_detail, area, address, tel, homepage, source, source_url</code></p>
        <p>UTF-8 (BOM 가능). 헤더 행 1줄 필수.</p>

        <form method="post" enctype="multipart/form-data">
            <?php wp_nonce_field('xcd_import_nonce'); ?>
            <input type="hidden" name="xcd_action" value="import">
            <table class="form-table">
                <tr>
                    <th><label for="csv_file">CSV 파일</label></th>
                    <td><input type="file" name="csv_file" id="csv_file" accept=".csv" required></td>
                </tr>
                <tr>
                    <th>기존 데이터 처리</th>
                    <td>
                        <label><input type="checkbox" name="truncate" value="1"> 업로드 전 테이블 비우기 (전체 교체)</label>
                        <p class="description">체크 안 하면 기존 데이터는 유지하고 신규만 추가됩니다 (회사명+지역 기준 중복 검사).</p>
                    </td>
                </tr>
            </table>
            <p class="submit"><input type="submit" class="button-primary" value="업로드 및 가져오기"></p>
        </form>

        <hr>

        <h2>사용 방법</h2>
        <p>회사 디렉토리를 표시할 페이지에 다음 shortcode를 삽입하세요:</p>
        <pre style="background:#f0f0f0;padding:10px;font-size:14px;">[company_directory]</pre>
        <p>옵션:</p>
        <pre style="background:#f0f0f0;padding:10px;font-size:14px;">[company_directory per_page="30" default_area="HCMC"]</pre>

        <hr>

        <h2>DB 스키마 업그레이드</h2>
        <p>플러그인을 업데이트한 후 처음 한 번 실행하세요. <code>description, products, employees, country, mobile, additional_emails, founded_year, enriched_at</code> 컬럼을 추가합니다.<br>
           기존 데이터는 보존됩니다. dbDelta가 이미 존재하는 컬럼은 건너뜁니다.</p>
        <form method="post">
            <?php wp_nonce_field('xcd_upgrade_nonce', 'xcd_upgrade_nonce_field'); ?>
            <input type="hidden" name="xcd_upgrade_action" value="upgrade">
            <input type="submit" class="button button-primary" value="DB 스키마 업그레이드 실행" onclick="return confirm('새 컬럼을 추가합니다. 기존 데이터는 유지됩니다. 계속할까요?');">
        </form>

        <hr>

        <h2>검색 인덱스 재구축</h2>
        <p>CSV 업로드 후 검색이 잘 안 되거나, 플러그인 업데이트 후 처음 사용 시 이 버튼을 클릭하세요.<br>
           모든 레코드의 <code>search_text</code>를 현재 코드 기준(회사명·대표자·업종·사업내용·지역·주소·전화)으로 재생성합니다.</p>
        <p>한 번에 200건씩 처리하며, 건수가 많을 경우 "다음 배치 계속 →" 버튼이 나타납니다.</p>
        <form method="post">
            <?php wp_nonce_field('xcd_rebuild_nonce', 'xcd_rebuild_nonce_field'); ?>
            <input type="hidden" name="xcd_rebuild_action" value="rebuild">
            <input type="hidden" name="xcd_rebuild_offset" value="0">
            <input type="submit" class="button button-secondary" value="검색 인덱스 재구축 (처음부터)" onclick="return confirm('전체 search_text를 재생성합니다. 계속할까요?');">
        </form>
    </div>
    <?php
}

// ============================================================================
// CSV 가져오기 (배치 INSERT)
// ============================================================================

function xcd_import_csv($file_path, $truncate = false) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    if ($truncate) {
        $wpdb->query("TRUNCATE TABLE $table");
    }

    if (($fh = fopen($file_path, 'r')) === false) {
        return '파일 열기 실패';
    }

    // BOM 검출 후 건너뛰기 (utf-8-sig 대응)
    $bom_check = fread($fh, 3);
    if ($bom_check !== "\xEF\xBB\xBF") {
        rewind($fh);  // BOM 없으면 처음부터 읽기
    }
    // BOM 있으면 이미 3바이트 건너뛴 상태 → 그대로 진행

    $header = fgetcsv($fh);
    if (!$header) {
        fclose($fh);
        return '헤더를 읽을 수 없음';
    }
    $header = array_map('trim', $header);
    $idx = array_flip($header);

    $needed = ['company', 'director', 'industry_group', 'industry_detail',
               'area', 'address', 'tel', 'homepage', 'email', 'source', 'source_url'];

    $batch = [];
    $imported = 0;
    $skipped = 0;
    $batch_size = 200;

    // 중복 체크용 set: 회사명(소문자) + area
    $existing_keys = [];
    if (!$truncate) {
        $rows = $wpdb->get_results("SELECT company, area FROM $table");
        foreach ($rows as $r) {
            $existing_keys[strtolower(trim($r->company)) . '|' . trim((string)$r->area)] = true;
        }
    }

    while (($row = fgetcsv($fh)) !== false) {
        if (count($row) < 1 || (count($row) === 1 && trim($row[0]) === '')) continue;

        $get = function($col) use ($row, $idx) {
            return isset($idx[$col]) && isset($row[$idx[$col]]) ? trim($row[$idx[$col]]) : '';
        };

        $company = $get('company');
        $area = $get('area');
        if (!$company) { $skipped++; continue; }

        $key = strtolower($company) . '|' . $area;
        if (isset($existing_keys[$key])) { $skipped++; continue; }
        $existing_keys[$key] = true;

        $industry_group = $get('industry_group');
        $industry_detail = $get('industry_detail');
        $address = $get('address');
        $director = $get('director');
        $tel = $get('tel');

        $email = $get('email');
        $search_text = strtolower($company . ' ' . $director . ' ' . $industry_group . ' '
            . $industry_detail . ' ' . $area . ' ' . $address . ' ' . $tel . ' ' . $email);

        $batch[] = $wpdb->prepare(
            "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            mb_substr($company, 0, 255),
            mb_substr($director, 0, 120),
            mb_substr($industry_group, 0, 50),
            mb_substr($industry_detail, 0, 255),
            mb_substr($area, 0, 50),
            mb_substr($address, 0, 500),
            mb_substr($tel, 0, 80),
            mb_substr($get('homepage'), 0, 255),
            mb_substr($email, 0, 500),
            mb_substr($get('source'), 0, 50),
            mb_substr($get('source_url'), 0, 500),
            mb_substr($search_text, 0, 65535)
        );

        if (count($batch) >= $batch_size) {
            xcd_flush_batch($batch);
            $imported += count($batch);
            $batch = [];
        }
    }
    fclose($fh);

    if (!empty($batch)) {
        xcd_flush_batch($batch);
        $imported += count($batch);
    }

    return "완료 — 추가: $imported, 중복/제외: $skipped (총 처리 행: " . ($imported + $skipped) . ')';
}

function xcd_flush_batch($batch) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;
    $sql = "INSERT INTO $table (company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url, search_text) VALUES "
         . implode(',', $batch);
    $wpdb->query($sql);
}

// ============================================================================
// Shortcode: [company_directory]
// ============================================================================

function xcd_directory_shortcode($atts) {
    $atts = shortcode_atts([
        'per_page' => XCD_PER_PAGE,
        'default_area' => '',
        'default_group' => '',
    ], $atts);

    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $areas = $wpdb->get_col("SELECT DISTINCT area FROM $table WHERE area IS NOT NULL AND area != '' ORDER BY area");
    $groups = $wpdb->get_col("SELECT DISTINCT industry_group FROM $table WHERE industry_group IS NOT NULL AND industry_group != '' ORDER BY industry_group");
    $total = (int)$wpdb->get_var("SELECT COUNT(*) FROM $table");

    // 다중 shortcode 안전: 매 호출마다 unique ID 부여
    static $instance = 0;
    $instance++;
    $uid = 'xcd-' . wp_generate_uuid4();

    ob_start();
    // CSS는 첫 번째 호출 시에만 출력 (페이지 내 다중 shortcode 시 중복 방지)
    if ($instance === 1) {
        xcd_print_css();
    }
    ?>
    <div class="xcd-wrap" id="<?php echo esc_attr($uid); ?>" data-perpage="<?php echo esc_attr($atts['per_page']); ?>">
        <div class="xcd-header">
            <h2 class="xcd-title">베트남 진출 한국기업 디렉토리</h2>
            <p class="xcd-subtitle">총 <strong class="xcd-total"><?php echo number_format($total); ?></strong>개 기업 (코참 베트남·호치민 회원사 기준)</p>
        </div>

        <div class="xcd-filters">
            <input type="text" class="xcd-search" placeholder="회사명·사업내용·업종·주소 통합 검색..." />
            <select class="xcd-area">
                <option value="">전체 지역</option>
                <?php foreach ($areas as $a): ?>
                    <option value="<?php echo esc_attr($a); ?>" <?php selected($atts['default_area'], $a); ?>><?php echo esc_html($a); ?></option>
                <?php endforeach; ?>
            </select>
            <select class="xcd-group">
                <option value="">전체 업종</option>
                <?php foreach ($groups as $g): ?>
                    <option value="<?php echo esc_attr($g); ?>" <?php selected($atts['default_group'], $g); ?>><?php echo esc_html($g); ?></option>
                <?php endforeach; ?>
            </select>
            <button type="button" class="xcd-reset">초기화</button>
        </div>
        <p class="xcd-search-hint">회사명 외에도 <strong>사업내용</strong>(예: 플라스틱 사출, 금형, 물류 등) 또는 <strong>업종·지역·주소</strong> 키워드로 검색할 수 있습니다.</p>

        <div class="xcd-status"></div>
        <div class="xcd-list"></div>
        <div class="xcd-pagination"></div>
    </div>

    <!-- 상세 모달 (shortcode 인스턴스당 1개) -->
    <div class="xcd-overlay" id="<?php echo esc_attr($uid); ?>-overlay" role="dialog" aria-modal="true">
        <div class="xcd-modal">
            <button class="xcd-modal-close" aria-label="닫기">&times;</button>
            <h3 class="xcd-modal-title"></h3>
            <span class="xcd-modal-area"></span>
            <div class="xcd-modal-body"></div>
        </div>
    </div>

    <script>
    (function() {
        var wrap = document.getElementById('<?php echo esc_js($uid); ?>');
        if (!wrap) return;
        var ajaxurl = '<?php echo esc_url(admin_url('admin-ajax.php')); ?>';
        var perPage = parseInt(wrap.dataset.perpage) || 24;
        var state = {
            search: '',
            area: wrap.querySelector('.xcd-area').value,
            group: wrap.querySelector('.xcd-group').value,
            page: 1
        };
        var listEl = wrap.querySelector('.xcd-list');
        var statusEl = wrap.querySelector('.xcd-status');
        var pagEl = wrap.querySelector('.xcd-pagination');
        var debounceTimer = null;

        // 모달
        var overlay = document.getElementById('<?php echo esc_js($uid); ?>-overlay');
        var modalTitle = overlay.querySelector('.xcd-modal-title');
        var modalArea = overlay.querySelector('.xcd-modal-area');
        var modalBody = overlay.querySelector('.xcd-modal-body');

        function openModal(c) {
            modalTitle.textContent = c.company || '';
            modalArea.textContent = c.area || '';
            modalArea.style.display = c.area ? 'inline-block' : 'none';

            var rows = [];
            if (c.director) rows.push(['대표자', escapeHtml(c.director)]);
            if (c.industry_group || c.industry_detail) {
                var ind = escapeHtml(c.industry_group || '');
                if (c.industry_detail && c.industry_detail !== c.industry_group) {
                    ind += ' <span style="color:#d1d5db">|</span> ' + escapeHtml(c.industry_detail);
                }
                rows.push(['업종', ind]);
            }
            if (c.address) rows.push(['주소', escapeHtml(c.address)]);
            if (c.description) rows.push(['회사 소개', escapeHtml(c.description).replace(/\n/g, '<br>')]);
            if (c.products) rows.push(['주요 제품/서비스', escapeHtml(c.products).replace(/\n/g, '<br>')]);
            if (c.employees) rows.push(['고용인원', escapeHtml(c.employees)]);
            if (c.founded_year) rows.push(['창립연도', escapeHtml(c.founded_year) + '년']);
            if (c.country) rows.push(['법인등록국가', escapeHtml(c.country)]);
            if (c.tel) rows.push(['전화', escapeHtml(c.tel)]);
            if (c.mobile) rows.push(['휴대전화', escapeHtml(c.mobile)]);
            if (c.homepage) rows.push(['홈페이지', '<a href="' + escapeHtml(c.homepage) + '" target="_blank" rel="noopener">' + escapeHtml(c.homepage) + '</a>']);
            if (c.email) {
                var emailLinks = c.email.split(/[,\s]+/).filter(Boolean).map(function(e) {
                    return '<a href="mailto:' + escapeHtml(e.trim()) + '">' + escapeHtml(e.trim()) + '</a>';
                }).join('<br>');
                rows.push(['이메일', emailLinks]);
            }
            if (c.additional_emails) {
                var aeLinks = c.additional_emails.split(/[,\s]+/).filter(Boolean).map(function(e) {
                    return '<a href="mailto:' + escapeHtml(e.trim()) + '">' + escapeHtml(e.trim()) + '</a>';
                }).join('<br>');
                if (aeLinks) rows.push(['추가 이메일', aeLinks]);
            }
            if (c.source) {
                var srcVal = escapeHtml(c.source);
                if (c.source_url) srcVal = '<a href="' + escapeHtml(c.source_url) + '" target="_blank" rel="noopener">' + srcVal + ' ↗</a>';
                rows.push(['출처', srcVal]);
            }

            modalBody.innerHTML = rows.map(function(r) {
                return '<div class="xcd-modal-row"><span class="xcd-modal-label">' + r[0] + '</span><span class="xcd-modal-val">' + r[1] + '</span></div>';
            }).join('');

            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        overlay.querySelector('.xcd-modal-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

        function escapeHtml(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
                return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
            });
        }

        function render(data) {
            statusEl.textContent = data.total ? '검색 결과: ' + data.total.toLocaleString() + '개 기업'
                                              : '검색 결과 없음';
            listEl.innerHTML = '';
            data.items.forEach(function(c) {
                var el = document.createElement('div');
                el.className = 'xcd-card';
                var html = '';
                html += '<div class="xcd-card-head">';
                html += '<h3 class="xcd-card-name">' + escapeHtml(c.company) + '</h3>';
                if (c.area) html += '<span class="xcd-chip">' + escapeHtml(c.area) + '</span>';
                html += '</div>';
                if (c.director) html += '<div class="xcd-card-row"><span class="xcd-label">대표</span>' + escapeHtml(c.director) + '</div>';
                if (c.industry_group || c.industry_detail) {
                    var indGroup = escapeHtml(c.industry_group || '');
                    var indDetail = c.industry_detail && c.industry_detail !== c.industry_group ? c.industry_detail : '';
                    var indDetailShort = indDetail.length > 60 ? indDetail.substring(0, 60) + '…' : indDetail;
                    html += '<div class="xcd-card-row"><span class="xcd-label">업종</span><span class="xcd-ind-wrap">' + indGroup;
                    if (indDetail) html += '<span class="xcd-ind-detail" title="' + escapeHtml(indDetail) + '">' + escapeHtml(indDetailShort) + '</span>';
                    html += '</span></div>';
                }
                if (c.address) html += '<div class="xcd-card-row"><span class="xcd-label">주소</span>' + escapeHtml(c.address) + '</div>';
                var meta = [];
                if (c.tel) meta.push('☎ ' + escapeHtml(c.tel));
                if (c.homepage) meta.push('<a href="' + escapeHtml(c.homepage) + '" target="_blank" rel="noopener">🌐 홈페이지</a>');
                if (meta.length) html += '<div class="xcd-card-meta">' + meta.join(' &nbsp;|&nbsp; ') + '</div>';
                el.innerHTML = html;
                el.addEventListener('click', function() { openModal(c); });
                listEl.appendChild(el);
            });
            renderPagination(data.page, data.total_pages);
        }

        function renderPagination(page, total) {
            pagEl.innerHTML = '';
            if (total <= 1) return;
            var addBtn = function(p, label, disabled, current) {
                var b = document.createElement('button');
                b.textContent = label || p;
                b.className = 'xcd-pgbtn' + (current ? ' active' : '');
                if (disabled) b.disabled = true;
                b.addEventListener('click', function() {
                    state.page = p;
                    fetchData();
                    wrap.scrollIntoView({behavior:'smooth', block:'start'});
                });
                pagEl.appendChild(b);
            };
            addBtn(Math.max(1, page-1), '‹', page===1);
            var start = Math.max(1, page-3), end = Math.min(total, page+3);
            if (start > 1) { addBtn(1, '1', false); if (start > 2) pagEl.appendChild(document.createTextNode('...')); }
            for (var p = start; p <= end; p++) addBtn(p, String(p), false, p===page);
            if (end < total) { if (end < total-1) pagEl.appendChild(document.createTextNode('...')); addBtn(total, String(total), false); }
            addBtn(Math.min(total, page+1), '›', page===total);
        }

        function fetchData() {
            statusEl.textContent = '검색 중...';
            var fd = new FormData();
            fd.append('action', '<?php echo XCD_AJAX_ACTION; ?>');
            fd.append('search', state.search);
            fd.append('area', state.area);
            fd.append('group', state.group);
            fd.append('page', state.page);
            fd.append('per_page', perPage);
            fetch(ajaxurl, {method:'POST', body: fd, credentials:'same-origin'})
                .then(function(r){ return r.json(); })
                .then(function(j){
                    if (j.success) render(j.data);
                    else statusEl.textContent = '오류: ' + (j.data && j.data.message || '알 수 없음');
                })
                .catch(function(e){ statusEl.textContent = '네트워크 오류'; });
        }

        function debouncedFetch() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() { state.page = 1; fetchData(); }, 300);
        }

        wrap.querySelector('.xcd-search').addEventListener('input', function(e) {
            state.search = e.target.value.trim();
            debouncedFetch();
        });
        wrap.querySelector('.xcd-area').addEventListener('change', function(e) {
            state.area = e.target.value; state.page = 1; fetchData();
        });
        wrap.querySelector('.xcd-group').addEventListener('change', function(e) {
            state.group = e.target.value; state.page = 1; fetchData();
        });
        wrap.querySelector('.xcd-reset').addEventListener('click', function() {
            wrap.querySelector('.xcd-search').value = '';
            wrap.querySelector('.xcd-area').value = '';
            wrap.querySelector('.xcd-group').value = '';
            state = {search:'', area:'', group:'', page:1};
            fetchData();
        });

        fetchData();
    })();
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('company_directory', 'xcd_directory_shortcode');

// ============================================================================
// AJAX 핸들러: 검색·필터·페이지네이션
// ============================================================================

function xcd_search_ajax() {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $search = isset($_POST['search']) ? trim(wp_unslash($_POST['search'])) : '';
    $area = isset($_POST['area']) ? trim(wp_unslash($_POST['area'])) : '';
    $group = isset($_POST['group']) ? trim(wp_unslash($_POST['group'])) : '';
    $page = max(1, intval($_POST['page'] ?? 1));
    $per_page = max(1, min(100, intval($_POST['per_page'] ?? XCD_PER_PAGE)));
    $offset = ($page - 1) * $per_page;

    $where = ['1=1'];
    $params = [];

    if ($area !== '') {
        $where[] = 'area = %s';
        $params[] = $area;
    }
    if ($group !== '') {
        $where[] = 'industry_group = %s';
        $params[] = $group;
    }
    if ($search !== '') {
        $where[] = 'search_text LIKE %s';
        $params[] = '%' . $wpdb->esc_like(strtolower($search)) . '%';
    }
    $where_sql = implode(' AND ', $where);

    // 총 카운트
    $count_sql = "SELECT COUNT(*) FROM $table WHERE $where_sql";
    $total = (int)$wpdb->get_var($params ? $wpdb->prepare($count_sql, $params) : $count_sql);

    // 데이터
    $data_sql = "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url,
                        description, products, employees, country, mobile, additional_emails, founded_year
                 FROM $table WHERE $where_sql
                 ORDER BY area ASC, company ASC
                 LIMIT %d OFFSET %d";
    $data_params = array_merge($params, [$per_page, $offset]);
    $items = $wpdb->get_results($wpdb->prepare($data_sql, $data_params));

    wp_send_json_success([
        'items' => $items,
        'total' => $total,
        'page' => $page,
        'total_pages' => max(1, (int)ceil($total / $per_page)),
        'per_page' => $per_page,
    ]);
}
add_action('wp_ajax_' . XCD_AJAX_ACTION, 'xcd_search_ajax');
add_action('wp_ajax_nopriv_' . XCD_AJAX_ACTION, 'xcd_search_ajax');

// ============================================================================
// 인라인 CSS (shortcode 첫 호출 시 출력)
// ============================================================================

function xcd_print_css() {
    ?>
    <style>
    .xcd-wrap { max-width: 1200px; margin: 0 auto; padding: 20px 12px; font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; color: #1f2937; }
    .xcd-header { text-align: center; margin-bottom: 24px; }
    .xcd-title { font-size: 28px; font-weight: 700; margin: 0 0 8px; color: #111827; }
    .xcd-subtitle { color: #6b7280; font-size: 15px; margin: 0; }
    .xcd-subtitle .xcd-total { color: #ea580c; font-size: 18px; }

    .xcd-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; padding: 16px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; }
    .xcd-filters .xcd-search { flex: 1 1 280px; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; outline: none; transition: border-color 0.15s; }
    .xcd-filters .xcd-search:focus { border-color: #ea580c; }
    .xcd-filters select { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: #fff; min-width: 140px; cursor: pointer; }
    .xcd-filters .xcd-reset { padding: 10px 16px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .xcd-filters .xcd-reset:hover { background: #f3f4f6; }
    .xcd-search-hint { font-size: 12px; color: #9ca3af; margin: 4px 0 12px; line-height: 1.5; }

    .xcd-status { padding: 8px 4px 16px; color: #6b7280; font-size: 14px; }

    .xcd-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .xcd-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 18px; transition: box-shadow 0.15s, transform 0.15s; }
    .xcd-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .xcd-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .xcd-card-name { font-size: 16px; font-weight: 600; color: #111827; margin: 0; line-height: 1.4; flex: 1; }
    .xcd-chip { background: #fef3c7; color: #92400e; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
    .xcd-card-row { font-size: 13px; color: #4b5563; margin-top: 6px; line-height: 1.5; }
    .xcd-card-row .xcd-label { display: inline-block; width: 40px; color: #9ca3af; font-weight: 500; flex-shrink: 0; }
    .xcd-ind-wrap { display: inline; }
    .xcd-ind-detail { display: block; margin-top: 2px; padding-left: 40px; color: #6b7280; font-size: 12px; line-height: 1.45; }
    .xcd-card-meta { margin-top: 12px; padding-top: 10px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; }
    .xcd-card-meta a { color: #ea580c; text-decoration: none; }
    .xcd-card-meta a:hover { text-decoration: underline; }
    .xcd-card { cursor: pointer; }

    /* 모달 */
    .xcd-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99999; align-items: center; justify-content: center; padding: 16px; }
    .xcd-overlay.open { display: flex; }
    .xcd-modal { background: #fff; border-radius: 16px; padding: 28px 32px; max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
    .xcd-modal-close { position: absolute; top: 16px; right: 20px; background: none; border: none; font-size: 22px; cursor: pointer; color: #6b7280; line-height: 1; }
    .xcd-modal-close:hover { color: #111; }
    .xcd-modal-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 32px 4px 0; line-height: 1.4; }
    .xcd-modal-area { display: inline-block; background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 18px; }
    .xcd-modal-row { display: flex; gap: 10px; margin-bottom: 10px; font-size: 14px; color: #374151; }
    .xcd-modal-label { min-width: 56px; color: #9ca3af; font-weight: 500; flex-shrink: 0; padding-top: 1px; }
    .xcd-modal-val { flex: 1; line-height: 1.6; }
    .xcd-modal-val a { color: #ea580c; text-decoration: none; word-break: break-all; }
    .xcd-modal-val a:hover { text-decoration: underline; }
    .xcd-modal-divider { border: none; border-top: 1px solid #f3f4f6; margin: 14px 0; }
    @media (max-width: 600px) {
        .xcd-modal { padding: 20px 18px; }
        .xcd-modal-title { font-size: 17px; }
    }

    .xcd-pagination { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 28px; padding: 12px 0; }
    .xcd-pgbtn { min-width: 36px; padding: 6px 10px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; font-size: 14px; color: #374151; }
    .xcd-pgbtn:hover:not(:disabled) { background: #f3f4f6; border-color: #ea580c; color: #ea580c; }
    .xcd-pgbtn.active { background: #ea580c; color: #fff; border-color: #ea580c; font-weight: 600; }
    .xcd-pgbtn:disabled { opacity: 0.4; cursor: not-allowed; }

    @media (max-width: 600px) {
        .xcd-title { font-size: 22px; }
        .xcd-filters { padding: 12px; }
        .xcd-filters select { min-width: 0; flex: 1; }
        .xcd-list { grid-template-columns: 1fr; }
    }
    </style>
    <?php
}

// ============================================================================
// REST API — xcd/v1
// ============================================================================

// --- CORS 헬퍼 -----------------------------------------------------------

/**
 * CORS 허용 오리진 화이트리스트.
 */
function xcd_cors_allowed_origins() {
    return [
        'https://daily-news-final.vercel.app',
        'https://vnkorlife.com',
        'https://chaovietnam.co.kr',
        'http://localhost:3000',
    ];
}

/**
 * 요청 Origin이 화이트리스트에 있으면 CORS 헤더를 설정한다.
 * OPTIONS preflight 요청은 즉시 200 응답 후 종료한다.
 */
function xcd_handle_cors() {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if (in_array($origin, xcd_cors_allowed_origins(), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        header('Vary: Origin');
    }

    // OPTIONS preflight 즉시 처리
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        status_header(200);
        exit;
    }
}
add_action('init', 'xcd_handle_cors', 1);

/**
 * REST API 응답에도 CORS 헤더 추가 (rest_pre_serve_request 필터).
 */
function xcd_rest_cors_headers($served, $result, $request, $server) {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if (in_array($origin, xcd_cors_allowed_origins(), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        header('Vary: Origin');
    }
    return $served;
}
add_filter('rest_pre_serve_request', 'xcd_rest_cors_headers', 1, 4);

// --- 라우트 등록 -----------------------------------------------------------

add_action('rest_api_init', 'xcd_register_rest_routes');

function xcd_register_rest_routes() {
    $ns = 'xcd/v1';

    // 1. GET /xcd/v1/search
    register_rest_route($ns, '/search', [
        'methods'             => 'GET',
        'callback'            => 'xcd_rest_search',
        'permission_callback' => '__return_true',
        'args'                => [
            'q'        => ['type' => 'string',  'default' => ''],
            'area'     => ['type' => 'string',  'default' => ''],
            'group'    => ['type' => 'string',  'default' => ''],
            'page'     => ['type' => 'integer', 'default' => 1,  'minimum' => 1],
            'per_page' => ['type' => 'integer', 'default' => 24, 'minimum' => 1, 'maximum' => 100],
        ],
    ]);

    // 2. GET /xcd/v1/list
    register_rest_route($ns, '/list', [
        'methods'             => 'GET',
        'callback'            => 'xcd_rest_list',
        'permission_callback' => '__return_true',
        'args'                => [
            'page'     => ['type' => 'integer', 'default' => 1,   'minimum' => 1],
            'per_page' => ['type' => 'integer', 'default' => 24,  'minimum' => 1, 'maximum' => 100],
            'area'     => ['type' => 'string',  'default' => ''],
            'group'    => ['type' => 'string',  'default' => ''],
            'sort'     => ['type' => 'string',  'default' => 'company',
                           'enum' => ['company', 'area', 'created_at']],
            'dir'      => ['type' => 'string',  'default' => 'asc',
                           'enum' => ['asc', 'desc']],
        ],
    ]);

    // 3. GET /xcd/v1/{id} — 단일 회사 상세
    register_rest_route($ns, '/(?P<id>\d+)', [
        [
            'methods'             => 'GET',
            'callback'            => 'xcd_rest_get_one',
            'permission_callback' => '__return_true',
            'args'                => [
                'id' => ['type' => 'integer', 'required' => true, 'minimum' => 1],
            ],
        ],
        // 5. POST /xcd/v1/{id} — 회사 수정 (관리자)
        [
            'methods'             => 'POST',
            'callback'            => 'xcd_rest_update',
            'permission_callback' => 'xcd_rest_admin_only',
            'args'                => [
                'id' => ['type' => 'integer', 'required' => true, 'minimum' => 1],
            ],
        ],
        // 7. DELETE /xcd/v1/{id} — 회사 삭제 (관리자)
        [
            'methods'             => 'DELETE',
            'callback'            => 'xcd_rest_delete',
            'permission_callback' => 'xcd_rest_admin_only',
            'args'                => [
                'id' => ['type' => 'integer', 'required' => true, 'minimum' => 1],
            ],
        ],
    ]);

    // 4. GET /xcd/v1/stats
    register_rest_route($ns, '/stats', [
        'methods'             => 'GET',
        'callback'            => 'xcd_rest_stats',
        'permission_callback' => '__return_true',
    ]);

    // 6. POST /xcd/v1/create — 회사 신규 등록 (관리자)
    register_rest_route($ns, '/create', [
        'methods'             => 'POST',
        'callback'            => 'xcd_rest_create',
        'permission_callback' => 'xcd_rest_admin_only',
    ]);

    // 8. POST /xcd/v1/import — CSV 일괄 가져오기 (관리자)
    register_rest_route($ns, '/import', [
        'methods'             => 'POST',
        'callback'            => 'xcd_rest_import',
        'permission_callback' => 'xcd_rest_admin_only',
    ]);
}

// --- 공통 헬퍼 ------------------------------------------------------------

/**
 * 관리자 전용 엔드포인트 권한 콜백.
 */
function xcd_rest_admin_only() {
    if (!current_user_can('manage_options')) {
        return new WP_Error('forbidden', '관리자 권한이 필요합니다.', ['status' => 403]);
    }
    return true;
}

/**
 * 회사 레코드 배열로부터 search_text를 재생성한다.
 */
function xcd_build_search_text($data) {
    return strtolower(
        ($data['company']         ?? '') . ' ' .
        ($data['director']        ?? '') . ' ' .
        ($data['industry_group']  ?? '') . ' ' .
        ($data['industry_detail'] ?? '') . ' ' .
        ($data['area']            ?? '') . ' ' .
        ($data['address']         ?? '') . ' ' .
        ($data['tel']             ?? '') . ' ' .
        ($data['email']           ?? '') . ' ' .
        ($data['description']     ?? '') . ' ' .
        ($data['products']        ?? '') . ' ' .
        ($data['employees']       ?? '')
    );
}

/**
 * POST/JSON 본문에서 회사 필드를 추출해 정제된 배열로 반환한다.
 */
function xcd_extract_company_fields(WP_REST_Request $request, $partial = false) {
    $fields = ['company', 'director', 'industry_group', 'industry_detail',
               'area', 'address', 'tel', 'homepage', 'email', 'source', 'source_url',
               'description', 'products', 'employees', 'country', 'mobile',
               'additional_emails', 'founded_year'];
    $limits = [
        'company'          => 255,
        'director'         => 120,
        'industry_group'   => 50,
        'industry_detail'  => 255,
        'area'             => 50,
        'address'          => 500,
        'tel'              => 80,
        'homepage'         => 255,
        'email'            => 500,
        'source'           => 50,
        'source_url'       => 500,
        'description'      => 65535,
        'products'         => 65535,
        'employees'        => 200,
        'country'          => 50,
        'mobile'           => 80,
        'additional_emails'=> 500,
        'founded_year'     => 20,
    ];

    $body = $request->get_json_params() ?: [];

    $data = [];
    foreach ($fields as $f) {
        $val = $request->get_param($f);
        // 요청에 해당 필드가 실제로 포함되었는지 판정 (query param 또는 JSON body)
        $present = ($val !== null) || array_key_exists($f, $body);

        // 부분 업데이트(PATCH 의미): 요청에 없는 필드는 건드리지 않고 건너뛴다.
        // 이렇게 해야 enrich 같은 일부 필드만 보내는 요청이 나머지 필드를 ''로 덮어쓰지 않는다.
        if ($partial && !$present) {
            continue;
        }

        if ($val === null) {
            $val = array_key_exists($f, $body) ? $body[$f] : '';
        }
        // description/products는 sanitize_textarea_field 사용 (줄바꿈 보존)
        if (in_array($f, ['description', 'products'], true)) {
            $val = sanitize_textarea_field((string)$val);
        } else {
            $val = sanitize_text_field((string)$val);
        }
        $data[$f] = mb_substr($val, 0, $limits[$f]);
    }

    // enriched_at: 크롤러가 직접 설정할 수 있도록 별도 처리
    if (array_key_exists('enriched_at', $body)) {
        $ea = sanitize_text_field((string)$body['enriched_at']);
        $data['enriched_at'] = $ea ?: null;
    }

    return $data;
}

// --- 콜백 구현 ------------------------------------------------------------

/**
 * 1. GET /xcd/v1/search
 */
function xcd_rest_search(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $q        = trim($request->get_param('q'));
    $area     = trim($request->get_param('area'));
    $group    = trim($request->get_param('group'));
    $page     = max(1, intval($request->get_param('page')));
    $per_page = max(1, min(100, intval($request->get_param('per_page'))));
    $offset   = ($page - 1) * $per_page;

    $where  = ['1=1'];
    $params = [];

    if ($area !== '') {
        $where[]  = 'area = %s';
        $params[] = $area;
    }
    if ($group !== '') {
        $where[]  = 'industry_group = %s';
        $params[] = $group;
    }
    if ($q !== '') {
        $where[]  = 'search_text LIKE %s';
        $params[] = '%' . $wpdb->esc_like(strtolower($q)) . '%';
    }
    $where_sql = implode(' AND ', $where);

    $count_sql = "SELECT COUNT(*) FROM $table WHERE $where_sql";
    $total = (int)$wpdb->get_var($params ? $wpdb->prepare($count_sql, $params) : $count_sql);

    $data_sql = "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url,
                        description, products, employees, country, mobile, additional_emails, founded_year, enriched_at
                 FROM $table WHERE $where_sql
                 ORDER BY area ASC, company ASC
                 LIMIT %d OFFSET %d";
    $data_params = array_merge($params, [$per_page, $offset]);
    $items = $wpdb->get_results($wpdb->prepare($data_sql, $data_params));

    return rest_ensure_response([
        'items'       => $items,
        'total'       => $total,
        'page'        => $page,
        'total_pages' => max(1, (int)ceil($total / $per_page)),
        'per_page'    => $per_page,
    ]);
}

/**
 * 2. GET /xcd/v1/list
 */
function xcd_rest_list(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $page     = max(1, intval($request->get_param('page')));
    $per_page = max(1, min(100, intval($request->get_param('per_page'))));
    $area     = trim($request->get_param('area'));
    $group    = trim($request->get_param('group'));
    $offset   = ($page - 1) * $per_page;

    // sort 필드 화이트리스트
    $sort_map = ['company' => 'company', 'area' => 'area', 'created_at' => 'created_at'];
    $sort_col = $sort_map[$request->get_param('sort')] ?? 'company';
    $dir      = strtolower($request->get_param('dir')) === 'desc' ? 'DESC' : 'ASC';

    $where  = ['1=1'];
    $params = [];

    if ($area !== '') {
        $where[]  = 'area = %s';
        $params[] = $area;
    }
    if ($group !== '') {
        $where[]  = 'industry_group = %s';
        $params[] = $group;
    }
    $where_sql = implode(' AND ', $where);

    $count_sql = "SELECT COUNT(*) FROM $table WHERE $where_sql";
    $total = (int)$wpdb->get_var($params ? $wpdb->prepare($count_sql, $params) : $count_sql);

    $data_sql = "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url,
                        description, products, employees, country, mobile, additional_emails, founded_year, enriched_at
                 FROM $table WHERE $where_sql
                 ORDER BY $sort_col $dir
                 LIMIT %d OFFSET %d";
    $data_params = array_merge($params, [$per_page, $offset]);
    $items = $wpdb->get_results($wpdb->prepare($data_sql, $data_params));

    return rest_ensure_response([
        'items'       => $items,
        'total'       => $total,
        'page'        => $page,
        'total_pages' => max(1, (int)ceil($total / $per_page)),
        'per_page'    => $per_page,
    ]);
}

/**
 * 3. GET /xcd/v1/{id}
 */
function xcd_rest_get_one(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $id = intval($request->get_param('id'));
    $item = $wpdb->get_row($wpdb->prepare(
        "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url, created_at,
                description, products, employees, country, mobile, additional_emails, founded_year, enriched_at
         FROM $table WHERE id = %d",
        $id
    ));

    if (!$item) {
        return new WP_Error('not_found', '해당 회사를 찾을 수 없습니다.', ['status' => 404]);
    }

    return rest_ensure_response($item);
}

/**
 * 4. GET /xcd/v1/stats
 */
function xcd_rest_stats(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $total    = (int)$wpdb->get_var("SELECT COUNT(*) FROM $table");
    $by_area  = $wpdb->get_results(
        "SELECT area, COUNT(*) AS `count` FROM $table GROUP BY area ORDER BY `count` DESC"
    );
    $by_group = $wpdb->get_results(
        "SELECT industry_group AS `group`, COUNT(*) AS `count` FROM $table GROUP BY industry_group ORDER BY `count` DESC"
    );

    return rest_ensure_response([
        'total'    => $total,
        'by_area'  => $by_area,
        'by_group' => $by_group,
    ]);
}

/**
 * 5. POST /xcd/v1/{id} — 회사 수정
 */
function xcd_rest_update(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $id = intval($request->get_param('id'));

    // 존재 확인 + 기존 레코드 전체 로드 (부분 업데이트 병합용)
    $existing = $wpdb->get_row(
        $wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id),
        ARRAY_A
    );
    if (!$existing) {
        return new WP_Error('not_found', '해당 회사를 찾을 수 없습니다.', ['status' => 404]);
    }

    // 부분 업데이트: 요청에 포함된 필드만 추출한다. 없는 필드는 기존값을 유지한다.
    $data = xcd_extract_company_fields($request, true);

    // company를 명시적으로 빈 값으로 보내려는 경우만 거부 (생략은 허용 → 기존값 유지)
    if (array_key_exists('company', $data) && $data['company'] === '') {
        return new WP_Error('bad_request', 'company 필드는 비울 수 없습니다.', ['status' => 400]);
    }

    if (empty($data)) {
        // 변경할 필드가 없으면 기존 레코드를 그대로 반환
        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url, created_at,
                    description, products, employees, country, mobile, additional_emails, founded_year, enriched_at
             FROM $table WHERE id = %d",
            $id
        ));
        return rest_ensure_response(['success' => true, 'item' => $item]);
    }

    // search_text는 기존값 + 신규값을 병합한 전체 레코드 기준으로 재생성
    $merged = array_merge($existing, $data);
    $data['search_text'] = mb_substr(xcd_build_search_text($merged), 0, 65535);

    $wpdb->update($table, $data, ['id' => $id]);

    $item = $wpdb->get_row($wpdb->prepare(
        "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url, created_at,
                description, products, employees, country, mobile, additional_emails, founded_year, enriched_at
         FROM $table WHERE id = %d",
        $id
    ));

    return rest_ensure_response(['success' => true, 'item' => $item]);
}

/**
 * 6. POST /xcd/v1/create — 회사 신규 등록
 */
function xcd_rest_create(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $data = xcd_extract_company_fields($request);
    if (empty($data['company'])) {
        return new WP_Error('bad_request', 'company 필드는 필수입니다.', ['status' => 400]);
    }

    $data['search_text'] = mb_substr(xcd_build_search_text($data), 0, 65535);

    $result = $wpdb->insert($table, $data);
    if ($result === false) {
        return new WP_Error('db_error', '데이터베이스 오류가 발생했습니다.', ['status' => 500]);
    }

    $new_id = $wpdb->insert_id;
    $item   = $wpdb->get_row($wpdb->prepare(
        "SELECT id, company, director, industry_group, industry_detail, area, address, tel, homepage, email, source, source_url, created_at,
                description, products, employees, country, mobile, additional_emails, founded_year, enriched_at
         FROM $table WHERE id = %d",
        $new_id
    ));

    $response = rest_ensure_response(['success' => true, 'id' => $new_id, 'item' => $item]);
    $response->set_status(201);
    return $response;
}

/**
 * 7. DELETE /xcd/v1/{id} — 회사 삭제
 */
function xcd_rest_delete(WP_REST_Request $request) {
    global $wpdb;
    $table = $wpdb->prefix . XCD_TABLE;

    $id = intval($request->get_param('id'));

    $deleted = $wpdb->delete($table, ['id' => $id], ['%d']);
    if ($deleted === false || $deleted === 0) {
        return new WP_Error('not_found', '해당 회사를 찾을 수 없습니다.', ['status' => 404]);
    }

    return rest_ensure_response(['success' => true]);
}

/**
 * 8. POST /xcd/v1/import — CSV 일괄 가져오기
 */
function xcd_rest_import(WP_REST_Request $request) {
    // multipart/form-data 파일은 $_FILES 에서 읽는다
    if (empty($_FILES['csv_file']['tmp_name'])) {
        return new WP_Error('bad_request', 'csv_file 필드가 없거나 업로드에 실패했습니다.', ['status' => 400]);
    }

    $truncate   = (string)$request->get_param('truncate') === '1';
    $tmp_path   = $_FILES['csv_file']['tmp_name'];

    // xcd_import_csv는 결과 문자열("완료 — 추가: N, 중복/제외: M ...")을 반환
    $result_str = xcd_import_csv($tmp_path, $truncate);

    // 결과 문자열 파싱
    $imported = 0;
    $skipped  = 0;
    if (preg_match('/추가:\s*(\d+)/', $result_str, $m)) {
        $imported = (int)$m[1];
    }
    if (preg_match('/중복\/제외:\s*(\d+)/', $result_str, $m)) {
        $skipped = (int)$m[1];
    }

    return rest_ensure_response([
        'success'  => true,
        'imported' => $imported,
        'skipped'  => $skipped,
        'message'  => $result_str,
    ]);
}
