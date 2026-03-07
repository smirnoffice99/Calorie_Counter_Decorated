import * as jose from 'jose';

export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. 세션 확인 및 유저 이메일 추출
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const cookies = cookieHeader.split(';').reduce((acc, cookieStr) => {
        const [key, value] = cookieStr.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});

    const sessionToken = cookies['session'];
    if (!sessionToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    let userEmail;
    try {
        const secretText = env.SESSION_SECRET || 'temp-secret-key-12345';
        const secret = new TextEncoder().encode(secretText);
        const { payload } = await jose.jwtVerify(sessionToken, secret);
        userEmail = payload.email;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid Session" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    // 2. 요청 본문 데이터 추출
    try {
        const bodyText = await request.text();
        const { date, time, items, calories, carbs, protein, fat } = JSON.parse(bodyText);

        // 유효성 검사
        if (!date || calories === undefined) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 3. D1 DB에 저장
        const stmt = env.DB.prepare(
            `INSERT INTO diet_logs (user_id, date, time, items, calories, carbs, protein, fat) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(userEmail, date, time, items || "", calories, carbs, protein, fat);

        await stmt.run();

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("DB Insert Error:", error);
        return new Response(JSON.stringify({ success: false, error: "Database error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
