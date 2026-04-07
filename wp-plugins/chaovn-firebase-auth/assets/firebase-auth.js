(function ($) {
    $(document).ready(function () {
        // 1. Firebase 설정 (App.js의 firebaseConfig와 동일)
        const firebaseConfig = {
            apiKey: "AIzaSyAAtT9gcu8eVQIhQxYEgBTGp2XZ6ghz_NU",
            authDomain: "chaovietnam-login.firebaseapp.com",
            projectId: "chaovietnam-login",
            storageBucket: "chaovietnam-login.firebasestorage.app",
            messagingSenderId: "249390849714",
            appId: "1:249390849714:web:95ae3e7f066b70ffe973ab"
        };

        // Firebase 초기화 (중복 로드 방지)
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Kakao SDK 초기화
        if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
            Kakao.init('eb4612604473e026e6cc7cd41ededbc3');
        }

        const auth = firebase.auth();

        // UI 요소 가져오기
        const $emailInput = $('#chaovn-email');
        const $passwordInput = $('#chaovn-password');
        const $loginBtn = $('#chaovn-login-btn');
        const $toggleModeBtn = $('#chaovn-toggle-mode');
        const $googleLoginBtn = $('#chaovn-google-login-btn');
        const $kakaoLoginBtn = $('#chaovn-kakao-login-btn');
        const $appleLoginBtn = $('#chaovn-apple-login-btn');
        const $errorDiv = $('#chaovn-auth-error');
        const $loadingDiv = $('#chaovn-auth-loading');

        let isSignupMode = false;

        $toggleModeBtn.on('click', function(e) {
            e.preventDefault();
            isSignupMode = !isSignupMode;
            if (isSignupMode) {
                $loginBtn.text('이메일로 회원가입');
                $toggleModeBtn.text('이미 계정이 있으신가요? 로그인');
                // Change UI theme slightly to indicate signup
                $loginBtn.css('background-color', '#28a745');
            } else {
                $loginBtn.text('이메일로 로그인');
                $toggleModeBtn.text('계정이 없으신가요? 회원가입');
                $loginBtn.css('background-color', '#FF6B35');
            }
            $errorDiv.hide();
        });

        function enableButtons() {
            $loginBtn.prop('disabled', false);
            $googleLoginBtn.prop('disabled', false);
            $kakaoLoginBtn.prop('disabled', false);
            $appleLoginBtn.prop('disabled', false);
        }

        function disableButtons() {
            $loginBtn.prop('disabled', true);
            $googleLoginBtn.prop('disabled', true);
            $kakaoLoginBtn.prop('disabled', true);
            $appleLoginBtn.prop('disabled', true);
        }

        function showError(msg) {
            $errorDiv.text(msg).show();
            $loadingDiv.hide();
            enableButtons();
        }

        function verifyTokenWithWP(idToken) {
            $loadingDiv.text("워드프레스와 안전하게 로그인 동기화 중입니다...").show();
            
            $.ajax({
                url: chaovnAuth.restUrl,
                method: 'POST',
                data: {
                    token: idToken
                },
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('X-WP-Nonce', chaovnAuth.nonce);
                },
                success: function (response) {
                    if (response.success) {
                        $loadingDiv.text("로그인이 완료되었습니다. 이동합니다...");
                        window.location.href = chaovnAuth.redirect;
                    } else {
                        showError("서버 연동 오류: " + response.message);
                    }
                },
                error: function (xhr) {
                    let errMsg = "로그인 스크립트 연동 오류.";
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errMsg = xhr.responseJSON.message;
                    }
                    showError(errMsg);
                }
            });
        }

        // 이메일 로그인 처리
        $loginBtn.on('click', function (e) {
            e.preventDefault();
            const email = $emailInput.val().trim();
            const password = $passwordInput.val().trim();

            if (!email || !password) {
                showError("이메일과 비밀번호를 입력해주세요.");
                return;
            }

            $errorDiv.hide();
            $loadingDiv.text("Firebase 권한 확인 중...").show();
            disableButtons();

            let authPromise;
            if (isSignupMode) {
                authPromise = auth.createUserWithEmailAndPassword(email, password);
            } else {
                authPromise = auth.signInWithEmailAndPassword(email, password);
            }

            authPromise
                .then(function (userCredential) {
                    return userCredential.user.getIdToken(true);
                })
                .then(function (idToken) {
                    verifyTokenWithWP(idToken);
                })
                .catch(function (error) {
                    let msg = (isSignupMode ? "회원가입 실패: " : "로그인 실패: ") + error.message;
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        msg = "이메일이나 비밀번호가 올바르지 않습니다.";
                    } else if (error.code === 'auth/email-already-in-use') {
                        msg = "이미 가입된 이메일입니다. 로그인 모드로 전환해주세요.";
                    } else if (error.code === 'auth/weak-password') {
                        msg = "비밀번호는 최소 6자리 이상이어야 합니다.";
                    }
                    showError(msg);
                });
        });

        // 구글 로그인 처리 (팝업)
        $googleLoginBtn.on('click', function (e) {
            e.preventDefault();
            $errorDiv.hide();
            $loadingDiv.text("Google 로그인 창을 여는 중입니다...").show();
            disableButtons();

            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then(function (result) {
                    return result.user.getIdToken(true);
                })
                .then(function (idToken) {
                    verifyTokenWithWP(idToken);
                })
                .catch(function (error) {
                    showError("Google 로그인 취소 또는 실패 (" + error.message + ")");
                });
        });

        // 카카오 로그인 처리
        $kakaoLoginBtn.on('click', function (e) {
            e.preventDefault();
            if (typeof Kakao === 'undefined') {
                showError("Kakao SDK를 로드하지 못했습니다. 새로고침 후 다시 시도해주세요.");
                return;
            }
            $errorDiv.hide();
            $loadingDiv.text("Kakao 간편 로그인 창을 여는 중입니다...").show();
            disableButtons();

            Kakao.Auth.login({
                success: function(authObj) {
                    Kakao.API.request({
                        url: '/v2/user/me',
                        success: function(res) {
                            const kakaoId = res.id;
                            // 앱과 완벽히 동일한 생성 공식 사용!
                            const kakaoEmail = `kakao_${kakaoId}@chaovietnam.co.kr`;
                            const kakaoPassword = `kakao_login_sec_${kakaoId}`;
                            
                            $loadingDiv.text("Kakao 인증 성공, 서버와 동기화 중입니다...").show();
                            
                            auth.signInWithEmailAndPassword(kakaoEmail, kakaoPassword)
                                .catch(function(error) {
                                    // 기존 회원이 없으면 자동으로 백그라운드 회원가입 처리
                                    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                                        return auth.createUserWithEmailAndPassword(kakaoEmail, kakaoPassword);
                                    }
                                    throw error;
                                })
                                .then(function(userCredential) {
                                    return userCredential.user.getIdToken(true);
                                })
                                .then(function(idToken) {
                                    verifyTokenWithWP(idToken);
                                })
                                .catch(function(error) {
                                    showError("카카오 계정 동기화 실패: " + error.message);
                                });
                        },
                        fail: function(error) {
                            showError("Kakao 프로필을 가져오지 못했습니다.");
                        }
                    });
                },
                fail: function(err) {
                    showError("Kakao 로그인이 취소되었거나 실패했습니다.");
                }
            });
        });

        // Apple 로그인 처리 (팝업)
        $appleLoginBtn.on('click', function (e) {
            e.preventDefault();
            $errorDiv.hide();
            $loadingDiv.text("Apple 로그인 창을 여는 중입니다...").show();
            disableButtons();

            const provider = new firebase.auth.OAuthProvider('apple.com');
            // 필요한 경우 scope 추가
            provider.addScope('email');
            provider.addScope('name');

            auth.signInWithPopup(provider)
                .then(function (result) {
                    return result.user.getIdToken(true);
                })
                .then(function (idToken) {
                    verifyTokenWithWP(idToken);
                })
                .catch(function (error) {
                    showError("Apple 로그인 취소 또는 실패 (" + error.message + ")");
                });
        });
    });
})(jQuery);
