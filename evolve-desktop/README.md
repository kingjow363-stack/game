# Evolve Original Desktop

공식 Evolve Idle 1.4.10을 그대로 실행하는 개인용 Windows 데스크톱 패키지입니다. EXO Industries와는 별개이며, 첫 화면에는 원본대로 **Prehistoric / Protoplasm / RNA**가 표시됩니다.

## 다운로드와 시작

[전용 Windows 빌드 페이지](https://github.com/kingjow363-stack/game/actions/workflows/evolve-original-windows.yml)에서 초록색 체크가 있는 실행을 선택하고, **Artifacts → Evolve-Original-Windows**를 다운로드하세요. ZIP을 풀어 **Evolve-Original-1.4.10-Windows.exe**를 실행합니다. EXO-Industries 파일은 이전에 만들었던 별도 게임입니다.

처음 실행할 때 영어로 보이면 게임의 **Settings → Locale → 한국어**를 선택하세요. 원본의 첫 시작 설정을 임의로 바꾸지 않았습니다.

## 웹게임의 기존 저장 가져오기

1. 웹 Evolve의 Settings에서 **Export Game**을 눌러 저장 문자열을 복사합니다.
2. 데스크톱 Evolve의 Settings에 있는 **Import/Export Save** 입력란에 붙여넣습니다.
3. **Import Game**을 누르면 원본 가져오기 기능이 그대로 실행됩니다.

EXO 저장 JSON은 Evolve 저장과 구조가 달라 가져올 수 없습니다. 새 브라우저/앱은 별도 저장이므로 웹게임 저장을 자동으로 읽지는 않습니다.

저장 위치는 `%APPDATA%/evolve-original-desktop`입니다. 종료할 때 현재 원본 저장을 반영하고 `last-save.txt`도 보관합니다. 상단 메뉴 **게임 → 저장 폴더 열기**에서 찾을 수 있습니다. 여러 창에서 저장을 덮어쓰지 않도록 게임 앱은 하나만 실행됩니다.

## 원본과의 관계

- 기준 원본 커밋: `3436358dcd03d9f9e071d51ea071e0a78c0322e4` (공식 저장소 master, package version 1.4.10).
- `upstream/`에는 해당 커밋의 소스 113개를 그대로 보관합니다. 소스뿐 아니라 원본의 빌드된 게임 코드, 위키, CSS, Web Worker, 번역을 사용합니다.
- `upstream-manifest.json`은 모든 원본 파일의 SHA-256을 기록합니다. 패키징 전에 원본이 임의로 바뀌지 않았는지 검사합니다.
- 원본 HTML의 CDN 라이브러리 6개는 정확히 같은 버전을 로컬 파일로 교체하고, 원본 HTML의 SHA-384 무결성 값으로 검증합니다. 검증을 끄지 않습니다.
- Lato 글꼴과 라이브러리는 앱에 포함됩니다. 게임 동작에는 인터넷 연결이 필요 없습니다. 원본 위키도 별도 창으로 열립니다.
- 게임 로직·밸런스·종족·연구·우주·환생은 원본 파일 그대로입니다. 데스크톱 창, 종료 시 저장 보조, 오프라인 파일 경로만 추가했습니다.
- 외부 분석 스크립트와 온라인 버전 확인은 동작하지 않습니다. 커뮤니티/후원 링크를 직접 누르면 기본 브라우저로 열립니다.
- 웹사이트가 나중에 바뀌어도 이 EXE는 고정된 1.4.10을 유지합니다. 모든 장기 플레이 경로를 끝까지 검증했다는 뜻은 아닙니다.

원본 제작자와 라이선스: [UPSTREAM-NOTICE.md](UPSTREAM-NOTICE.md), [Mozilla Public License 2.0](upstream/LICENSE). Windows 빌드에는 원본 소스 다운로드도 함께 제공합니다.

## 개발과 향후 수정

저장소 루트에서:

```sh
npm ci
npm run prepare:evolve
npm run test:evolve
npm run start:evolve
npm run dist:evolve:win
```

원본 보존 폴더 `upstream/`와 데스크톱 연결부 `main.cjs`를 구분했습니다. 향후 게임 규칙을 바꿀 때는 원본 기준 커밋과 차이를 기록하고, 수정한 소스를 빌드한 다음 명시적으로 해당 검증 기준을 갱신해야 합니다. 생성물인 `web/`만 수정하면 다음 준비 작업에서 덮어써집니다.

검증 명령 `npm run smoke:evolve`는 테스트 전용 저장 폴더를 사용하며 RNA/DNA 생산, 원형질 진화 구매, 자동 생산, 한국어, 원본 저장 가져오기/내보내기, 위키, 앱 재시작을 확인합니다. Linux에서는 가상 화면 등이 필요합니다. Windows CI는 패키징된 Windows 앱으로 같은 테스트를 실행합니다.
