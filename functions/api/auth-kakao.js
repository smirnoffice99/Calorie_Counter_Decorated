import * as jose from 'jose';

// 세션 유지 시간: 7일
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { code, redirectUri } = body;

        let access_token = body.access_token; // Fallback in case frontend sends token directly

        if (code) {
            // Exchange code for access_token
            const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-type": "application/x-www-form-urlencoded;charset=utf-8"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: env.KAKAO_CLIENT_ID,
                    redirect_uri: redirectUri,
                    code: code
                })
            });

            if (!tokenRes.ok) {
                const errData = await tokenRes.text();
                console.error("Failed to fetch Kakao token:", errData);
                return new Response(JSON.stringify({ error: "Failed to exchange Kakao code" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const tokenData = await tokenRes.json();
            access_token = tokenData.access_token;
        }

        if (!access_token) {
            return new Response("Missing access_token or code", { status: 400 });
        }

        // 1. 카카오 사용자 정보 API 호출 (access_token 사용)
        const kakaoRes = await fetch("https://kapi.kakao.com/v2/user/me", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "Content-type": "application/x-www-form-urlencoded;charset=utf-8"
            }
        });

        if (!kakaoRes.ok) {
            const errData = await kakaoRes.text();
            console.error("Failed to fetch user info from Kakao:", errData);
            return new Response(JSON.stringify({ error: "Invalid Kakao token" }), {
                status: 401,
                headers: {
                    "Content-Type": "application/json"
                }
            });
        }

        const kakaoUser = await kakaoRes.json();

        // 2. 이메일 필수 확인 (구글 계정과의 통합 기준)
        const kakaoAccount = kakaoUser.kakao_account;
        if (!kakaoAccount || !kakaoAccount.email) {
            return new Response(JSON.stringify({ error: "Email is required for Kakao login to merge accounts." }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json"
                }
            });
        }

        // 3. 검증된 사용자 정보 추출 (구글 JWT 구조와 동일하게 맞춤)
        const userInfo = {
            sub: `kakao_${kakaoUser.id}`, // 카카오 고유 ID (선택적 사용)
            email: kakaoAccount.email, // 매우 중요: 이메일 기준으로 동일 사용자 인식
            name: kakaoAccount.profile?.nickname || 'Kakao User',
            picture: kakaoAccount.profile?.profile_image_url || '',
        };

        // 4. 백엔드 세션용 JWT 자체 발급 (auth.js와 동일한 방식)
        const secretText = env.SESSION_SECRET || 'temp-secret-key-12345';
        const secret = new TextEncoder().encode(secretText);

        const sessionToken = await new jose.SignJWT(userInfo)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret);

        // 5. 브라우저 쿠키에 세션 저장 (Secure, HttpOnly)
        const expires = new Date(Date.now() + SESSION_DURATION).toUTCString();
        const cookieStr = `session=${sessionToken}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`;

        return new Response(JSON.stringify({ success: true, user: userInfo }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": cookieStr,
            }
        });

    } catch (error) {
        console.error("Kakao authentication process failed:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
