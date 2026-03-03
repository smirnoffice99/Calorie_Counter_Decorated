import * as jose from 'jose';

export async function onRequestGet(context) {
    const { request, env } = context;

    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) {
        return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
    }

    // 세션 쿠키 추출
    const cookies = cookieHeader.split(';').reduce((acc, cookieStr) => {
        const [key, value] = cookieStr.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});

    const sessionToken = cookies['session'];
    if (!sessionToken) {
        return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
    }

    try {
        const secretText = env.SESSION_SECRET || 'temp-secret-key-12345';
        const secret = new TextEncoder().encode(secretText);

        const { payload } = await jose.jwtVerify(sessionToken, secret);

        return new Response(JSON.stringify({
            authenticated: true,
            user: {
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
            }
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
    }
}

export async function onRequestDelete(context) {
    const { request } = context;
    const isHttps = new URL(request.url).protocol === 'https:';
    const secureFlag = isHttps ? 'Secure;' : '';

    // 로그아웃 시 쿠키 즉시 만료 처리
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Set-Cookie": `session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${secureFlag} SameSite=Lax`,
        }
    });
}
