<?php

if (!defined('ABSPATH')) {
    exit;
}

class ChaoVN_Firebase_Token_Verifier {

    private $project_id;
    private $keys_url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

    public function __construct($project_id) {
        $this->project_id = $project_id;
    }

    /**
     * Firebase 공개 키 가져오기 (시간 만료 기능 캐싱 포함)
     */
    private function get_public_keys() {
        $keys = get_transient('chaovn_firebase_public_keys');
        if (false !== $keys) {
            return $keys;
        }

        $response = wp_remote_get($this->keys_url);
        if (is_wp_error($response)) {
            return new WP_Error('keys_fetch_failed', 'Google Public 키를 서버에서 가져오지 못했습니다.');
        }

        $body = wp_remote_retrieve_body($response);
        $keys = json_decode($body, true);

        if (empty($keys)) {
            return new WP_Error('invalid_keys', '응답받은 Public 키 데이터가 올바르지 않습니다.');
        }

        // Cache-Control 헤더가 있으면 읽어서 TTL 지정, 없으면 임의로 6시간 지정
        $cache_control = wp_remote_retrieve_header($response, 'cache-control');
        $ttl = 6 * HOUR_IN_SECONDS; 
        if ($cache_control && preg_match('/max-age=(\d+)/', $cache_control, $matches)) {
            $ttl = intval($matches[1]);
        }

        set_transient('chaovn_firebase_public_keys', $keys, $ttl);
        return $keys;
    }

    /**
     * JWT 디코드 원본 헬퍼 (Url safe base64 decode)
     */
    private function base64url_decode($data) {
        $b64 = str_replace(array('-', '_'), array('+', '/'), $data);
        return base64_decode($b64);
    }

    /**
     * JSON Web Token (JWT) 검증 메인 함수
     */
    public function verify_id_token($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return new WP_Error('invalid_token', '토큰 형식이 올바르지 않습니다. (파트가 3개의 분절이 아님)');
        }

        list($header64, $payload64, $crypto64) = $parts;

        $header_str  = $this->base64url_decode($header64);
        $payload_str = $this->base64url_decode($payload64);
        $signature   = $this->base64url_decode($crypto64);

        $header  = json_decode($header_str, true);
        $payload = json_decode($payload_str, true);

        if (empty($header) || empty($payload)) {
            return new WP_Error('json_error', '헤더/페이로드의 JSON 디코딩에 실패했습니다.');
        }

        // 1. 헤더 검사 (alg)
        if (!isset($header['alg']) || $header['alg'] !== 'RS256') {
            return new WP_Error('wrong_alg', '잘못된 서명 방식입니다. (RS256 필요)');
        }

        // 2. 키 아이디(kid) 확인
        if (!isset($header['kid'])) {
            return new WP_Error('no_kid', '헤더에 kid 필드가 없습니다.');
        }
        $kid = $header['kid'];

        // 3. 퍼블릭 키 로드
        $public_keys = $this->get_public_keys();
        if (is_wp_error($public_keys)) {
            return $public_keys;
        }

        if (!isset($public_keys[$kid])) {
            // 만약 캐시 문제로 키가 없다면 강제로 무효화 후 한번 더 시도해볼 수 있음.
            delete_transient('chaovn_firebase_public_keys');
            $public_keys = $this->get_public_keys();
            if (!isset($public_keys[$kid])) {
                return new WP_Error('kid_not_found', "발행된 공개 키에 해당하는 아이디({$kid})가 없습니다.");
            }
        }

        $certificate = $public_keys[$kid];

        // 4. 서명 검증 (PHP openssl_verify)
        $data_to_verify = $header64 . '.' . $payload64;
        $verify_result = openssl_verify($data_to_verify, $signature, $certificate, OPENSSL_ALGO_SHA256);

        if ($verify_result !== 1) {
            return new WP_Error('invalid_signature', 'RSA 서명 검증에 실패했습니다. (위조된 토큰)');
        }

        // 5. Payload 필드 검증 (시간, 발급자, 대상자)
        $current_time = time();

        if (isset($payload['exp']) && $current_time > $payload['exp']) {
            return new WP_Error('token_expired', '토큰이 만료되었습니다.');
        }
        if (isset($payload['iat']) && $current_time < ($payload['iat'] - 60)) { // 60초 시차 허용
            return new WP_Error('token_early', '토큰 발급 시간이 미래입니다.');
        }
        if (!isset($payload['aud']) || $payload['aud'] !== $this->project_id) {
            return new WP_Error('wrong_audience', '토큰의 대상(aud) 정보가 프로젝트 ID와 일치하지 않습니다.');
        }
        if (!isset($payload['iss']) || $payload['iss'] !== 'https://securetoken.google.com/' . $this->project_id) {
            return new WP_Error('wrong_issuer', '토큰의 발급자(iss) 정보가 프로젝트 ID와 일치하지 않습니다.');
        }
        if (!isset($payload['sub']) || empty($payload['sub'])) {
            return new WP_Error('no_subject', '토큰의 주체(sub, uid) 정보가 없습니다.');
        }

        return $payload; // 모든 검증을 통과하면 payload 리턴.
    }
}
