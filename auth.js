// ===== 글로벌 인증 상태 관리 =====
let isGoogleApiLoaded = false;
let currentSession = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 세션 확인을 먼저 진행합니다.
    const isAuthenticated = await checkSession();

    // 1.5. 카카오 로그인 리다이렉트 콜백 처리
    const urlParams = new URLSearchParams(window.location.search);
    const kakaoCode = urlParams.get('code');
    if (kakaoCode) {
        // Remove code from URL for clean UI
        window.history.replaceState({}, document.title, window.location.pathname);
        await handleKakaoCallback(kakaoCode);
    }

    // 2. 구글 인증 초기화 및 카카오 인증 초기화
    await initAuth(isAuthenticated);

    // 로그아웃 버튼 이벤트 리스너
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// ===== OAuth 인증 초기화 함수 =====
async function initAuth(isAuthenticated) {
    try {
        const response = await fetch('/api/auth-config');
        if (!response.ok) {
            console.error("Auth config API returned error status:", response.status);
            return;
        }

        const data = await response.json();
        const googleClientId = data.clientId;
        const kakaoClientId = data.kakaoClientId;

        // 구글 로그인 초기화
        if (googleClientId && window.google) {
            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
                use_fedcm_for_prompt: true // FedCM (One Tap 최신 규격)
            });
            // 명시적으로 상단 우측 버튼 크기와 테마 속성을 지정하여 표시 (직관적인 텍스트 포함)
            google.accounts.id.renderButton(
                document.getElementById("authContainer"),
                { theme: "outline", size: "medium", type: "standard", shape: "pill", text: "signin_with" }
            );

            // 사용자가 로그인 상태가 아닐 때만 원탭 로그인 프롬프트 띄우기
            if (!isAuthenticated) {
                google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        console.log('One Tap was not displayed or skipped:', notification.getNotDisplayedReason() || notification.getSkippedReason());
                    }
                });
            }

            isGoogleApiLoaded = true;
        } else {
            console.error("Google script not loaded or ClientID missing.");
        }

        // 카카오 로그인 초기화
        if (kakaoClientId && window.Kakao) {
            if (!Kakao.isInitialized()) {
                Kakao.init(kakaoClientId);
                console.log('Kakao SDK initialized');
            }

            const kakaoBtn = document.getElementById('kakaoLoginBtn');
            if (kakaoBtn) {
                kakaoBtn.addEventListener('click', handleKakaoLogin);
            }
        } else {
            console.error("Kakao script not loaded or ClientID missing.");
            const kakaoBtn = document.getElementById('kakaoLoginBtn');
            if (kakaoBtn) kakaoBtn.style.display = 'none';
        }
    } catch (err) {
        console.error("Failed to load auth config:", err);
    }
}

// 카카오 로그인 핸들러
function handleKakaoLogin() {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
        alert("카카오 로그인을 초기화할 수 없습니다.");
        return;
    }

    // 카카오 JS SDK v2 에서는 Kakao.Auth.authorize 사용을 권장 (리다이렉트 방식)
    Kakao.Auth.authorize({
        redirectUri: window.location.origin + window.location.pathname
    });
}

// 카카오 리다이렉트 후 코드 처리 콜백
async function handleKakaoCallback(authCode) {
    try {
        const authRes = await fetch('/api/auth-kakao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: authCode, redirectUri: window.location.origin + window.location.pathname })
        });

        if (authRes.ok) {
            const data = await authRes.json();
            currentSession = data.user;
            updateAuthUI(true);
        } else {
            console.error("Kakao authentication failed on server.");
            updateAuthUI(false);
            alert("카카오 로그인에 실패했습니다.");
        }
    } catch (err) {
        console.error("Error during Kakao authentication:", err);
        updateAuthUI(false);
    }
}

// 구글 로그인 성공 콜백
async function handleCredentialResponse(response) {
    if (!response.credential) return;

    try {
        const authRes = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        if (authRes.ok) {
            const data = await authRes.json();
            currentSession = data.user;
            updateAuthUI(true);
        } else {
            console.error("Authentication failed.");
            updateAuthUI(false);
        }
    } catch (err) {
        console.error("Error during authentication:", err);
        updateAuthUI(false);
    }
}

// 세션 유지 확인 (비동기 결과를 반환하도록 수정)
async function checkSession() {
    try {
        const res = await fetch('/api/session');
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
                currentSession = data.user;
                updateAuthUI(true);
                return true;
            } else {
                updateAuthUI(false);
                return false;
            }
        } else {
            updateAuthUI(false);
            return false;
        }
    } catch (error) {
        console.error("Session check failed:", error);
        updateAuthUI(false);
        return false;
    }
}

// 로그아웃 처리
async function handleLogout() {
    try {
        const res = await fetch('/api/session', { method: 'DELETE' });
        if (res.ok) {
            currentSession = null;
            updateAuthUI(false);
        }
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// UI 업데이트 로직
function updateAuthUI(isLoggedIn) {
    const loginWrapper = document.getElementById('loginWrapper');
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');
    const saveRecordBtn = document.getElementById('saveRecordBtn');

    if (isLoggedIn && currentSession) {
        // 로그인 상태 UI
        if (loginWrapper) loginWrapper.style.display = 'none';
        if (userProfile) userProfile.classList.remove('hidden');
        if (userAvatar && currentSession.picture) {
            userAvatar.src = currentSession.picture;
            userAvatar.style.display = 'block';
            userAvatar.title = `${currentSession.name} (${currentSession.email})`; // Remove explicit text, use hover tooltip instead
        } else if (userAvatar) {
            userAvatar.style.display = 'none';
        }
        if (saveRecordBtn) saveRecordBtn.classList.remove('hidden');
    } else {
        // 비회원 상태 UI
        if (loginWrapper) loginWrapper.style.display = 'flex';
        if (userProfile) userProfile.classList.add('hidden');
        if (userAvatar) userAvatar.src = '';
        if (saveRecordBtn) saveRecordBtn.classList.add('hidden');
    }
}
