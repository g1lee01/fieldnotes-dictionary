# Fieldnotes — Smart Jargon Dictionary

해외영업 업무 상황과 질문에서 관련 실무 용어를 찾아 설명하는 독립형 웹 MVP입니다.

## 실행

일반 사전은 `index.html`을 열어 사용할 수 있습니다. 로그인 기능은 Supabase 설정과 HTTP(S) 주소가 필요합니다. 로컬에서 로그인까지 시험하려면 프로젝트 폴더에서 `python3 -m http.server 8000`을 실행한 뒤 `http://localhost:8000`으로 접속하세요.

## 현재 동작

- 한국어·영어 질문을 받는 로컬 검색형 업무 지식 Assistant
- 키워드, 별칭, 질문 의도에 기반한 용어 검색과 이전 질문 후속 맥락 처리
- 상단 메인 바에서 한국어 또는 English를 선택해 답변 전체의 표시 언어를 한 번에 전환
- 답변 언어 설정은 용어 설명, 비교표, 참고자료 및 약어 풀이에 적용되고 브라우저에 저장
- 정의에 포함된 핵심 용어와 대표 약어를 굵게 강조
- Incoterms®, 운송서류, 결제조건, 농약 제형·안전기간처럼 시각화가 유용한 답변에 자체 제작 개념도 표시
- Incoterms® 2020, 해상 운송서류, 무역 결제조건, 농약 제형처럼 비교·탐색에 특히 유용한 주제만 왼쪽 **주제별 모음** 메뉴와 첫 화면에 표시
- 그 외 용어는 업무 분야별 탐색에서 모두 찾을 수 있으며, 각 용어는 무역·물류, 재무, 공급망, 농약, 규제, 비즈니스 중 해당 분야에 분류
- 주제를 고르면 해당 주제에 포함된 용어를 바로 비교할 수 있고, 업무 분야별 탐색은 왼쪽 사전 메뉴에서 이용
- 약 150개 이상의 무역·물류, 재무, 영업, 공급망, 작물보호·비료, 규제 용어를 제공합니다. 농약 제형 모음은 EC·SC·WP·WG·SL·GR·CS·OD·DP 9종을 다루며, glyphosate·glufosinate·pendimethalin·S-metolachlor, methomyl·imidacloprid·chlorantraniliprole, azoxystrobin·tebuconazole·mancozeb 등 제초제·살충제·살균제 유효성분과 대표 상표 예시를 Agrochemicals 분야에서 개별적으로 찾을 수 있습니다. 수도작 용어도 `Irrigation`, `Water Management`, `Seeding`, `Transplanting` 등 짧은 항목으로 분야별 탐색에 포함되며, 별도 수도작 주제 모음은 두지 않습니다. 상표와 등록·사용 범위는 국가·제품마다 다르므로 실제 확인에는 해당 국가의 최신 제품 라벨과 SDS를 사용해야 합니다.
- 초록색 기반의 원래 UI 컬러 팔레트 유지
- 왼쪽 위 Fieldnotes 로고를 누르면 검색창과 주제 카드가 있는 첫 화면으로 이동
- 사이드바 탐색, 용어 카드 제목 및 정의 본문 글씨 크기를 높여 가독성을 개선
- Beginner 모드에서는 쉬운 설명과 핵심 주의사항을 먼저, Expert 모드에서는 정의·업무 절차·출처를 자세히 표시
- 답변에 나온 대표 무역·규제 약어에 짧은 영문·한국어 풀이 표시
- 질문창 근처에 상황별 예시 질문과 편안한 안내 문구 제공
- 정의, 쉬운 설명, 업무 사례, 확인 순서, 주의사항, 관련 용어와 출처 표시
- 비교 질문의 표 형식 답변, Beginner / Expert 모드
- 업무 카테고리별 탐색과 검색, 답변 저장·복사, 지식 데이터 수정·추가
- 샘플 용어 추가·수정·삭제, Excel에서 열 수 있는 CSV 템플릿 및 가져오기·내보내기
- Supabase 이메일 가입·로그인, 이메일 인증, 비밀번호 재설정 및 로그아웃
- 공용 기본 용어와 계정 전용 개인 용어·저장 답변 분리

