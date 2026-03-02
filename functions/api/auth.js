import * as jose from 'jose';

// 세션 유지 시간: 7일
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { credential } = body;

        if (!credential) {
            return new Response("Missing credential", { status: 400 });
        }

        const clientId = env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            return new Response("Server configuration error", { status: 500 });
        }

        // 1. 구글 공개 키 셋(JWKS) 가져오기
        const JWKS = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

        // 2. JWT 토큰 검증
        // audience가 애플리케이션의 Client ID와 일치하는지 확인
        const { payload } = await jose.jwtVerify(credential, JWKS, {
            audience: clientId,
            issuer: ['https://accounts.google.com', 'accounts.google.com'],
        });

        // 3. 검증된 사용자 정보 추출
        const userInfo = {
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
        };

        // 4. (추후 DB 연동 고려) 백엔드 세션용 JWT 자체 발급
        // 여기서는 임시 시크릿키를 사용해 세션 토큰을 만듭니다.
        // 실제 운영 환경에서는 env.SESSION_SECRET 등에 별도 암호화 키를 저장하는 것이 좋습니다.
        const secretText = env.SESSION_SECRET || 'temp-secret-key-12345';
        const secret = new TextEncoder().encode(secretText);

        const sessionToken = await new jose.SignJWT(userInfo)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret);

        // 5. 브라우저 쿠키에 세션 저장 (Secure, HttpOnly)
        const expires = new Date(Date.now() + SESSION_DURATION).toUTCString();
        // 로컬 호스트 테스트를 위해 Secure는 조건부로 넣거나 생략합니다. (실 운영에선 추가)
        const cookieStr = `session=${sessionToken}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`;

        return new Response(JSON.stringify({ success: true, user: userInfo }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": cookieStr,
            }
        });

    } catch (error) {
        console.error("Token verification failed:", error);
        return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
