window.addEventListener('load', function() {
    // Firebase 설정
    var firebaseConfig = {
        apiKey: "AIzaSyAAtT9gcu8eVQIhQxYEgBTGp2XZ6ghz_NU",
        authDomain: "chaovietnam-login.firebaseapp.com",
        projectId: "chaovietnam-login",
        storageBucket: "chaovietnam-login.firebasestorage.app",
        messagingSenderId: "249390849714",
        appId: "1:249390849714:web:95ae3e7f066b70ffe973ab"
    };

    // Firebase 초기화 (SDK가 footer에서 로드된 후 이 시점에 확실히 존재)
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Kakao SDK 초기화
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
        Kakao.init('eb4612604473e026e6cc7ed41ededbc3');
    }

    var auth = firebase.auth();
    // wp_localize_script로 전달된 chaovnAuth 객체 이용
    var restUrl = typeof chaovnAuth !== 'undefined' ? chaovnAuth.restUrl : '';
    var nonce = typeof chaovnAuth !== 'undefined' ? chaovnAuth.nonce : '';
    var redirectUrl = typeof chaovnAuth !== 'undefined' ? chaovnAuth.redirect : '';

    // UI 요소
    var loginBtn = document.getElementById('chaovn-login-btn');
    var toggleModeBtn = document.getElementById('chaovn-toggle-mode');
    var googleBtn = document.getElementById('chaovn-google-login-btn');
    var kakaoBtn = document.getElementById('chaovn-kakao-login-btn');
    var appleBtn = document.getElementById('chaovn-apple-login-btn');
    var emailInput = document.getElementById('chaovn-email');
    var passwordInput = document.getElementById('chaovn-password');
    var errorDiv = document.getElementById('chaovn-auth-error');
    var loadingDiv = document.getElementById('chaovn-auth-loading');

    var isSignupMode = false;
    var allBtns = [loginBtn, googleBtn, kakaoBtn, appleBtn];

    function showError(msg, isHtml = false) {
        if (isHtml) {
            errorDiv.innerHTML = msg;
        } else {
            errorDiv.textContent = msg;
        }
        errorDiv.style.display = 'block';
        if (loadingDiv) loadingDiv.style.display = 'none';
        allBtns.forEach(function(b){ if(b) b.disabled = false; });
    }

    function disableAll() {
        allBtns.forEach(function(b){ if(b) b.disabled = true; });
    }

    function verifyTokenWithWP(idToken, kakaoInfo) {
        if (!loadingDiv) return;
        loadingDiv.textContent = "워드프레스와 안전하게 로그인 동기화 중입니다...";
        loadingDiv.style.display = 'block';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', restUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('X-WP-Nonce', nonce);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.success) {
                        loadingDiv.textContent = "로그인 완료! 이동합니다...";
                        window.location.href = redirectUrl;
                    } else {
                        showError("서버 연동 오류: " + resp.message);
                    }
                } else {
                    showError("로그인 스크립트 연동 오류.");
                }
            }
        };
        var reqData = 'token=' + encodeURIComponent(idToken);
        if (kakaoInfo) {
            if (kakaoInfo.email) reqData += '&kakao_email=' + encodeURIComponent(kakaoInfo.email);
            if (kakaoInfo.name)  reqData += '&kakao_name='  + encodeURIComponent(kakaoInfo.name);
        }
        xhr.send(reqData);
    }

    // 회원가입/로그인 모드 전환
    if (toggleModeBtn) {
        toggleModeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            isSignupMode = !isSignupMode;
            if (isSignupMode) {
                loginBtn.textContent = '이메일로 회원가입';
                toggleModeBtn.textContent = '이미 계정이 있으신가요? 로그인';
                loginBtn.style.backgroundColor = '#28a745';
            } else {
                loginBtn.textContent = '이메일로 로그인';
                toggleModeBtn.textContent = '계정이 없으신가요? 회원가입';
                loginBtn.style.backgroundColor = '#FF6B35';
            }
            if (errorDiv) errorDiv.style.display = 'none';
        });
    }

    // 이메일 로그인
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var email = emailInput ? emailInput.value.trim() : '';
            var password = passwordInput ? passwordInput.value.trim() : '';
            if (!email || !password) { showError("이메일과 비밀번호를 입력해주세요."); return; }
            if (errorDiv) errorDiv.style.display = 'none';
            if (loadingDiv) {
                loadingDiv.textContent = "Firebase 권한 확인 중...";
                loadingDiv.style.display = 'block';
            }
            disableAll();

            var p = isSignupMode
                ? auth.createUserWithEmailAndPassword(email, password)
                : auth.signInWithEmailAndPassword(email, password);

            p.then(function(uc) { return uc.user.getIdToken(true); })
             .then(function(t) { verifyTokenWithWP(t); })
             .catch(function(err) {
                var msg = (isSignupMode ? "회원가입 실패: " : "로그인 실패: ") + err.message;
                var isHtml = false;
                if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    msg = "이메일이나 비밀번호가 올바르지 않습니다.<br><br><button type='button' id='chaovn-reset-pw-btn' style='background:none; border:none; color:#1a73e8; cursor:pointer; font-weight:bold; padding:0; text-decoration:underline;'>비밀번호 재설정 메일 받기</button>";
                    isHtml = true;
                }
                else if (err.code === 'auth/email-already-in-use') msg = "이미 가입된 이메일입니다. 로그인 모드로 전환해주세요.";
                else if (err.code === 'auth/weak-password') msg = "비밀번호는 최소 6자리 이상이어야 합니다.";
                
                showError(msg, isHtml);

                if (isHtml) {
                    var resetBtn = document.getElementById('chaovn-reset-pw-btn');
                    if (resetBtn) {
                        resetBtn.addEventListener('click', function() {
                            if (errorDiv) errorDiv.style.display = 'none';
                            if (loadingDiv) {
                                loadingDiv.textContent = "비밀번호 재설정 메일을 보내고 있습니다...";
                                loadingDiv.style.display = 'block';
                            }
                            disableAll();
                            auth.sendPasswordResetEmail(email)
                                .then(function() {
                                    if (loadingDiv) loadingDiv.style.display = 'none';
                                    alert("비밀번호 재설정 메일이 전송되었습니다. 메일함을 확인해주세요.");
                                    allBtns.forEach(function(b){ if(b) b.disabled = false; });
                                })
                                .catch(function(resetErr) {
                                    showError("메일 전송 실패: " + resetErr.message);
                                });
                        });
                    }
                }
             });
        });
    }

    // 카카오 로그인
    if (kakaoBtn) {
        kakaoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof Kakao === 'undefined') { showError("Kakao SDK 로드 실패. 새로고침 해주세요."); return; }
            if (errorDiv) errorDiv.style.display = 'none';
            if (loadingDiv) {
                loadingDiv.textContent = "Kakao 로그인 창을 여는 중입니다...";
                loadingDiv.style.display = 'block';
            }
            disableAll();

            Kakao.Auth.login({
                scope: 'profile_nickname,profile_image,account_email',
                success: function(authObj) {
                    Kakao.API.request({
                        url: '/v2/user/me',
                        data: { property_keys: ['kakao_account.email', 'kakao_account.profile', 'properties.nickname'] },
                        success: function(res) {
                            var kakaoId = res.id;
                            var kakaoEmail = 'kakao_' + kakaoId + '@chaovietnam.co.kr';
                            var kakaoPassword = 'kakao_login_sec_' + kakaoId;

                            // 닉네임: kakao_account.profile.nickname 또는 properties.nickname
                            var realName = '';
                            if (res.kakao_account && res.kakao_account.profile && res.kakao_account.profile.nickname) {
                                realName = res.kakao_account.profile.nickname;
                            } else if (res.properties && res.properties.nickname) {
                                realName = res.properties.nickname;
                            }

                            // 이메일: kakao_account.email
                            var realEmail = (res.kakao_account && res.kakao_account.email) ? res.kakao_account.email : '';

                            var kakaoInfo = { email: realEmail, name: realName };
                            if (loadingDiv) loadingDiv.textContent = "Kakao 인증 성공, 서버 동기화 중...";

                            auth.signInWithEmailAndPassword(kakaoEmail, kakaoPassword)
                                .catch(function(err) {
                                    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                                        return auth.createUserWithEmailAndPassword(kakaoEmail, kakaoPassword);
                                    }
                                    throw err;
                                })
                                .then(function(uc) { return uc.user.getIdToken(true); })
                                .then(function(t) { verifyTokenWithWP(t, kakaoInfo); })
                                .catch(function(err) { showError("카카오 계정 동기화 실패: " + err.message); });
                        },
                        fail: function() { showError("Kakao 프로필 가져오기 실패."); }
                    });
                },
                fail: function() { showError("Kakao 로그인이 취소되었거나 실패했습니다."); }
            });
        });
    }

    // Apple 로그인
    if (appleBtn) {
        appleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (errorDiv) errorDiv.style.display = 'none';
            if (loadingDiv) {
                loadingDiv.textContent = "Apple 로그인 창을 여는 중입니다...";
                loadingDiv.style.display = 'block';
            }
            disableAll();

            var provider = new firebase.auth.OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');

            auth.signInWithPopup(provider)
                .then(function(r) { return r.user.getIdToken(true); })
                .then(function(t) { verifyTokenWithWP(t); })
                .catch(function(err) { showError("Apple 로그인 취소 또는 실패: " + err.message); });
        });
    }
});