## AI 및 데이터 범위

현재 MVP에는 생성형 AI나 외부 모델 API가 연결되어 있지 않습니다. `knowledge.js`의 샘플 지식을 기반으로 브라우저 안에서 검색·매칭해 답변을 구성합니다. 관련 자료를 찾지 못하면 추측으로 사내 절차를 만들지 않고, 자료가 없음을 표시합니다. 화면에서 사용자의 질문이나 사내 자료를 외부 AI 서비스로 보내지 않습니다.

로그인하지 않은 경우 개인 편집·저장 답변은 기존처럼 해당 브라우저의 `localStorage`에만 저장됩니다. 로그인하면 공용 기본 사전은 읽기 전용으로 제공되고, 직접 추가한 용어와 저장 답변은 Supabase에 계정별로 저장되어 같은 계정으로 로그인한 기기에서 동기화됩니다. Supabase Row Level Security 정책은 각 사용자가 자기 행만 조회·추가·수정·삭제하도록 제한합니다. 로그인 전 브라우저에 저장된 개인 편집은 자동 업로드되지 않습니다.

## 로그인 설정 (Supabase)

1. Supabase 프로젝트를 만들고 **Authentication → Providers → Email**에서 이메일 인증을 설정합니다.
2. **Project Settings → API**에서 Project URL과 `anon`/publishable public key를 [supabase-config.js](./supabase-config.js)에 입력합니다. 이 공개 키는 브라우저에 노출되므로 `service_role`/secret key를 절대 넣지 마세요.
3. Supabase SQL Editor에서 [supabase-schema.sql](./supabase-schema.sql)의 전체 내용을 실행해 개인 용어·저장 답변 테이블과 사용자별 RLS 정책을 생성합니다.
4. **Authentication → URL Configuration**의 Site URL과 Redirect URLs에 실제 앱 주소를 추가합니다. 로컬 테스트는 `http://localhost:8000/**`, 배포는 HTTPS 주소를 등록하세요. `file://`로 열면 이메일 인증·비밀번호 재설정 링크가 정상 작동하지 않습니다.
5. 앱을 새로고침한 뒤 로그인/가입을 사용합니다. 이메일 확인을 켠 경우 가입 메일의 인증 링크를 눌러야 로그인할 수 있습니다.

인증 설정과 데이터베이스가 준비되기 전에는 로그인 버튼이 설정 안내를 표시합니다. 공개 기본 사전은 정적 데이터로 배포되므로 그 내용을 전 사용자에게 변경 배포하려면 앱의 지식 데이터를 업데이트해야 합니다. 사용자가 관리 화면에서 기본 사전을 수정하는 기능은 제공하지 않습니다.

## 샘플 데이터 관리

답변 위의 **수정·추가** 또는 화면 왼쪽의 **지식 데이터 관리**에서 용어를 추가·수정·삭제할 수 있습니다. Excel에서 템플릿 CSV를 열어 편집한 뒤 CSV UTF-8 형식으로 저장하고 가져오세요. 주요 열은 `id`, `category`, `term`, `english`, `aliases`, `definition`, `definition_en`, `simple`, `simple_en`, `scenario`, `scenario_en`, `steps`, `steps_en`, `cautions`, `cautions_en`, `related`, `sources`, `sources_en`, `keywords`입니다. 여러 항목은 `|` 문자로 구분합니다. 사용 가능한 분야 ID는 `trade`, `finance`, `supply`, `agro`, `regulatory`, `business`입니다.

현재 자료는 업무 이해를 돕는 예시이며 회사 규정이나 법률·통관·규제 자문이 아닙니다. 실제 거래, 제품 등록, 결제 및 선적은 최신 원문과 해당 업무 담당자 또는 공식 기관에 확인하세요.

## 향후 확장

공유형 사내 지식베이스와 실제 Excel 파일 저장, 문서·FAQ 연동, 인증 및 권한 관리를 추가하고 생성형 AI를 연결할 때는 승인된 사내 백엔드와 검색 증강 생성(RAG)을 통해 출처를 제한하고, 민감한 질문·문서 처리 정책을 별도로 마련해야 합니다.
