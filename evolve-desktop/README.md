# Evolve Industry Desktop r2

공식 Evolve Idle 1.4.10에 **우주 자동화·생산 승수·지역/태양계/성간 산업망·문명 계승**을 추가한 개인용 Windows 수정판입니다. 초기 진화와 문명 발전은 원본 구조를 유지합니다. 이전 저장 안정화 r1도 포함합니다.

## 다운로드

[Windows 빌드 페이지](https://github.com/kingjow363-stack/game/actions/workflows/evolve-original-windows.yml)에서 초록색 체크가 있는 최신 실행을 선택하세요. GitHub 로그인 후 **Artifacts → Evolve-Industry-Windows**를 다운로드하고, ZIP을 풀어 **Evolve-1.4.10-Industry-r2-Windows.exe**를 실행합니다.

이전 EXE를 먼저 종료하세요. 기존 `evolve-original-desktop` 저장 폴더를 그대로 사용합니다. `EXO-Industries`는 과거의 별도 게임이며 저장이 호환되지 않습니다.

영어로 시작하면 원본 **Settings → Locale → 한국어**를 선택하세요. 화면 오른쪽 아래 **우주 산업** 버튼에서 새 기능을 확인할 수 있습니다. 우주 진입 전에는 해금 안내가 표시됩니다.

- [새 기능 사용법·목표·승수·환생 보상](INDUSTRY.md)
- [실제 수정 파일과 구현 구조](ROADMAP.md)

## 기존 웹 저장 가져오기

웹 Evolve에서 **Export Game**으로 저장 문자열을 복사한 뒤, 앱의 Settings → Import/Export Save에 붙여넣고 **Import Game**을 누르세요. 원본 저장 형식을 사용하며 확장 상태만 별도 이름 공간에 추가합니다. 기준 버전은 고정된 1.4.10이며, 그 이후 웹 버전의 모든 저장 구조를 보증하지는 않습니다.

## 저장·백업

저장 위치: `%APPDATA%/evolve-original-desktop`. **게임 → 저장 폴더 열기**로 이동할 수 있습니다.

원본 자동저장 외에 30초마다 `last-save.txt`와 `backups/`에 최근 10개의 파일 백업을 보관합니다. 정상 종료 시에도 저장합니다. 원본이 저장을 제한하는 구간에서는 마지막 안전한 저장을 유지합니다.

**게임 → 지금 파일 백업 / 저장 상태 확인 / 백업 파일 복구**를 사용할 수 있습니다. 시작할 때 저장이 손상되거나 누락되면 복구를 안내합니다. 복구 전 데이터는 `before-recovery-*.json`에 별도로 보관하며 자동 삭제하지 않습니다. 백업 TXT는 원본 가져오기 형식입니다. 강제 종료 시 마지막 저장 이후 진행은 잃을 수 있으며, 같은 디스크의 백업이므로 기기 전체 고장까지 보호하지는 않습니다.

## 원본 보존과 수정 빌드

- 원본 기준 커밋: `3436358dcd03d9f9e071d51ea071e0a78c0322e4`, 버전 1.4.10.
- `upstream/`의 원본 113개와 `upstream-manifest.json` 해시는 보존합니다.
- `mods/`에 산업 모듈/UI를 두고, `scripts/build-evolve-mod.cjs`가 복사본에 검증된 패치를 적용합니다. `build-source/`는 실제 수정 소스와 `PATCHES.json`을 포함하는 생성물입니다.
- 수정 게임 번들은 원본과 같은 esbuild 0.25.0으로 빌드합니다. 원본 위키·번역·Web Worker·기존 CSS는 그대로이고 산업 패널 CSS를 추가합니다.
- 오프라인 라이브러리 6개는 원본과 같은 버전/SRI로 검증합니다. 인터넷 연결 없이 게임과 원본 위키를 사용할 수 있습니다. 위키는 원본 기준이므로 추가 시스템 설명은 산업 패널과 `INDUSTRY.md`에 있습니다.
- 원본 제작자: Peter Motschmann 및 기여자. [수정 고지](UPSTREAM-NOTICE.md), [MPL-2.0](upstream/LICENSE). Windows 빌드에 원본 소스와 수정 소스 다운로드를 각각 제공합니다.

## 개발·검증

저장소 루트에서:

```sh
npm ci
npm run prepare:evolve
npm run test:evolve
npm run start:evolve
npm run smoke:evolve
npm run smoke:industry
npm run dist:evolve:win
```

Linux 기능 검사는 가상 화면이 필요합니다. Windows CI는 패키징된 앱으로 저장/복구 검사를 수행하고, 같은 수정 소스의 실제 원본 함수 및 산업 UI를 별도 테스트 하네스로 검증합니다. 하네스는 테스트 때만 주입하며 EXE에는 포함하지 않습니다. 모든 종족·후반 루트를 장시간 플레이한 검증과는 구분합니다.
