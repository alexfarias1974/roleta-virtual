'use strict';

/* ════════════════════════════════════════════════════
   ROLETA VIRTUAL INTERATIVA
   Tecnologia: HTML5 + Vanilla CSS + Vanilla JS
   Armazenamento: localStorage (100% local, sem cloud)
   Resolução alvo: 1080 × 1920 px
════════════════════════════════════════════════════ */

// ══════════════════════════════════════════
// POLYFILL: roundRect para canvas
// ══════════════════════════════════════════
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        const radii = Array.isArray(r) ? r : [r, r, r, r];
        const [tl, tr, br, bl] = radii;
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
    };
}

// ══════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════
const PALETTES = {
    vibrantes: ['#FF5733','#FFC300','#28B463','#2E86C1','#7D3C98','#E74C3C','#F39C12','#17A589','#2874A6','#CB4335'],
    pasteis:   ['#FADADD','#FFF9C4','#C8E6C9','#BBDEFB','#E1BEE7','#FFE0B2','#F0F4C3','#B2EBF2','#F8BBD9','#D7CCC8'],
    classicas: ['#C0392B','#E67E22','#F1C40F','#2ECC71','#1ABC9C','#3498DB','#9B59B6','#34495E','#E74C3C','#27AE60'],
    neon:      ['#FF00FF','#00FFFF','#FF6600','#00FF00','#FF0066','#FFFF00','#0066FF','#FF3300','#00FFCC','#CC00FF'],
};

const DEFAULT_CONFIG = {
    logo: null,
    prizes: [
        { name: 'Prêmio 1', color: '#FF5733' },
        { name: 'Prêmio 2', color: '#FFC300' },
        { name: 'Prêmio 3', color: '#28B463' },
    ],
    bgImage: null,
    bgColor: '#000000',
    spinDuration: 5,
    brevoApiKey: '',
    senderEmail: '',
    senderName: '',
};

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function pad(n) {
    return String(n).padStart(2, '0');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Retorna cor de texto (preto ou branco) com melhor contraste para a cor de fundo. */
function contrastColor(hex) {
    if (!hex || hex.length < 7) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.52 ? '#111111' : '#ffffff';
}

// ══════════════════════════════════════════
// EVENT TIMER — Cadência temporal de prêmios
// ══════════════════════════════════════════
const EventTimer = {
    STORAGE_KEY: 'roulette_event_timer',
    _tickInterval: null,

    /** Carrega o estado salvo do localStorage */
    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    /** Salva o estado no localStorage */
    save(state) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('[EventTimer] Erro ao salvar:', e);
        }
    },

    /** Inicia o evento */
    start(durationMs, totalPrizes) {
        const state = {
            active:       true,
            startTime:    Date.now(),
            durationMs,
            totalPrizes,
            prizesGiven:  0,
            // Pré-calcular variação aleatória por prêmio (±10% da janela por prêmio)
            offsets:      this._buildOffsets(totalPrizes, durationMs),
        };
        this.save(state);
        return state;
    },

    /** Encerra o evento */
    stop() {
        localStorage.removeItem(this.STORAGE_KEY);
    },

    /**
     * Gera offsets aleatórios para cada prêmio.
     * Cada prêmio tem um timestamp "esperado" com variação de ±variance_ms.
     * variance = 10% do intervalo médio entre prêmios.
     */
    _buildOffsets(totalPrizes, durationMs) {
        const interval  = durationMs / totalPrizes;
        const variance  = interval * 0.10; // ±10% do intervalo
        const offsets   = [];
        for (let i = 0; i < totalPrizes; i++) {
            offsets.push((Math.random() * 2 - 1) * variance); // [-variance, +variance]
        }
        return offsets;
    },

    /**
     * Verifica se um prêmio pode ser concedido agora.
     * Retorna { allowed: bool, nextInMs: number, noEvent: bool }
     */
    check() {
        const state = this.load();

        // Se não há evento ativo, bloquear e avisar o operador
        if (!state || !state.active) return { allowed: false, nextInMs: 0, noEvent: true };

        const elapsed    = Date.now() - state.startTime;
        const { durationMs, totalPrizes, prizesGiven, offsets } = state;

        // Evento encerrado por tempo
        if (elapsed >= durationMs) return { allowed: false, nextInMs: 0, finished: true };

        // Todos os prêmios já foram dados
        if (prizesGiven >= totalPrizes) return { allowed: false, nextInMs: 0, finished: true };

        // Calcular o timestamp esperado para o PRÓXIMO prêmio
        // nextIdx=0 => primeiro prêmio fica disponível após o primeiro intervalo
        const interval   = durationMs / totalPrizes;
        const nextIdx    = prizesGiven;
        const baseTime   = interval * (nextIdx + 1);
        const offset     = offsets[nextIdx] || 0;
        const expectedAt = baseTime + offset;

        if (elapsed >= expectedAt) {
            return { allowed: true, nextInMs: 0 };
        } else {
            return { allowed: false, nextInMs: Math.ceil(expectedAt - elapsed) };
        }
    },

    /** Registra que um prêmio foi concedido */
    recordPrize() {
        const state = this.load();
        if (!state) return;
        state.prizesGiven = (state.prizesGiven || 0) + 1;
        this.save(state);
    },

    /** Retorna info resumida para o painel */
    summary() {
        const state = this.load();
        if (!state || !state.active) return null;
        const elapsed    = Date.now() - state.startTime;
        const remaining  = Math.max(0, state.durationMs - elapsed);
        const { allowed, nextInMs } = this.check();
        return {
            active:       true,
            prizesGiven:  state.prizesGiven,
            totalPrizes:  state.totalPrizes,
            remaining,
            allowed,
            nextInMs,
        };
    },

    /** Formata milissegundos em HH:MM:SS */
    formatMs(ms) {
        const total = Math.floor(ms / 1000);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    },

    // ─── Dashboard UI ─────────────────────────
    initDashboardUI() {
        const state = this.load();
        const startBtn = document.getElementById('btn-start-event');
        const stopBtn  = document.getElementById('btn-stop-event');
        if (!startBtn || !stopBtn) return;

        if (state && state.active) {
            this._setDashboardActive(true, state);
        }

        startBtn.addEventListener('click', () => {
            const hours   = parseInt(document.getElementById('input-event-hours').value)   || 0;
            const mins    = parseInt(document.getElementById('input-event-minutes').value)  || 0;
            const prizes  = parseInt(document.getElementById('input-event-total-prizes').value) || 15;
            const durMs   = (hours * 60 + mins) * 60 * 1000;
            if (durMs <= 0) { alert('Defina uma duração válida para o evento.'); return; }
            if (prizes <= 0) { alert('Defina ao menos 1 prêmio.'); return; }
            const s = this.start(durMs, prizes);
            this._setDashboardActive(true, s);
        });

        stopBtn.addEventListener('click', () => {
            if (!confirm('Encerrar o controle de tempo do evento?')) return;
            this.stop();
            this._setDashboardActive(false, null);
        });

        // Atualizar status a cada segundo
        this._tickInterval = setInterval(() => this._updateDashboardStatus(), 1000);
        this._updateDashboardStatus();
    },

    _setDashboardActive(active, state) {
        const startBtn = document.getElementById('btn-start-event');
        const stopBtn  = document.getElementById('btn-stop-event');
        if (!startBtn || !stopBtn) return;
        startBtn.style.display = active ? 'none'  : '';
        stopBtn.style.display  = active ? ''      : 'none';
        this._updateDashboardStatus();
    },

    _updateDashboardStatus() {
        const dot  = document.getElementById('timer-status-dot');
        const text = document.getElementById('timer-status-text');
        if (!dot || !text) return;
        const s = this.summary();
        if (!s) {
            dot.className = 'timer-status-dot inactive';
            text.textContent = 'Evento não iniciado';
            return;
        }
        const { allowed, prizesGiven, totalPrizes, remaining, nextInMs } = s;
        dot.className = 'timer-status-dot ' + (allowed ? 'ok' : 'hold');
        const remStr = this.formatMs(remaining);
        if (allowed) {
            text.textContent = `✅ Prêmio liberado! | ${prizesGiven}/${totalPrizes} dados | Restam: ${remStr}`;
        } else {
            const nextStr = this.formatMs(nextInMs);
            text.textContent = `⏳ Aguarde ${nextStr} | ${prizesGiven}/${totalPrizes} dados | Restam: ${remStr}`;
        }
    },

    // ─── Painel do Operador (tela da roleta) ──
    initOperatorPanel() {
        const panel = document.getElementById('operator-panel');
        if (!panel) return;
        const s = this.load();
        if (!s || !s.active) { panel.style.display = 'none'; return; }
        panel.style.display = '';
        this._updateOperatorPanel();
        this._tickInterval = setInterval(() => this._updateOperatorPanel(), 1000);
    },

    _updateOperatorPanel() {
        const s = this.summary();
        if (!s) return;
        const { allowed, prizesGiven, totalPrizes, remaining, nextInMs } = s;
        const dot   = document.getElementById('op-dot');
        const stTxt = document.getElementById('op-status-text');
        const prTxt = document.getElementById('op-prizes-text');
        const tmTxt = document.getElementById('op-time-text');
        if (!dot) return;
        dot.className  = 'op-dot ' + (allowed ? 'ok' : 'hold');
        stTxt.textContent = allowed ? 'Prêmio liberado ✅' : `Aguarde ${this.formatMs(nextInMs)} ⏳`;
        prTxt.textContent = `${prizesGiven} / ${totalPrizes} prêmios`;
        tmTxt.textContent = this.formatMs(remaining);
    },
};

