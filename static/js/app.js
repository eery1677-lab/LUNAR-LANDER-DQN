/**
 * LUNAR LANDER DQN MAIN APPLICATION CONTROLLER & WEBSOCKET CLIENT
 */

class MissionControlApp {
    constructor() {
        this.renderer = new LunarRenderer('sim-canvas');
        this.charts = new DashboardCharts();
        
        this.socket = null;
        this.isConnected = false;
        this.isAudioEnabled = true;
        this.audioCtx = null;

        this.humanMode = false;
        this.currentAction = 0;
        this.maxEpisodes = 1000;

        this.initDOMElements();
        this.initEventListeners();
        this.initWebSocket();
        this.initAudio();
    }

    initDOMElements() {
        // KPI elements
        this.kpiEp = document.getElementById('kpi-ep');
        this.kpiEpMax = document.getElementById('kpi-ep-max');
        this.epProgressBar = document.getElementById('ep-progress-bar');
        this.kpiEps = document.getElementById('kpi-eps');
        this.epsProgressBar = document.getElementById('eps-progress-bar');
        this.kpiLastReward = document.getElementById('kpi-last-reward');
        this.kpiBestReward = document.getElementById('kpi-best-reward');
        this.landingStatusBadge = document.getElementById('landing-status-badge');
        this.kpiSuccessRate = document.getElementById('kpi-success-rate');
        this.kpiTotalSteps = document.getElementById('kpi-total-steps');
        this.systemStatusText = document.getElementById('system-status-text');

        // Flight HUD elements
        this.badgeMode = document.getElementById('badge-mode');
        this.badgeSpeed = document.getElementById('badge-speed');
        this.hudAlt = document.getElementById('hud-alt');
        this.hudVy = document.getElementById('hud-vy');
        this.hudVx = document.getElementById('hud-vx');
        this.hudAngle = document.getElementById('hud-angle');
        this.hudThrustMain = document.getElementById('hud-thrust-main');
        this.hudThrustRcs = document.getElementById('hud-thrust-rcs');
        this.legLeft = document.getElementById('leg-left');
        this.legRight = document.getElementById('leg-right');
        this.hudBanner = document.getElementById('hud-banner');
        this.bannerTitle = document.getElementById('banner-title');
        this.bannerDesc = document.getElementById('banner-desc');

        // Custom Episode Input & Preset Pills
        this.inputMaxEpisodes = document.getElementById('input-max-episodes');
        this.presetPills = document.querySelectorAll('.btn-pill');
        this.btnStartLabel = document.getElementById('btn-start-label');

        // Bottom Telemetry Pills
        this.pillPos = document.getElementById('pill-pos');
        this.pillAction = document.getElementById('pill-action');
        this.pillReward = document.getElementById('pill-reward');
        this.pillLoss = document.getElementById('pill-loss');

        // Control Buttons
        this.btnStartTrain = document.getElementById('btn-start-train');
        this.btnPauseTrain = document.getElementById('btn-pause-train');
        this.btnStopTrain = document.getElementById('btn-stop-train');
        this.btnEvalPilot = document.getElementById('btn-eval-pilot');
        this.btnHumanMode = document.getElementById('btn-human-mode');
        this.btnSaveModel = document.getElementById('btn-save-model');
        this.btnLoadModel = document.getElementById('btn-load-model');
        this.btnResetModel = document.getElementById('btn-reset-model');
        this.btnAudioToggle = document.getElementById('btn-audio-toggle');

        // Speed buttons
        this.speedButtons = document.querySelectorAll('.btn-speed');

        // Footer Connection
        this.wsConnectionStatus = document.getElementById('ws-connection-status');
    }

