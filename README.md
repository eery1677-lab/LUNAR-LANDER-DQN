# 🚀 LunarLander-v3 DQN 간지나는 상륙 & 실시간 웹 관제 시스템

> **Gymnasium LunarLander-v3** 환경에서 완벽하고 안정적인 착륙(간지나는 상륙)을 자율 학습하는 **Dueling Double DQN** 강화학습 알고리즘과 60FPS 실시간 웹 관제 대시보드 프로젝트입니다.

---

## 🌟 핵심 특징

1. **🧠 Dueling Double DQN 강화학습 알고리즘 (`dqn_agent.py`)**
   - **Dueling Architecture**: 상태 가치 $V(s)$와 행동 어드밴티지 $A(s, a)$를 분리하여 자세 제어의 급격한 오차를 방지하고 착륙 정밀도 극대화
   - **Epsilon 감쇠 스케줄**: $1.0$ (100% 탐험)에서 시작하여 1,000 에피소드 동안 $0.05$ (5% 탐험)까지 점진적 감쇠 (Decay)
   - **Replay Buffer & Huber Loss**: 100,000 크기의 경험 재현 버퍼 + 안정적인 수렴을 위한 Smooth L1 (Huber) Loss 적용
   - **소프트 타깃 업데이트**: $\tau = 0.005$ 단위로 점진적 타깃 네트워크 갱신

2. **🛰️ 실시간 60FPS 사이버스페이스 웹 관제 대시보드 (`server.py`, `static/`)**
   - **60FPS 벡터 캔버스 뷰포트 (`renderer.js`)**:
     - 골드 티타늄 우주선 본체, 자세 기울기 렌더링, 유압 완충 다리 및 접촉 센서
     - 메인 로켓 플라즈마 파이어 입자, 지표면 먼지 폭풍(Dust kickup) 이펙트
     - 좌/우 RCS 엔진 가스 분사 파티클
     - 달 표면 지형, 펄스 착륙 유도 레이저 비콘, 깃발 및 안전 착륙 시 축하 폭죽 FX
   - **우주선 비행 HUD 계기판**: 실시간 고도, 수직 하강속도(위험 경고등), 수평속도, 피치 각도 자세계, 좌/우 다리 접지 센서
   - **AI 두뇌 의사결정 매트릭스**: 4개 행동(No-op, 좌측 RCS, 메인 분사, 우측 RCS)에 대한 실시간 Q-Value 바 차트
   - **학습 통계 실시간 분석 차트 (`charts.js`)**:
     - 에피소드별 보상(Reward) 및 100-Ep 이동평균선(목표 200점 돌파선)
     - Epsilon 감쇠 곡선 (100% $\rightarrow$ 5%) 및 Huber Loss 수렴 곡선
   - **인터랙티브 관제 및 조종**:
     - 1,000 에피소드 학습 시작 / 일시정지 / 배속 조절 (`1x`, `2x`, `5x`, `🚀 TURBO`)
     - **"간지나는 상륙 감상 (Test Pilot)"**: 탐험율 0%로 학습된 최고 신경망의 완벽한 상륙 시연 감상
     - **"내가 직접 착륙하기 (Human Mode)"**: 방향키(↑: 메인, ←/→: 좌우 RCS)로 직접 착륙을 시도하여 AI와 실력 비교
     - 모델 가중치 저장 및 불러오기 (`dqn_lunar_lander.pt`)

---

## 📁 프로젝트 구조

```
├── dqn_agent.py           # PyTorch Dueling Double DQN 에이전트 & Replay Buffer
├── lunar_engine.py        # Gymnasium 시뮬레이션 환경 관리 & 비동기 학습 스레드
├── server.py              # FastAPI 서버 + WebSocket 텔레메트리 스트리밍
├── main.py                # 웹 대시보드 자동 실행 스크립트
├── run_dashboard.bat      # Windows 원클릭 실행 배치 파일
├── requirements.txt       # 의존성 패키지 목록
├── static/
│   ├── index.html         # 메인 관제 센터 대시보드 HTML
│   ├── css/
│   │   └── style.css      # 사이버스페이스 다크모드, 글래스모피즘, HUD 네온 스타일
│   └── js/
│       ├── app.js         # WebSocket 통신, 컨트롤러, 키보드 비행 조종, Web Audio FX
│       ├── renderer.js    # HTML5 Canvas 60FPS 우주선/화염/파티클/달지형 렌더러
│       └── charts.js      # Chart.js 실시간 보상/입실론/Loss/Q값 차트
└── 나만의피지컬ai두뇌소유하기1편.py  # 콘솔/시연/웹 통합 실행 스크립트
```

---

## ⚡ 빠른 시작 (Quick Start)

### 1. 패키지 설치
```bash
pip install -r requirements.txt
```

### 2. 웹 관제 대시보드 실행
```bash
# 원클릭 실행 (Windows)
run_dashboard.bat

# 또는 파이썬 명령어로 실행
python main.py
```
브라우저에서 **`http://127.0.0.1:8000`** 에 접속합니다.

---

## 🎮 실행 모드 옵션

```bash
# 1. 실시간 웹 대시보드 실행 (기본값)
python 나만의피지컬ai두뇌소유하기1편.py --mode web

# 2. 콘솔 모드로 1000 에피소드 학습만 실행
python 나만의피지컬ai두뇌소유하기1편.py --mode train --episodes 1000

# 3. 학습된 최적 모델로 시연
python 나만의피지컬ai두뇌소유하기1편.py --mode test
```

---

## 📜 라이선스
MIT License