// ══════════════════════════════════════════
// STORAGE MANAGER
// ══════════════════════════════════════════
const Storage = {
    KEYS: {
        CONFIG: 'roulette_config',
        STATS:  'roulette_stats',
    },

    loadConfig() {
        try {
            const raw = localStorage.getItem(this.KEYS.CONFIG);
            if (!raw) return this._cloneDefault();
            const cfg = JSON.parse(raw);
            // Garantir campos obrigatórios
            return {
                logo:         cfg.logo         ?? null,
                prizes:       Array.isArray(cfg.prizes) && cfg.prizes.length > 0
                    ? cfg.prizes.map(p => ({ ...p, isWinner: p.isWinner ?? false }))
                    : this._cloneDefault().prizes,
                bgImage:      cfg.bgImage       ?? null,
                bgColor:      cfg.bgColor       ?? '#000000',
                spinDuration: cfg.spinDuration  ?? 5,
                brevoApiKey:  cfg.brevoApiKey   ?? '',
                senderEmail:  cfg.senderEmail   ?? '',
                senderName:   cfg.senderName    ?? '',
            };
        } catch (e) {
            console.warn('[Storage] Erro ao carregar config:', e);
            return this._cloneDefault();
        }
    },

    saveConfig(cfg) {
        try {
            localStorage.setItem(this.KEYS.CONFIG, JSON.stringify(cfg));
        } catch (e) {
            console.warn('[Storage] Erro ao salvar config:', e);
            if (e.name === 'QuotaExceededError') {
                alert('Armazenamento local cheio. Remova a logo ou o background para liberar espaço.');
            }
        }
    },

    loadStats() {
        try {
            const raw = localStorage.getItem(this.KEYS.STATS);
            return raw ? JSON.parse(raw) : this._emptyStats();
        } catch (e) {
            return this._emptyStats();
        }
    },

    saveStats(stats) {
        try {
            localStorage.setItem(this.KEYS.STATS, JSON.stringify(stats));
        } catch (e) {
            console.warn('[Storage] Erro ao salvar stats:', e);
        }
    },

    recordSpin(prizeName) {
        const stats = this.loadStats();
        stats.totalSpins = (stats.totalSpins || 0) + 1;
        stats.prizeCounts[prizeName] = (stats.prizeCounts[prizeName] || 0) + 1;

        const now = new Date();
        const hourKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}`;
        const dayKey  = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        stats.spinsByHour[hourKey] = (stats.spinsByHour[hourKey] || 0) + 1;
        stats.spinsByDay[dayKey]   = (stats.spinsByDay[dayKey]   || 0) + 1;

        this.saveStats(stats);
        return stats;
    },

    resetStats() {
        this.saveStats(this._emptyStats());
    },

    _cloneDefault() {
        return {
            ...DEFAULT_CONFIG,
            prizes: DEFAULT_CONFIG.prizes.map(p => ({ ...p })),
        };
    },

    _emptyStats() {
        return { totalSpins: 0, prizeCounts: {}, spinsByHour: {}, spinsByDay: {} };
    },
};

// ══════════════════════════════════════════
// NAVEGAÇÃO (multi-page)
// ══════════════════════════════════════════
function goTo(page) {
    window.location.href = page;
}

// ══════════════════════════════════════════
// ROULETTE RENDERER (Preview + Main Wheel)
// ══════════════════════════════════════════
const RouletteRenderer = {
    /**
     * Desenha a roda da roleta em um canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {Array}  prizes    - Array de { name, color }
     * @param {number} angle     - Ângulo de rotação atual (radianos)
     * @param {boolean} isPreview - true = mini-preview, false = versão grande
     */
    draw(canvas, prizes, angle = 0, isPreview = false) {
        if (!prizes || prizes.length === 0) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const margin = isPreview ? 6 : 14;
        const radius = Math.min(cx, cy) - margin;
        const n = prizes.length;
        const sliceAngle = (2 * Math.PI) / n;

        ctx.clearRect(0, 0, W, H);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // ── Desenha segmentos ──
        prizes.forEach((prize, i) => {
            const startA = -Math.PI / 2 + i * sliceAngle;
            const endA   = startA + sliceAngle;

            // Fatia principal
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startA, endA);
            ctx.closePath();
            ctx.fillStyle = prize.color || '#7c3aed';
            ctx.fill();

            // Borda entre fatias
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.lineWidth = isPreview ? 1.5 : 3;
            ctx.stroke();

            // Overlay alternado (profundidade visual)
            if (i % 2 === 0) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, startA, endA);
                ctx.closePath();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
                ctx.fill();
            }

            // ── Texto do prêmio ──
            const midA = startA + sliceAngle / 2;
            const textR = radius * 0.66;

            ctx.save();
            ctx.rotate(midA);
            ctx.translate(textR, 0);
            ctx.rotate(Math.PI / 2);

            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor  = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur   = isPreview ? 4 : 10;
            ctx.fillStyle    = contrastColor(prize.color || '#7c3aed');

            const name = prize.name || `Prêmio ${i + 1}`;

            // Largura disponível = corda da fatia na posição do texto
            const maxW = isPreview
                ? 2 * textR * Math.sin(sliceAngle / 2) * 0.80
                : 2 * textR * Math.sin(sliceAngle / 2) * 0.82;

            // Altura disponível = comprimento do arco na posição do texto
            const maxH = isPreview
                ? sliceAngle * textR * 0.75
                : sliceAngle * textR * 0.78;

            const maxFontSize = isPreview
                ? Math.max(8,  Math.min(16, 130 / n))
                : Math.max(14, Math.min(30, 230 / n));
            const minFontSize = isPreview ? 6 : 10;

            // Mede largura de um texto com dada fonte
            function measureW(text, fs) {
                ctx.font = `bold ${fs}px 'Outfit', sans-serif`;
                return ctx.measureText(text).width;
            }

            // Quebra o nome em linhas que caibam em maxW para um dado fontSize
            function wrapWords(text, fs) {
                const words = text.split(' ');
                const lines = [];
                let current = '';
                for (const word of words) {
                    const candidate = current ? current + ' ' + word : word;
                    if (measureW(candidate, fs) <= maxW) {
                        current = candidate;
                    } else {
                        if (current) lines.push(current);
                        current = word; // palavra sozinha sempre entra como linha
                    }
                }
                if (current) lines.push(current);
                return lines;
            }

            // Estratégia:
            // 1. Começar com a fonte GRANDE e quebrar em linhas pela LARGURA
            // 2. Só reduzir a fonte se as linhas empilhadas não couberem na ALTURA
            let fs = maxFontSize;
            let finalLines = wrapWords(name, fs);

            while (fs > minFontSize) {
                const totalH = finalLines.length * fs * 1.25;
                if (totalH <= maxH) break; // cabe na altura → manter este tamanho
                fs -= 1;
                finalLines = wrapWords(name, fs); // re-calcular wrap com nova fonte
            }

            // Renderizar as linhas centradas verticalmente na fatia
            ctx.font = `bold ${fs}px 'Outfit', sans-serif`;
            const lineH  = fs * 1.25;
            const totalH = finalLines.length * lineH;
            const startY = -totalH / 2 + lineH / 2;

            finalLines.forEach((line, li) => {
                ctx.fillText(line, 0, startY + li * lineH);
            });

            ctx.restore();
        });

        // ── Anel externo ──
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = isPreview ? 4 : 8;
        ctx.stroke();

        // ── Gradiente radial (sombra interna) ──
        const shadow = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius);
        shadow.addColorStop(0, 'rgba(0,0,0,0)');
        shadow.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = shadow;
        ctx.fill();

        // ── Hub central ──
        const hubR = isPreview ? 14 : 38;
        const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, hubR);
        hubGrad.addColorStop(0, '#ffffff');
        hubGrad.addColorStop(0.55, '#e0e0e0');
        hubGrad.addColorStop(1, '#aaaaaa');
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, hubR, 0, Math.PI * 2);
        ctx.fillStyle = hubGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = isPreview ? 1.5 : 3;
        ctx.stroke();

        ctx.restore();
    },
};

// ══════════════════════════════════════════
// AUDIO ENGINE (Web Audio API)
// ══════════════════════════════════════════
const Audio = {
    _ctx: null,

    _getCtx() {
        if (!this._ctx) {
            try {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('[Audio] Web Audio API não suportada.');
            }
        }
        return this._ctx;
    },

    tick() {
        const ctx = this._getCtx();
        if (!ctx) return;
        try {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.07);
        } catch (e) { /* silencioso */ }
    },

    win() {
        const ctx = this._getCtx();
        if (!ctx) return;
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        freqs.forEach((freq, i) => {
            setTimeout(() => {
                try {
                    const osc  = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.18, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.3);
                } catch (e) { /* silencioso */ }
            }, i * 120);
        });
    },
};

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
const Dashboard = {
    config: null,
    _previewScheduled: false,

    init() {
        this.config = Storage.loadConfig();
        this._setupEventListeners();
        this._populateUI();
        this._renderPrizeList();
        this._schedulePreview();
    },

    onEnter() {
        // Recarregar config ao voltar (caso tenha mudado)
        this._schedulePreview();
    },

    // ── Configurar todos os event listeners ──
    _setupEventListeners() {
        // Logo
        const logoInput = document.getElementById('input-logo');
        const logoDrop  = document.getElementById('logo-drop-zone');

        logoInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this._handleFileUpload(e.target.files[0], 'logo');
        });

        // Click na área de drop (exceto no botão remover)
        logoDrop.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove')) return;
            logoInput.click();
        });

        this._setupDropZone(logoDrop, (file) => this._handleFileUpload(file, 'logo'));

        document.getElementById('btn-remove-logo').addEventListener('click', (e) => {
            e.stopPropagation();
            this._removeLogo();
        });

        // Controle de prêmios
        document.getElementById('btn-prize-up').addEventListener('click',   () => this._changePrizeCount(1));
        document.getElementById('btn-prize-down').addEventListener('click', () => this._changePrizeCount(-1));

        // Paletas
        document.querySelectorAll('.palette-btn').forEach(btn => {
            btn.addEventListener('click', () => this._applyPalette(btn.dataset.palette));
        });

        // Background
        const bgInput = document.getElementById('input-bg');
        const bgDrop  = document.getElementById('bg-drop-zone');

        bgInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this._handleFileUpload(e.target.files[0], 'bg');
        });

        bgDrop.addEventListener('click', (e) => {
            if (e.target.closest('.btn-remove')) return;
            bgInput.click();
        });

        this._setupDropZone(bgDrop, (file) => this._handleFileUpload(file, 'bg'));

        document.getElementById('btn-remove-bg').addEventListener('click', (e) => {
            e.stopPropagation();
            this._removeBg();
        });

        // Cor de fundo
        document.getElementById('input-bg-color').addEventListener('input', (e) => {
            this.config.bgColor = e.target.value;
            document.getElementById('bg-color-hex').textContent = e.target.value;
            this._saveAndPreview();
        });

        // Duração do giro
        document.getElementById('input-duration').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.config.spinDuration = val;
            document.getElementById('duration-display').textContent = val;
            this._saveAndPreview();
        });

        // Configurações de E-mail (Brevo)
        document.getElementById('input-brevo-api-key').addEventListener('input', (e) => {
            this.config.brevoApiKey = e.target.value.trim();
            this._saveAndPreview();
        });

        document.getElementById('input-sender-email').addEventListener('input', (e) => {
            this.config.senderEmail = e.target.value.trim();
            this._saveAndPreview();
        });

        document.getElementById('input-sender-name').addEventListener('input', (e) => {
            this.config.senderName = e.target.value.trim();
            this._saveAndPreview();
        });

        // Botões principais
        document.getElementById('btn-generate').addEventListener('click', () => this._generate());
        document.getElementById('btn-reset').addEventListener('click',    () => this._reset());
    },

    _setupDropZone(el, handler) {
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', (e) => {
            if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) handler(file);
        });
    },

    // ── Upload genérico ──
    _handleFileUpload(file, type) {
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            alert('Formato inválido. Por favor, use PNG ou JPG.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const b64 = e.target.result;
            if (type === 'logo') {
                this.config.logo = b64;
                this._showLogoPreview(b64);
            } else {
                this.config.bgImage = b64;
                this._showBgPreview(b64);
            }
            this._saveAndPreview();
        };
        reader.readAsDataURL(file);
    },

    _showLogoPreview(src) {
        document.getElementById('logo-preview-img').src = src;
        document.getElementById('logo-preview-container').classList.remove('hidden');
        document.getElementById('logo-placeholder').classList.add('hidden');
    },

    _removeLogo() {
        this.config.logo = null;
        document.getElementById('logo-preview-container').classList.add('hidden');
        document.getElementById('logo-placeholder').classList.remove('hidden');
        document.getElementById('input-logo').value = '';
        this._saveAndPreview();
    },

    _showBgPreview(src) {
        document.getElementById('bg-preview-img').src = src;
        document.getElementById('bg-preview-container').classList.remove('hidden');
        document.getElementById('bg-placeholder').classList.add('hidden');
    },

    _removeBg() {
        this.config.bgImage = null;
        document.getElementById('bg-preview-container').classList.add('hidden');
        document.getElementById('bg-placeholder').classList.remove('hidden');
        document.getElementById('input-bg').value = '';
        this._saveAndPreview();
    },

    // ── Mudar quantidade de prêmios ──
    _changePrizeCount(delta) {
        const current = this.config.prizes.length;
        const next = Math.max(1, Math.min(10, current + delta));
        if (next === current) return;

        if (next > current) {
            const idx = this.config.prizes.length;
            // Cor padrão baseada na paleta vibrante
            const defaultColor = PALETTES.vibrantes[idx % PALETTES.vibrantes.length];
            this.config.prizes.push({ name: `Prêmio ${idx + 1}`, color: defaultColor });
        } else {
            this.config.prizes.pop();
        }

        // Animação no contador
        const display = document.getElementById('prize-count-display');
        display.textContent = this.config.prizes.length;
        display.classList.add('pop');
        setTimeout(() => display.classList.remove('pop'), 300);

        this._renderPrizeList();
        this._saveAndPreview();
    },

    // ── Renderiza lista de prêmios dinamicamente ──
    _renderPrizeList() {
        const container = document.getElementById('prizes-list');
        container.innerHTML = '';
        document.getElementById('prize-count-display').textContent = this.config.prizes.length;

        this.config.prizes.forEach((prize, idx) => {
            const item = document.createElement('div');
            item.className = 'prize-item';
            item.setAttribute('role', 'listitem');
            item.style.animationDelay = `${idx * 0.04}s`;
            const isWinner = prize.isWinner ?? false;
            item.innerHTML = `
                <div class="prize-number">#${idx + 1}</div>
                <input
                    type="text"
                    class="prize-name-input"
                    placeholder="Nome do prêmio ${idx + 1}"
                    value="${escapeHtml(prize.name)}"
                    maxlength="40"
                    id="prize-name-${idx}"
                    aria-label="Nome do prêmio ${idx + 1}">
                <input
                    type="color"
                    class="prize-color-input"
                    value="${prize.color}"
                    id="prize-color-${idx}"
                    title="Cor do segmento ${idx + 1}"
                    aria-label="Cor do prêmio ${idx + 1}">
                <button
                    class="prize-winner-toggle ${isWinner ? 'active' : ''}"
                    id="prize-winner-${idx}"
                    title="${isWinner ? 'Fatia de prêmio real (clique para desmarcar)' : 'Marcar como fatia de prêmio real'}"
                    aria-label="Fatia de prêmio: ${isWinner ? 'ativa' : 'inativa'}"
                    aria-pressed="${isWinner}">🏆</button>
            `;
            container.appendChild(item);

            item.querySelector('.prize-name-input').addEventListener('input', (e) => {
                this.config.prizes[idx].name = e.target.value;
                this._saveAndPreview();
            });

            item.querySelector('.prize-color-input').addEventListener('input', (e) => {
                this.config.prizes[idx].color = e.target.value;
                this._saveAndPreview();
            });

            item.querySelector('.prize-winner-toggle').addEventListener('click', () => {
                this.config.prizes[idx].isWinner = !this.config.prizes[idx].isWinner;
                this._saveAndPreview();
                this._renderPrizeList(); // re-render para atualizar visual
            });
        });
    },

    // ── Aplicar paleta pré-definida ──
    _applyPalette(paletteName) {
        const colors = PALETTES[paletteName];
        if (!colors) return;

        this.config.prizes.forEach((prize, idx) => {
            prize.color = colors[idx % colors.length];
            const input = document.getElementById(`prize-color-${idx}`);
            if (input) input.value = prize.color;
        });

        // Atualizar estado visual dos botões
        document.querySelectorAll('.palette-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const activeBtn = document.querySelector(`[data-palette="${paletteName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-pressed', 'true');
        }

        this._saveAndPreview();
    },

    // ── Preencher UI a partir do config salvo ──
    _populateUI() {
        document.getElementById('prize-count-display').textContent = this.config.prizes.length;
        document.getElementById('input-bg-color').value            = this.config.bgColor || '#000000';
        document.getElementById('bg-color-hex').textContent        = this.config.bgColor || '#000000';
        document.getElementById('input-duration').value            = this.config.spinDuration || 5;
        document.getElementById('duration-display').textContent    = this.config.spinDuration || 5;

        // Configurações Brevo
        document.getElementById('input-brevo-api-key').value       = this.config.brevoApiKey || '';
        document.getElementById('input-sender-email').value        = this.config.senderEmail || '';
        document.getElementById('input-sender-name').value         = this.config.senderName || '';

        if (this.config.logo)    this._showLogoPreview(this.config.logo);
        if (this.config.bgImage) this._showBgPreview(this.config.bgImage);
    },

    _saveAndPreview() {
        Storage.saveConfig(this.config);
        this._schedulePreview();
    },

    /** Debounce do preview para não sobrecarregar ao digitar */
    _schedulePreview() {
        if (this._previewScheduled) return;
        this._previewScheduled = true;
        requestAnimationFrame(() => {
            this._previewScheduled = false;
            this._updatePreview();
        });
    },

    _updatePreview() {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        RouletteRenderer.draw(canvas, this.config.prizes, 0, true);
    },

    // ── Gerar roleta ──
    _generate() {
        if (!this.config.prizes.some(p => p.name.trim())) {
            alert('Por favor, insira pelo menos um nome de prêmio antes de gerar a roleta.');
            return;
        }
        Storage.saveConfig(this.config);
        goTo('roleta.html');
    },

    // ── Resetar configurações ──
    _reset() {
        if (!confirm('Deseja resetar todas as configurações?\nEsta ação não pode ser desfeita.')) return;

        this.config = Storage._cloneDefault();
        Storage.saveConfig(this.config);

        // Limpar UI
        this._removeLogo();
        this._removeBg();
        document.getElementById('input-bg-color').value         = '#000000';
        document.getElementById('bg-color-hex').textContent     = '#000000';
        document.getElementById('input-duration').value         = 5;
        document.getElementById('duration-display').textContent = '5';
        document.querySelectorAll('.palette-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });

        this._renderPrizeList();
        this._updatePreview();
    },
};

