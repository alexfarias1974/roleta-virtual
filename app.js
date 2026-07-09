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
                prizes:       Array.isArray(cfg.prizes) && cfg.prizes.length > 0 ? cfg.prizes : this._cloneDefault().prizes,
                bgImage:      cfg.bgImage       ?? null,
                bgColor:      cfg.bgColor       ?? '#000000',
                spinDuration: cfg.spinDuration  ?? 5,
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

            const fontSize = isPreview
                ? Math.max(8, Math.min(16, 130 / n))
                : Math.max(14, Math.min(30, 230 / n));

            ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur   = isPreview ? 4 : 10;

            const maxChars = isPreview ? 10 : (n <= 5 ? 22 : n <= 7 ? 16 : 12);
            const name = prize.name || `Prêmio ${i + 1}`;
            const label = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;

            ctx.fillStyle = contrastColor(prize.color || '#7c3aed');
            ctx.fillText(label, 0, 0);

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

        const n          = prizes.length;
        const sliceAngle = (2 * Math.PI) / n;

        // Escolher vencedor aleatório
        const winner = Math.floor(Math.random() * n);

        // Calcular ângulo necessário para posicionar o vencedor no topo (ponteiro)
        // Segmento i começa em: -π/2 + i * sliceAngle (canvas coords)
        // Centro do segmento i: -π/2 + i * sliceAngle + sliceAngle/2
        // Após rotação R (currentAngle), o segmento i está em: centro + R
        // Para alinhar o vencedor ao topo (-π/2):
        //   -π/2 + winner*sliceAngle + sliceAngle/2 + (currentAngle + deltaR) ≡ -π/2 (mod 2π)
        //   winner*sliceAngle + sliceAngle/2 + currentAngle + deltaR ≡ 0 (mod 2π)
        //   deltaR ≡ -(winner*sliceAngle + sliceAngle/2 + currentAngle) (mod 2π)
        const needed    = -(winner * sliceAngle + sliceAngle / 2 + this.currentAngle);
        let deltaAngle  = ((needed % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (deltaAngle < 0.05) deltaAngle += 2 * Math.PI; // mínimo de movimento

        const minSpins   = 5 + Math.floor(Math.random() * 3); // 5 a 7 voltas completas
        const totalDelta = deltaAngle + minSpins * 2 * Math.PI;
        const duration   = (this.config.spinDuration || 5) * 1000; // ms

        this._animate(this.currentAngle, this.currentAngle + totalDelta, duration, winner);
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
                this._onComplete(winnerIdx, prizes[winnerIdx]?.name || `Prêmio ${winnerIdx + 1}`);
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

        // Registrar nas estatísticas
        Storage.recordSpin(winnerName);

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
};

// ══════════════════════════════════════════
// INICIALIZAÇÃO (multi-page)
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;

    // ── DASHBOARD ──────────────────────────
    if (page === 'dashboard') {
        Dashboard.init();
    }

    // ── ROLETA ─────────────────────────────
    else if (page === 'roulette') {
        Roulette.onEnter();

        document.getElementById('btn-spin').addEventListener('click', () => Roulette.spin());
        document.getElementById('roulette-canvas').addEventListener('click', () => {
            if (!Roulette.isSpinning) Roulette.spin();
        });

        document.getElementById('btn-to-config').addEventListener('click', () => goTo('index.html'));
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
        document.getElementById('btn-stats-to-config').addEventListener('click',   () => goTo('index.html'));
        document.getElementById('btn-reset-stats').addEventListener('click',       () => Stats.reset());
    }

    console.log(`[Roleta Virtual] Página "${page}" inicializada. ✓`);
});
