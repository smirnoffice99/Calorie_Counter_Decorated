export async function onRequestGet(context) {
    const { env } = context;

    // 구글 클라이언트 ID가 설정되어 있지 않은 경우의 예외 처리 (필수)
    if (!env.GOOGLE_CLIENT_ID) {
        return new Response(JSON.stringify({ error: "Google Client ID is not configured." }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            }
        });
    }

    // 카카오 클라이언트 ID는 없으면 없는 대로 null 반환하여 프론트에서 버튼만 숨기도록 유연하게 처리
    return new Response(JSON.stringify({
        clientId: env.GOOGLE_CLIENT_ID,
        kakaoClientId: env.KAKAO_CLIENT_ID || null
    }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        }
    });
}