// ══════════════════════════════════════════
// ROULETTE (View da Roleta)
// ══════════════════════════════════════════
const Roulette = {
    config:       null,
    canvas:       null,
    ctx:          null,
    currentAngle: 0,         // ângulo acumulado (radianos)
    isSpinning:   false,
    _animId:      null,
    _lastSegment: -1,        // para efeito sonoro de tick
    CANVAS_SIZE:  860,

    onEnter() {
        this.config = Storage.loadConfig();
        this.canvas = document.getElementById('roulette-canvas');
        this.ctx    = this.canvas.getContext('2d');
        this.canvas.width  = this.CANVAS_SIZE;
        this.canvas.height = this.CANVAS_SIZE;

        this._applyBackground();
        this._applyLogo();
        this._draw();
    },

    _applyBackground() {
        const bg = document.getElementById('roulette-bg');
        if (this.config.bgImage) {
            bg.style.backgroundImage    = `url('${this.config.bgImage}')`;
            bg.style.backgroundSize     = 'cover';
            bg.style.backgroundPosition = 'center';
            bg.style.backgroundColor   = '';
        } else {
            bg.style.backgroundImage  = 'none';
            bg.style.backgroundColor  = this.config.bgColor || '#000000';
        }
    },

    _applyLogo() {
        const logoEl = document.getElementById('roulette-logo');
        if (this.config.logo) {
            logoEl.src = this.config.logo;
            logoEl.classList.remove('hidden');
        } else {
            logoEl.classList.add('hidden');
        }
    },

    _draw() {
        RouletteRenderer.draw(this.canvas, this.config.prizes, this.currentAngle, false);
    },

    // ── Lógica principal do giro ──
    spin() {
        if (this.isSpinning) return;
        const prizes = this.config.prizes;
        if (!prizes || prizes.length === 0) return;

        // Desbloquear AudioContext (requer interação do usuário)
        Audio._getCtx();

        // ── Verificar cadência do EventTimer ──
        const timerCheck     = EventTimer.check();
        this._prizeBlocked   = !timerCheck.allowed;

        const n          = prizes.length;
        const sliceAngle = (2 * Math.PI) / n;

        let deltaAngle, winnerIdx;

        // Separar fatias marcadas como prêmio real das neutras
        const winnerSlots  = prizes.map((p, i) => i).filter(i => prizes[i].isWinner);
        const neutralSlots = prizes.map((p, i) => i).filter(i => !prizes[i].isWinner);

        if (this._prizeBlocked) {
            // ── BLOQUEADO: cair em fatia NEUTRA (não marcada como prêmio real) ──
            // Se não houver fatias neutras, usa qualquer fatia que não seja vencedora
            const pool = neutralSlots.length > 0 ? neutralSlots
                       : prizes.map((_, i) => i); // fallback: qualquer fatia
            const pick  = pool[Math.floor(Math.random() * pool.length)];
            const needed = -(pick * sliceAngle + sliceAngle / 2 + this.currentAngle);
            deltaAngle   = ((needed % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (deltaAngle < 0.05) deltaAngle += 2 * Math.PI;
            winnerIdx = -1; // sinaliza: nenhum prêmio
        } else {
            // ── LIBERADO: cair em fatia de PRÊMIO REAL (marcada com 🏆) ──
            // Se nenhuma fatia estiver marcada, usa qualquer fatia
            const pool  = winnerSlots.length > 0 ? winnerSlots
                        : prizes.map((_, i) => i);
            winnerIdx   = pool[Math.floor(Math.random() * pool.length)];
            const needed = -(winnerIdx * sliceAngle + sliceAngle / 2 + this.currentAngle);
            deltaAngle   = ((needed % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (deltaAngle < 0.05) deltaAngle += 2 * Math.PI;
        }

        const minSpins   = 5 + Math.floor(Math.random() * 3); // 5 a 7 voltas completas
        const totalDelta = deltaAngle + minSpins * 2 * Math.PI;
        const duration   = (this.config.spinDuration || 5) * 1000; // ms

        this._animate(this.currentAngle, this.currentAngle + totalDelta, duration, winnerIdx);
    },

    _animate(startAngle, endAngle, duration, winnerIdx) {
        this.isSpinning = true;
        this._lastSegment = -1;
        const spinBtn = document.getElementById('btn-spin');
        spinBtn.disabled = true;
        this.canvas.classList.add('spinning');

        const startTime = performance.now();
        const prizes    = this.config.prizes;
        const n         = prizes.length;
        const sliceAngle = (2 * Math.PI) / n;

        const frame = (now) => {
            const elapsed = now - startTime;
            const t       = Math.min(elapsed / duration, 1);
            const eased   = this._easeOut(t);

            this.currentAngle = startAngle + (endAngle - startAngle) * eased;
            this._draw();

            // Efeito sonoro de tick ao cruzar divisória entre segmentos
            if (t < 0.95) { // Para o tick antes de terminar (evita ruído duplo)
                const normAngle    = ((this.currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const segAtTop     = Math.floor(((2 * Math.PI - normAngle) / sliceAngle + 0.5) % n);
                if (segAtTop !== this._lastSegment) {
                    this._lastSegment = segAtTop;
                    Audio.tick();
                }
            }

            if (t < 1) {
                this._animId = requestAnimationFrame(frame);
            } else {
                this.currentAngle = endAngle;
                this._draw();
                // winnerIdx=-1 significa giro bloqueado (sem prêmio)
                const winnerName = winnerIdx >= 0
                    ? (prizes[winnerIdx]?.name || `Prêmio ${winnerIdx + 1}`)
                    : '';
                this._onComplete(winnerIdx, winnerName);
            }
        };

        this._animId = requestAnimationFrame(frame);
    },

    /** Quintic ease-out: desaceleração suave e realista */
    _easeOut(t) {
        return 1 - Math.pow(1 - t, 5);
    },

    _onComplete(winnerIdx, winnerName) {
        this.isSpinning = false;
        this.canvas.classList.remove('spinning');
        document.getElementById('btn-spin').disabled = false;

        // ── Verificar se o prêmio estava bloqueado pelo EventTimer ──
        if (this._prizeBlocked) {
            this._prizeBlocked = false;
            document.getElementById('last-prize-name').textContent = '—';
            Audio.tick();
            const timerState = EventTimer.load();
            if (!timerState || !timerState.active) {
                // Evento não iniciado — avisar operador
                setTimeout(() => Modal.showNoEvent(), 400);
            } else {
                setTimeout(() => Modal.showBlocked(), 400);
            }
            return;
        }
        this._prizeBlocked = false;

        // Registrar nas estatísticas e no EventTimer
        Storage.recordSpin(winnerName);
        EventTimer.recordPrize();

        // Atualizar display do último prêmio
        document.getElementById('last-prize-name').textContent = winnerName;

        // Som de vitória e modal
        Audio.win();
        setTimeout(() => Modal.show(winnerName), 400);
    },
};

// ══════════════════════════════════════════
// MODAL DE RESULTADO
// ══════════════════════════════════════════
const Modal = {
    _rafId: null,
    _particles: [],
    _running: false,

    show(prizeName) {
        document.getElementById('modal-prize-name').textContent = prizeName;
        document.getElementById('modal-result').classList.remove('hidden');
        this._startConfetti();
    },

    hide() {
        document.getElementById('modal-result').classList.add('hidden');
        this._stopConfetti();
    },

    /** Exibido quando o EventTimer bloqueia o prêmio */
    showBlocked() {
        const modal    = document.getElementById('modal-result');
        const prizeEl  = document.getElementById('modal-prize-name');
        const titleEl  = document.getElementById('modal-title');
        const subEl    = document.querySelector('.modal-subtitle');
        const emojiEl  = document.querySelector('.modal-emoji');

        // Salvar textos originais para restaurar depois
        this._origTitle    = titleEl.textContent;
        this._origSubtitle = subEl.textContent;
        this._origEmoji    = emojiEl.textContent;

        emojiEl.textContent  = '🏆';
        titleEl.textContent  = 'Obrigado por participar!';
        subEl.textContent    = 'Continue tentando, um prêmio pode ser seu!';
        prizeEl.textContent  = '';

        modal.classList.remove('hidden');

        // Auto-fechar em 2.5s
        this._blockedTimeout = setTimeout(() => {
            this._closeBlocked();
        }, 2500);
    },

    _closeBlocked() {
        clearTimeout(this._blockedTimeout);
        const modal   = document.getElementById('modal-result');
        const titleEl = document.getElementById('modal-title');
        const subEl   = document.querySelector('.modal-subtitle');
        const emojiEl = document.querySelector('.modal-emoji');
        modal.classList.add('hidden');
        // Restaurar textos originais
        if (this._origTitle)    titleEl.textContent = this._origTitle;
        if (this._origSubtitle) subEl.textContent   = this._origSubtitle;
        if (this._origEmoji)    emojiEl.textContent  = this._origEmoji;
    },

    /** Exibido quando o operador girou sem ter iniciado o evento */
    showNoEvent() {
        const modal   = document.getElementById('modal-result');
        const prizeEl = document.getElementById('modal-prize-name');
        const titleEl = document.getElementById('modal-title');
        const subEl   = document.querySelector('.modal-subtitle');
        const emojiEl = document.querySelector('.modal-emoji');

        this._origTitle    = titleEl.textContent;
        this._origSubtitle = subEl.textContent;
        this._origEmoji    = emojiEl.textContent;

        emojiEl.textContent = '⚙️';
        titleEl.textContent = 'Evento não iniciado!';
        subEl.textContent   = 'Acesse as Configurações e clique em "Iniciar Evento" antes de começar.';
        prizeEl.textContent = '';

        modal.classList.remove('hidden');

        this._blockedTimeout = setTimeout(() => this._closeBlocked(), 3500);
    },

    _startConfetti() {
        const canvas    = document.getElementById('confetti-canvas');
        const card      = document.querySelector('.modal-card');
        canvas.width  = card.offsetWidth  || 700;
        canvas.height = card.offsetHeight || 500;
        const ctx = canvas.getContext('2d');

        const colors = ['#7c3aed','#f59e0b','#ef4444','#10b981','#3b82f6','#ec4899','#ffffff'];
        this._particles = Array.from({ length: 100 }, () => ({
            x:   Math.random() * canvas.width,
            y:   -20 - Math.random() * canvas.height,
            vx:  (Math.random() - 0.5) * 5,
            vy:  Math.random() * 4 + 2,
            w:   Math.random() * 10 + 5,
            h:   Math.random() * 5 + 3,
            rot: Math.random() * Math.PI * 2,
            rs:  (Math.random() - 0.5) * 0.2,
            col: colors[Math.floor(Math.random() * colors.length)],
            opacity: Math.random() * 0.5 + 0.5,
        }));

        this._running = true;
        const loop = () => {
            if (!this._running) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this._particles.forEach(p => {
                p.x   += p.vx;
                p.y   += p.vy;
                p.vy  += 0.07; // gravidade
                p.rot += p.rs;
                if (p.y > canvas.height + 20) {
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                    p.vy = Math.random() * 4 + 2;
                }
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.col;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });
            this._rafId = requestAnimationFrame(loop);
        };
        loop();
    },

    _stopConfetti() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = null;
    },
};

// ══════════════════════════════════════════
// ESTATÍSTICAS
// ══════════════════════════════════════════
const Stats = {
    onEnter() {
        const stats  = Storage.loadStats();
        const config = Storage.loadConfig();
        this._render(stats, config);
    },

    _render(stats, config) {
        // Total
        document.getElementById('stat-total').textContent = stats.totalSpins || 0;

        // Por prêmio
        this._renderPrizeBars(stats, config);

        // Gráficos
        this._drawHourChart(stats.spinsByHour || {});
        this._drawDayChart(stats.spinsByDay   || {});
    },

    _renderPrizeBars(stats, config) {
        const container = document.getElementById('stats-prizes-list');
        container.innerHTML = '';

        const prizes   = config.prizes || [];
        const counts   = prizes.map(p => stats.prizeCounts?.[p.name] || 0);
        const maxCount = Math.max(1, ...counts);

        if (prizes.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Nenhum prêmio configurado.</p>';
            return;
        }

        prizes.forEach((prize, idx) => {
            const count = counts[idx];
            const pct   = (count / maxCount) * 100;
            const item  = document.createElement('div');
            item.className = 'prize-stat-item';
            item.style.animationDelay = `${idx * 0.06}s`;
            item.innerHTML = `
                <div class="prize-stat-name" title="${escapeHtml(prize.name)}">${escapeHtml(prize.name)}</div>
                <div class="prize-stat-bar-wrap">
                    <div class="prize-stat-bar"
                         style="width:0%; background:${prize.color}; box-shadow:0 0 14px ${prize.color}80;">
                    </div>
                </div>
                <div class="prize-stat-count">${count}</div>
            `;
            container.appendChild(item);

            // Animar barra após render
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const bar = item.querySelector('.prize-stat-bar');
                    if (bar) bar.style.width = `${pct}%`;
                }, 80 + idx * 60);
            });
        });
    },

    _drawHourChart(spinsByHour) {
        const canvas = document.getElementById('stats-hour-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const today  = todayStr();
        const hours  = Array.from({ length: 24 }, (_, i) => `${today}T${pad(i)}`);
        const values = hours.map(h => spinsByHour[h] || 0);
        const labels = Array.from({ length: 24 }, (_, i) => `${pad(i)}h`);

        this._drawBarChart(ctx, canvas.width, canvas.height, values, labels, '#7c3aed', '#9d5bf5', 4);
    },

    _drawDayChart(spinsByDay) {
        const canvas = document.getElementById('stats-day-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const sortedKeys = Object.keys(spinsByDay).sort();
        const values = sortedKeys.length > 0 ? sortedKeys.map(k => spinsByDay[k]) : [0];
        const labels = sortedKeys.length > 0 ? sortedKeys.map(k => k.slice(5))   : ['Hoje'];

        this._drawBarChart(ctx, canvas.width, canvas.height, values, labels, '#f59e0b', '#f97316', Math.ceil(24 / Math.max(labels.length, 1)));
    },

    _drawBarChart(ctx, W, H, values, labels, colorA, colorB, labelStep) {
        ctx.clearRect(0, 0, W, H);

        const padL = 52, padR = 20, padT = 28, padB = 52;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const n      = values.length;
        const maxVal = Math.max(1, ...values);

        const barW  = Math.max(4, Math.floor(chartW / n) - 4);
        const step  = chartW / n;

        // Grade horizontal
        const gridLines = 4;
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridLines; i++) {
            const y    = padT + chartH - (i / gridLines) * chartH;
            const val  = Math.round(maxVal * i / gridLines);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font      = '13px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(val, padL - 8, y + 5);
        }

        // Barras
        values.forEach((val, i) => {
            const barH = Math.max(val > 0 ? 4 : 0, (val / maxVal) * chartH);
            const x    = padL + i * step + (step - barW) / 2;
            const y    = padT + chartH - barH;

            if (val > 0) {
                const grad = ctx.createLinearGradient(x, y, x, y + barH);
                grad.addColorStop(0, colorB);
                grad.addColorStop(1, colorA);

                ctx.shadowColor = colorA;
                ctx.shadowBlur  = 12;

                ctx.fillStyle = grad;
                ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
                ctx.fill();

                ctx.shadowBlur = 0;

                // Valor acima da barra
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.font      = 'bold 12px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(val, x + barW / 2, y - 6);
            }

            // Label X (respeita step configurável)
            if (labelStep && i % labelStep === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.font      = '11px Inter';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 0;
                ctx.fillText(labels[i], x + barW / 2, padT + chartH + 22);
            } else if (!labelStep) {
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.font      = '11px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(labels[i], x + barW / 2, padT + chartH + 22);
            }
        });

        ctx.shadowBlur = 0;
    },

    reset() {
        if (!confirm('Deseja apagar todo o histórico de estatísticas?\nEsta ação não pode ser desfeita.')) return;
        Storage.resetStats();
        const config = Storage.loadConfig();
        this._render(Storage._emptyStats(), config);
    },

    generateExcel(download = true) {
        const stats = Storage.loadStats();
        const config = Storage.loadConfig();
        const today = todayStr();

        // 1. Resumo Sheet
        const summaryData = [
            ["Métrica", "Valor"],
            ["Total de Sorteios Realizados", stats.totalSpins || 0],
            ["Data do Relatório", new Date().toLocaleString("pt-BR")],
            ["Duração da Animação (segundos)", config.spinDuration || 5],
            ["Quantidade de Prêmios Configurados", config.prizes.length]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

        // 2. Prêmios Sheet
        const prizesData = [
            ["ID", "Nome do Prêmio", "Cor (HEX)", "Quantidade de Sorteios", "Porcentagem (%)"]
        ];
        config.prizes.forEach((prize, idx) => {
            const count = stats.prizeCounts[prize.name] || 0;
            const pct = stats.totalSpins > 0 ? ((count / stats.totalSpins) * 100).toFixed(2) : 0;
            prizesData.push([
                idx + 1,
                prize.name,
                prize.color,
                count,
                parseFloat(pct)
            ]);
        });
        const wsPrizes = XLSX.utils.aoa_to_sheet(prizesData);

        // 3. Por Hora Sheet (Hoje)
        const hourData = [
            ["Hora", "Quantidade de Sorteios"]
        ];
        for (let i = 0; i < 24; i++) {
            const hourKey = `${today}T${pad(i)}`;
            const count = stats.spinsByHour[hourKey] || 0;
            hourData.push([`${pad(i)}:00`, count]);
        }
        const wsHour = XLSX.utils.aoa_to_sheet(hourData);

        // 4. Por Dia Sheet (Histórico)
        const dayData = [
            ["Data", "Quantidade de Sorteios"]
        ];
        const sortedDays = Object.keys(stats.spinsByDay || {}).sort();
        sortedDays.forEach(day => {
            dayData.push([day, stats.spinsByDay[day]]);
        });
        if (sortedDays.length === 0) {
            dayData.push(["Nenhum registro", 0]);
        }
        const wsDay = XLSX.utils.aoa_to_sheet(dayData);

        // Criar pasta de trabalho (Workbook)
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");
        XLSX.utils.book_append_sheet(wb, wsPrizes, "Prêmios");
        XLSX.utils.book_append_sheet(wb, wsHour, "Por Hora (Hoje)");
        XLSX.utils.book_append_sheet(wb, wsDay, "Por Dia (Histórico)");

        // Gerar arquivo e baixar
        const fileName = `Estatisticas_Roleta_${today}.xlsx`;
        if (download) {
            XLSX.writeFile(wb, fileName);
        }
        return { wb, fileName, stats, config };
    },

    async sendEmail(recipient) {
        if (!recipient) {
            alert("Por favor, informe um endereço de e-mail.");
            return;
        }

        const config = Storage.loadConfig();
        if (!config.brevoApiKey || !config.senderEmail) {
            alert("A API Brevo não está configurada! Vá para a tela de Configurações (Dashboard) e preencha a chave de API e o e-mail do remetente.");
            return;
        }

        const feedbackEl = document.getElementById("export-feedback");
        const sendBtn = document.getElementById("btn-send-email");
        
        // Exibir feedback de progresso e desativar botão
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = "⏳ Enviando...";
        }
        if (feedbackEl) {
            feedbackEl.textContent = "Preparando planilha e enviando e-mail...";
            feedbackEl.className = "export-feedback success";
            feedbackEl.classList.remove("hidden");
        }

        try {
            const stats = Storage.loadStats();
            const today = todayStr();
            const { wb, fileName } = this.generateExcel(false); // não baixa

            // Converter planilha para Base64 usando o SheetJS
            const xlsxBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

            // HTML amigável para o corpo do e-mail
            let htmlContent = `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #7c3aed; text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">🎡 Relatório da Roleta Virtual</h2>
                    <p>Olá,</p>
                    <p>Segue o resumo das estatísticas consolidadas da Roleta Virtual de Eventos gerado em <strong>${new Date().toLocaleString("pt-BR")}</strong>:</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #555;">📊 Resumo Geral</h3>
                        <p style="margin: 5px 0;"><strong>Total de Sorteios:</strong> ${stats.totalSpins || 0}</p>
                        <p style="margin: 5px 0;"><strong>Prêmios Configurados:</strong> ${config.prizes.length}</p>
                    </div>

                    <h3 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px;">🎁 Sorteios por Prêmio</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background-color: #7c3aed; color: white;">
                                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Prêmio</th>
                                <th style="padding: 8px; text-align: center; border: 1px solid #ddd; width: 100px;">Qtd</th>
                                <th style="padding: 8px; text-align: center; border: 1px solid #ddd; width: 100px;">%</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            config.prizes.forEach((prize) => {
                const count = stats.prizeCounts[prize.name] || 0;
                const pct = stats.totalSpins > 0 ? ((count / stats.totalSpins) * 100).toFixed(1) : 0;
                htmlContent += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${prize.color}; margin-right:8px;"></span>${prize.name}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${count}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${pct}%</td>
                    </tr>
                `;
            });

            htmlContent += `
                        </tbody>
                    </table>
                    <p style="margin-top: 25px; font-size: 0.9em; color: #666; border-top: 1px solid #eee; padding-top: 15px;">
                        * A planilha consolidada contendo todas as abas de dados (Resumo, Detalhes, Horários e Datas) foi anexada a este e-mail.
                    </p>
                    <p style="text-align: center; color: #999; font-size: 0.8em; margin-top: 20px;">
                        Gerado por Roleta Virtual Interativa
                    </p>
                </div>
            `;

            // Construir payload da Brevo v3 API
            const requestBody = {
                sender: {
                    name: config.senderName || "Roleta Virtual",
                    email: config.senderEmail
                },
                to: [
                    {
                        email: recipient
                    }
                ],
                subject: `Relatório de Estatísticas - Roleta Virtual - ${today}`,
                htmlContent: htmlContent,
                attachment: [
                    {
                        content: xlsxBase64,
                        name: fileName
                    }
                ]
            };

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "api-key": config.brevoApiKey,
                    "content-type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                if (feedbackEl) {
                    feedbackEl.textContent = `Planilha enviada com sucesso para ${recipient}!`;
                    feedbackEl.className = "export-feedback success";
                }
                const emailInput = document.getElementById('input-email-recipient');
                if (emailInput) emailInput.value = "";
            } else {
                const errData = await response.json();
                console.error("Erro API Brevo:", errData);
                if (feedbackEl) {
                    feedbackEl.textContent = `Erro ao enviar e-mail: ${errData.message || 'Verifique as chaves e remetente configurados.'}`;
                    feedbackEl.className = "export-feedback error";
                }
            }
        } catch (err) {
            console.error("Erro de Rede:", err);
            if (feedbackEl) {
                feedbackEl.textContent = "Erro de conexão ao tentar enviar o e-mail.";
                feedbackEl.className = "export-feedback error";
            }
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = "📧 Enviar por Email";
            }
            // Ocultar feedback após 8s
            setTimeout(() => {
                if (feedbackEl) feedbackEl.classList.add("hidden");
            }, 8000);
        }
    }
};

