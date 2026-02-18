<?php
/**
 * Plugin Name: ChaoVN User Welcome Emails
 * Description: Sends welcome emails to new users
 * Version: 1.0.1
 * Author: ChaoVN App Team
 */

if (!defined('ABSPATH')) {
    exit;
}

// 새 사용자 가입 시 축하 이메일 발송 (비동기 처리)
add_action('user_register', 'chaovn_send_welcome_email', 10, 1);

function chaovn_send_welcome_email($user_id) {
    try {
        $user = get_userdata($user_id);
        
        if (!$user || empty($user->user_email)) {
            return;
        }

        $user_email = $user->user_email;
        $user_name = !empty($user->display_name) ? $user->display_name : $user->user_login;
        $blog_name = get_option('blogname');

        $subject = '🎉 ' . $blog_name . ' 회원가입을 축하합니다!';

        $html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #FF6B35; font-size: 28px; margin: 0;">🎉 환영합니다!</h1>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <p style="font-size: 16px; color: #333; margin: 0;">
                    <strong>' . esc_html($user_name) . '</strong>님,
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    씬짜오베트남(XinChao Vietnam) 앱에 가입해주셔서 감사합니다! 🙏
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    베트남 생활을 더욱 편리하게 해주는 다양한 정보와 커뮤니티를 이용할 수 있습니다.
                </p>
            </div>

            <div style="margin-bottom: 20px;">
                <h2 style="color: #333; font-size: 18px;">우리 앱의 주요 기능</h2>
                <ul style="color: #666; line-height: 1.8; font-size: 14px;">
                    <li>📰 최신 한인 뉴스 및 정보</li>
                    <li>👔 구인구직 정보</li>
                    <li>🏠 부동산 정보</li>
                    <li>💼 중고 거래 마켓</li>
                    <li>💬 커뮤니티 게시판</li>
                    <li>📱 실시간 채팅</li>
                </ul>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #FF6B35; margin-bottom: 20px;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                    💡 프로필을 완성하여 더 많은 기능을 이용하세요!
                </p>
            </div>

            <div style="text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                    질문이 있으신가요? 앱 내 고객 지원 센터를 통해 연락 주세요.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 10px;">
                    © 2026 XinChao Vietnam. All rights reserved.
                </p>
            </div>
        </div>';

        // WordPress 이메일 헤더 설정
        $headers = array('Content-Type: text/html; charset=UTF-8');
        
        // 이메일 발송 (에러 무시)
        @wp_mail($user_email, $subject, $html_content, $headers);
        
        // 로그 기록 (선택사항)
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('✅ 축하 이메일 발송 시도: ' . $user_email);
        }
    } catch (Exception $e) {
        // 에러 발생해도 WordPress는 계속 작동
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('⚠️ 이메일 발송 중 에러: ' . $e->getMessage());
        }
    }
}