    initEventListeners() {
        // Episode Input & Preset Pills
        if (this.inputMaxEpisodes) {
            this.inputMaxEpisodes.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                    this.maxEpisodes = val;
                    this.updateMaxEpisodesUI(val);
                }
            });
        }

        this.presetPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                const epVal = parseInt(e.currentTarget.getAttribute('data-ep'), 10);
                if (!isNaN(epVal)) {
                    this.maxEpisodes = epVal;
                    if (this.inputMaxEpisodes) this.inputMaxEpisodes.value = epVal;
                    this.presetPills.forEach(p => p.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.updateMaxEpisodesUI(epVal);
                    this.playBeep(750, 0.04);
                }
            });
        });

        // Training Controls
        this.btnStartTrain.addEventListener('click', () => this.startTraining());
        this.btnPauseTrain.addEventListener('click', () => this.togglePause());
        this.btnStopTrain.addEventListener('click', () => this.stopTraining());

        // Special Modes
        this.btnEvalPilot.addEventListener('click', () => this.startEvaluation());
        this.btnHumanMode.addEventListener('click', () => this.startHumanMode());

        // Model Management
        this.btnSaveModel.addEventListener('click', () => this.saveModel());
        this.btnLoadModel.addEventListener('click', () => this.loadModel());
        this.btnResetModel.addEventListener('click', () => this.resetModel());

        // Speed Selection
        this.speedButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = e.currentTarget.getAttribute('data-speed');
                this.setSpeed(speed);
            });
        });

        // Audio Toggle
        this.btnAudioToggle.addEventListener('click', () => {
            this.isAudioEnabled = !this.isAudioEnabled;
            this.btnAudioToggle.textContent = this.isAudioEnabled ? '🔊' : '🔇';
            if (this.isAudioEnabled) this.playBeep(800, 0.05);
        });

        // Keyboard Controls for Human Mode
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    updateMaxEpisodesUI(epVal) {
        if (this.kpiEpMax) this.kpiEpMax.textContent = epVal.toLocaleString();
        if (this.btnStartLabel) this.btnStartLabel.textContent = `${epVal.toLocaleString()} 에피소드 학습 시작`;
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            this.isConnected = true;
            this.wsConnectionStatus.innerHTML = '<span class="status-dot"></span> WebSocket Connected';
            this.wsConnectionStatus.style.color = '#00ff88';
            this.systemStatusText.textContent = 'ONLINE';
        };

        this.socket.onclose = () => {
            this.isConnected = false;
            this.wsConnectionStatus.innerHTML = '<span class="status-dot" style="background:#ff0055"></span> Reconnecting...';
            this.wsConnectionStatus.style.color = '#ff0055';
            this.systemStatusText.textContent = 'DISCONNECTED';
            setTimeout(() => this.initWebSocket(), 2000);
        };

        this.socket.onerror = (err) => {
            console.error('WebSocket error:', err);
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
    }

    handleMessage(msg) {
        if (msg.type === 'telemetry') {
            this.handleTelemetry(msg);
        } else if (msg.type === 'episode_summary') {
            this.handleEpisodeSummary(msg);
        } else if (msg.type === 'init') {
            this.handleInit(msg.status);
        } else if (msg.type === 'training_finished') {
            this.showBanner('TRAINING COMPLETE!', `${msg.total_episodes} 에피소드 학습 완료`, false);
            this.btnStartTrain.disabled = false;
            this.btnPauseTrain.disabled = true;
            this.btnStopTrain.disabled = true;
            this.badgeMode.textContent = 'MODE: COMPLETED';
        } else if (msg.type === 'evaluation_finished') {
            if (msg.status === 'landed_safely' || msg.reward >= 200) {
                this.showBanner('PERFECT TOUCHDOWN! 🌟', `보상: +${msg.reward.toFixed(1)} PTS • 간지나는 완벽 착륙!`, false);
                this.playFanfare();
            } else if (msg.status === 'crashed') {
                this.showBanner('CRASHED! 💥', `보상: ${msg.reward.toFixed(1)} PTS • 충돌 발생`, true);
                this.playCrashSound();
            }
        } else if (msg.type === 'human_finished') {
            if (msg.status === 'landed_safely' || msg.reward >= 200) {
                this.showBanner('PILOT TOUCHDOWN! 👨‍🚀', `인간 파일럿 착륙 성공! +${msg.reward.toFixed(1)} PTS`, false);
                this.playFanfare();
            } else {
                this.showBanner('CRASH LANDING! 💥', `착륙 실패: ${msg.reward.toFixed(1)} PTS`, true);
                this.playCrashSound();
            }
        }
    }

    handleInit(status) {
        if (!status) return;
        if (status.max_episodes) {
            this.maxEpisodes = status.max_episodes;
            this.updateMaxEpisodesUI(status.max_episodes);
            if (this.inputMaxEpisodes) this.inputMaxEpisodes.value = status.max_episodes;
        }

        this.kpiEp.textContent = status.current_episode;
        this.epProgressBar.style.width = `${(status.current_episode / this.maxEpisodes) * 100}%`;
        this.kpiEps.textContent = `${(status.epsilon * 100).toFixed(1)}%`;
        this.epsProgressBar.style.width = `${status.epsilon * 100}%`;
        this.kpiBestReward.textContent = `Best: ${status.best_reward.toFixed(1)}`;
        this.kpiSuccessRate.textContent = `${status.success_rate.toFixed(1)}%`;
        this.kpiTotalSteps.textContent = `${status.total_steps.toLocaleString()} Steps`;

        if (status.is_running) {
            this.btnStartTrain.disabled = true;
            this.btnPauseTrain.disabled = false;
            this.btnStopTrain.disabled = false;
            this.badgeMode.textContent = `MODE: ${status.mode.toUpperCase()}`;
        }
    }

    handleTelemetry(data) {
        // 1. Update Canvas Renderer (including procedural dynamic terrain)
        this.renderer.updateState(data);

        // 2. Update Flight HUD
        const st = data.state;
        const altM = Math.max(0, st.y * 100).toFixed(1);
        const vyM = (st.vy * 10).toFixed(2);
        const vxM = (st.vx * 10).toFixed(2);
        const angleDeg = (-st.angle * (180 / Math.PI)).toFixed(1);

        this.hudAlt.textContent = `${altM} m`;
        this.hudVy.textContent = `${vyM} m/s`;
        this.hudVx.textContent = `${vxM} m/s`;
        this.hudAngle.textContent = `${angleDeg}°`;

        if (st.vy < -0.3) {
            this.hudVy.style.color = '#ff0055';
        } else if (st.vy < -0.15) {
            this.hudVy.style.color = '#ffaa00';
        } else {
            this.hudVy.style.color = '#00ff88';
        }

        // Engine Status Badges
        const actionNames = ['0: NO-OP', '1: LEFT RCS', '2: MAIN FIRE', '3: RIGHT RCS'];
        this.pillAction.textContent = actionNames[data.action] || '0: NO-OP';

        if (data.action === 2) {
            this.hudThrustMain.textContent = 'FIRING';
            this.hudThrustMain.className = 'hud-val hud-badge active-main';
            this.hudThrustRcs.textContent = 'OFF';
            this.hudThrustRcs.className = 'hud-val hud-badge';
            this.playThrusterSound();
        } else if (data.action === 1) {
            this.hudThrustMain.textContent = 'OFF';
            this.hudThrustMain.className = 'hud-val hud-badge';
            this.hudThrustRcs.textContent = 'LEFT';
            this.hudThrustRcs.className = 'hud-val hud-badge active-rcs';
            this.playRcsSound();
        } else if (data.action === 3) {
            this.hudThrustMain.textContent = 'OFF';
            this.hudThrustMain.className = 'hud-val hud-badge';
            this.hudThrustRcs.textContent = 'RIGHT';
            this.hudThrustRcs.className = 'hud-val hud-badge active-rcs';
            this.playRcsSound();
        } else {
            this.hudThrustMain.textContent = 'OFF';
            this.hudThrustMain.className = 'hud-val hud-badge';
            this.hudThrustRcs.textContent = 'OFF';
            this.hudThrustRcs.className = 'hud-val hud-badge';
        }

        // Legs Contact
        if (st.left_leg === 1) {
            this.legLeft.classList.add('contact');
        } else {
            this.legLeft.classList.remove('contact');
        }

        if (st.right_leg === 1) {
            this.legRight.classList.add('contact');
        } else {
            this.legRight.classList.remove('contact');
        }

        // Bottom Pills
        this.pillPos.textContent = `X: ${st.x.toFixed(2)} | Y: ${st.y.toFixed(2)}`;
        this.pillReward.textContent = `${data.episode_reward >= 0 ? '+' : ''}${data.episode_reward.toFixed(1)}`;
        this.pillReward.style.color = data.episode_reward >= 0 ? '#00ff88' : '#ff0055';
        this.pillLoss.textContent = data.loss ? data.loss.toFixed(4) : '0.0000';

        // 3. Update Q-Values Bar Chart
        if (data.q_values) {
            this.charts.updateQValues(data.q_values, data.action);
        }

        for (let i = 0; i < 4; i++) {
            const legItem = document.getElementById(`legend-${i}`);
            if (legItem) {
                if (i === data.action) {
                    legItem.classList.add('highlight');
                } else {
                    legItem.classList.remove('highlight');
                }
            }
        }
    }

    handleEpisodeSummary(summary) {
        const maxEp = summary.max_episodes || this.maxEpisodes;
        this.maxEpisodes = maxEp;
        this.updateMaxEpisodesUI(maxEp);

        this.kpiEp.textContent = summary.episode;
        this.epProgressBar.style.width = `${(summary.episode / maxEp) * 100}%`;
        this.kpiEps.textContent = `${(summary.epsilon * 100).toFixed(1)}%`;
        this.epsProgressBar.style.width = `${summary.epsilon * 100}%`;
        this.kpiLastReward.textContent = `${summary.reward >= 0 ? '+' : ''}${summary.reward.toFixed(1)}`;
        this.kpiLastReward.style.color = summary.reward >= 200 ? '#00ff88' : (summary.reward >= 0 ? '#ffd700' : '#ff0055');
        this.kpiBestReward.textContent = `Best: ${summary.best_reward.toFixed(1)}`;
        this.kpiSuccessRate.textContent = `${summary.success_rate.toFixed(1)}%`;

        if (summary.status === 'landed_safely' || summary.reward >= 200) {
            this.landingStatusBadge.textContent = 'PERFECT LANDING';
            this.landingStatusBadge.style.color = '#00ff88';
            this.landingStatusBadge.style.borderColor = '#00ff88';
            this.landingStatusBadge.style.background = 'rgba(0, 255, 136, 0.2)';
            this.showBanner('PERFECT TOUCHDOWN! 🌟', `에피소드 ${summary.episode} • 보상: +${summary.reward.toFixed(1)} PTS`, false);
            this.playFanfare();
        } else if (summary.status === 'crashed') {
            this.landingStatusBadge.textContent = 'CRASHED';
            this.landingStatusBadge.style.color = '#ff0055';
            this.landingStatusBadge.style.borderColor = '#ff0055';
            this.landingStatusBadge.style.background = 'rgba(255, 0, 85, 0.15)';
        } else {
            this.landingStatusBadge.textContent = 'TIMEOUT';
            this.landingStatusBadge.style.color = '#ffaa00';
            this.landingStatusBadge.style.borderColor = '#ffaa00';
            this.landingStatusBadge.style.background = 'rgba(255, 170, 0, 0.15)';
        }

        // Add to Charts
        this.charts.addEpisodeSummary(summary);
    }

    showBanner(title, desc, isCrash = false) {
        this.bannerTitle.textContent = title;
        this.bannerDesc.textContent = desc;
        if (isCrash) {
            this.hudBanner.classList.add('crash');
        } else {
            this.hudBanner.classList.remove('crash');
        }
        this.hudBanner.classList.add('show');
        setTimeout(() => {
            this.hudBanner.classList.remove('show');
        }, 2200);
    }

    // REST API Actions
    async startTraining() {
        this.playBeep(900, 0.08);
        const epInput = parseInt(this.inputMaxEpisodes ? this.inputMaxEpisodes.value : '1000', 10);
        const maxEp = (!isNaN(epInput) && epInput > 0) ? epInput : 1000;
        this.maxEpisodes = maxEp;

        const res = await fetch('/api/train/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_episodes: maxEp })
        });
        const data = await res.json();
        if (data.status === 'training_started') {
            this.btnStartTrain.disabled = true;
            this.btnPauseTrain.disabled = false;
            this.btnStopTrain.disabled = false;
            this.badgeMode.textContent = 'MODE: TRAINING';
            this.systemStatusText.textContent = 'TRAINING';
        }
    }

    async togglePause() {
        const isPaused = this.btnPauseTrain.classList.contains('active-pause');
        if (!isPaused) {
            await fetch('/api/train/pause', { method: 'POST' });
            this.btnPauseTrain.classList.add('active-pause');
            this.btnPauseTrain.innerHTML = '<span class="btn-icon">▶️</span><span>재개</span>';
            this.badgeMode.textContent = 'MODE: PAUSED';
            this.systemStatusText.textContent = 'PAUSED';
        } else {
            await fetch('/api/train/resume', { method: 'POST' });
            this.btnPauseTrain.classList.remove('active-pause');
            this.btnPauseTrain.innerHTML = '<span class="btn-icon">⏸️</span><span>일시정지</span>';
            this.badgeMode.textContent = 'MODE: TRAINING';
            this.systemStatusText.textContent = 'TRAINING';
        }
    }

    async stopTraining() {
        this.playBeep(400, 0.1);
        await fetch('/api/train/stop', { method: 'POST' });
        this.btnStartTrain.disabled = false;
        this.btnPauseTrain.disabled = true;
        this.btnStopTrain.disabled = true;
        this.btnPauseTrain.classList.remove('active-pause');
        this.btnPauseTrain.innerHTML = '<span class="btn-icon">⏸️</span><span>일시정지</span>';
        this.badgeMode.textContent = 'MODE: IDLE';
        this.systemStatusText.textContent = 'READY';
    }

    async setSpeed(speed) {
        this.playBeep(700, 0.04);
        this.speedButtons.forEach(btn => {
            if (btn.getAttribute('data-speed') === speed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        this.badgeSpeed.textContent = `SPEED: ${speed.toUpperCase()}`;
        await fetch('/api/train/speed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed })
        });
    }

    async startEvaluation() {
        this.playBeep(1100, 0.1);
        this.showBanner('TEST PILOT ENGAGED', 'Epsilon=0% 최적 두뇌로 간지나는 상륙을 시도합니다!', false);
        this.badgeMode.textContent = 'MODE: EVALUATION';
        this.systemStatusText.textContent = 'TEST PILOT';
        await fetch('/api/pilot/test', { method: 'POST' });
    }

    async startHumanMode() {
        this.playBeep(600, 0.1);
        this.humanMode = true;
        this.showBanner('MANUAL CONTROL ACTIVE 👨‍🚀', '방향키로 직접 착륙을 시도하세요!', false);
        this.badgeMode.textContent = 'MODE: HUMAN PILOT';
        this.systemStatusText.textContent = 'HUMAN FLIGHT';
        await fetch('/api/human/start', { method: 'POST' });
    }

    async saveModel() {
        this.playBeep(1000, 0.08);
        const res = await fetch('/api/model/save', { method: 'POST' });
        const data = await res.json();
        alert('✅ 모델 가중치가 dqn_lunar_lander.pt 에 성공적으로 저장되었습니다!');
    }

    async loadModel() {
        this.playBeep(1000, 0.08);
        const res = await fetch('/api/model/load', { method: 'POST' });
        const data = await res.json();
        alert('📂 저장된 최고 모델 가중치를 성공적으로 불러왔습니다!');
    }

    async resetModel() {
        if (confirm('모든 학습 기록과 신경망 가중치를 초기화하시겠습니까?')) {
            await fetch('/api/model/reset', { method: 'POST' });
            this.charts.reset();
            this.kpiEp.textContent = '0';
            this.epProgressBar.style.width = '0%';
            this.kpiEps.textContent = '100.0%';
            this.epsProgressBar.style.width = '100%';
            this.kpiLastReward.textContent = '0.0';
            this.kpiBestReward.textContent = 'Best: 0.0';
            this.kpiSuccessRate.textContent = '0.0%';
            this.kpiTotalSteps.textContent = '0 Steps';
            this.btnStartTrain.disabled = false;
            this.btnPauseTrain.disabled = true;
            this.btnStopTrain.disabled = true;
            this.badgeMode.textContent = 'MODE: IDLE';
        }
    }

    // Keyboard Human Flight Controls
    handleKeyDown(e) {
        let action = null;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            action = 2;
            e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            action = 1;
            e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            action = 3;
            e.preventDefault();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            action = 0;
            e.preventDefault();
        }

        if (action !== null && action !== this.currentAction) {
            this.currentAction = action;
            this.sendHumanAction(action);
        }
    }

    handleKeyUp(e) {
        if (['ArrowUp', 'ArrowLeft', 'ArrowRight', 'w', 'a', 'd', 'W', 'A', 'D'].includes(e.key)) {
            this.currentAction = 0;
            this.sendHumanAction(0);
        }
    }

    sendHumanAction(action) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'human_action', action }));
        }
    }

    // Web Audio Sound FX
    initAudio() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        } catch (e) {
            this.isAudioEnabled = false;
        }
    }

    playBeep(freq = 800, duration = 0.06) {
        if (!this.isAudioEnabled || !this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {}
    }

    playThrusterSound() {
        if (!this.isAudioEnabled || !this.audioCtx || Math.random() > 0.25) return;
        try {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(65 + Math.random() * 20, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.04);
        } catch (e) {}
    }

    playRcsSound() {
        if (!this.isAudioEnabled || !this.audioCtx || Math.random() > 0.3) return;
        this.playBeep(450, 0.03);
    }

    playFanfare() {
        if (!this.isAudioEnabled || !this.audioCtx) return;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => this.playBeep(freq, 0.18), i * 110);
        });
    }

    playCrashSound() {
        if (!this.isAudioEnabled || !this.audioCtx) return;
        try {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, this.audioCtx.currentTime + 0.35);
            gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.35);
        } catch (e) {}
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MissionControlApp();
});