// ══════════════════════════════════════════
// INICIALIZAÇÃO (multi-page)
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;

    // ── DASHBOARD ──────────────────────────
    if (page === 'dashboard') {
        Dashboard.init();
        EventTimer.initDashboardUI();
    }

    // ── ROLETA ─────────────────────────────
    else if (page === 'roulette') {
        Roulette.onEnter();
        // Painel do operador desativado na tela da roleta — visível apenas no Dashboard

        document.getElementById('btn-spin').addEventListener('click', () => Roulette.spin());
        document.getElementById('roulette-canvas').addEventListener('click', () => {
            if (!Roulette.isSpinning) Roulette.spin();
        });

        document.getElementById('btn-to-config').addEventListener('click', () => goTo('config-roleta.html'));
        document.getElementById('btn-to-stats').addEventListener('click',  () => goTo('estatisticas.html'));

        document.getElementById('btn-modal-close').addEventListener('click', () => Modal.hide());
        document.getElementById('modal-result').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) Modal.hide();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('modal-result').classList.contains('hidden')) {
                Modal.hide();
            }
        });
    }

    // ── ESTATÍSTICAS ───────────────────────
    else if (page === 'stats') {
        Stats.onEnter();

        document.getElementById('btn-stats-to-roulette').addEventListener('click', () => goTo('roleta.html'));
        document.getElementById('btn-stats-to-config').addEventListener('click',   () => goTo('config-roleta.html'));
        document.getElementById('btn-reset-stats').addEventListener('click',       () => Stats.reset());

        // Enviar por Email
        document.getElementById('btn-send-email').addEventListener('click', () => {
            const emailInput = document.getElementById('input-email-recipient');
            const email = emailInput.value.trim();
            if (!email) {
                alert("Por favor, preencha o e-mail do destinatário.");
                emailInput.focus();
                return;
            }
            // Simples validação de e-mail
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                alert("Por favor, insira um e-mail válido.");
                emailInput.focus();
                return;
            }
            try {
                Stats.sendEmail(email);
            } catch (err) {
                console.error("Erro ao enviar e-mail:", err);
                alert("Ocorreu um erro ao preparar o e-mail.");
            }
        });
    }

    console.log(`[Roleta Virtual] Página "${page}" inicializada. ✓`);
});
