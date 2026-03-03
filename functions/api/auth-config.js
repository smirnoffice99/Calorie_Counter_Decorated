export async function onRequestGet(context) {
    const { env } = context;

    // 클라이언트 ID가 설정되어 있지 않은 경우의 예외 처리
    if (!env.GOOGLE_CLIENT_ID || !env.KAKAO_CLIENT_ID) {
        return new Response(JSON.stringify({ error: "Client IDs are not fully configured." }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            }
        });
    }

    // 프론트엔드에서 사용할 수 있도록 Client ID만 반환 (Secret은 반환하지 않음)
    return new Response(JSON.stringify({
        clientId: env.GOOGLE_CLIENT_ID,
        kakaoClientId: env.KAKAO_CLIENT_ID
    }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        }
    });
}
