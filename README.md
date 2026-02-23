# 🚀 AI 칼로리 카운터 배포 가이드

이 프로젝트는 서버 없이 HTML, CSS, JS만으로 구성되어 있어, 무료 웹 호스팅 서비스를 통해 아주 쉽게 배포하고 고유한 링크를 가질 수 있습니다.

---

## 1. Netlify를 이용한 초간편 배포 (추천)
가장 빠르고 쉬운 방법입니다. 별도의 설정 없이 폴더를 드래그 앤 드롭하기만 하면 됩니다.

1.  **[Netlify Drop](https://app.netlify.com/drop)** 사이트에 접속합니다.
2.  이 프로젝트의 전체 폴더(`Calorie_Counter_Decorated`)를 브라우저 화면의 점선 영역 위로 **드래그 앤 드롭**합니다.
3.  업로드 즉시 고유한 URL(예: `shiny-cupcake-123.netlify.app`)이 생성됩니다!

---

## 2. Vercel을 이용한 배포
대중적인 배포 플랫폼으로, CLI(명령줄)를 이용하면 매우 빠릅니다.

1.  터미널(PowerShell 등)을 엽니다.
2.  `npx vercel` 명령어를 입력합니다.
3.  로그인 및 가이드에 따라 `Enter`만 몇 번 누르면 배포가 완료되고 링크가 제공됩니다.

---

## 3. GitHub Pages를 이용한 배포
코드를 GitHub 저장소에 올려두었다면, 설정 메뉴에서 클릭 몇 번으로 무료 호스팅이 가능합니다.

1.  GitHub 저장소의 **Settings** -> **Pages** 메뉴로 이동합니다.
2.  **Branch**에서 `main` (또는 `master`) 브라우저와 `/(root)` 폴더를 선택하고 **Save**를 누릅니다.
3.  잠시 후 `https://사용자이름.github.io/저장소이름` 주소로 배포됩니다.

---

## 4. Cloudflare Pages를 이용한 배포
매우 빠르고 안정적인 서비스로, 대역폭 제한이 거의 없는 것이 장점입니다.

1.  **[Cloudflare 대시보드](https://dash.cloudflare.com/)**에 로그인합니다.
2.  **Workers & Pages** -> **Create application** -> **Pages** 탭으로 이동합니다.
3.  **Upload assets**를 선택하고 프로젝트 이름을 입력합니다.
4.  프로젝트의 전체 폴더(`Calorie_Counter_Decorated`)를 업로드 영역에 드래그 앤 드롭합니다.
5.  **Deploy site**를 누르면 `https://프로젝트이름.pages.dev` 주소로 배포됩니다.

---

## ⚠️ 주의사항
- **보안 설정 (필수)**: 이 앱은 Cloudflare Functions를 백엔드 프록시로 사용합니다. 배포 후 반드시 Cloudflare 프로젝트 설정의 **Settings -> Variables -> Environment Variables** 메뉴에서 `GEMINI_API_KEY`라는 이름으로 실제 API 키를 **Secret**으로 등록해야 합니다.
- **백엔드 프록시**: 모든 API 요청은 `/api/` 경로를 통해 백엔드에서 처리되므로 브라우저에 API 키가 노출되지 않아 안전합니다.
- **Firebase 연동**: 만약 Firebase 로그인을 추가하신다면, Firebase 콘솔의 **'Authorized Domains'** 목록에 배포된 도메인(예: `*.pages.dev`)을 반드시 추가해야 로그인이 정상 작동합니다.
