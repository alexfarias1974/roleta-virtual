/**
 * caca-config.js — Versão 2 (compatível com novo layout)
 */

const STORAGE_KEY = 'caca_config';
const DEFAULT_CONFIG = {
    logo: null,
    difficulty: 'easy',
    words: ['BRASIL', 'TECNOLOGIA', 'FUTURO', 'INOVACAO', 'SUCESSO']
};

let config = { ...DEFAULT_CONFIG };
let wordCount = 5;

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initUI();
    setupEventListeners();
});

function loadConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) { console.warn('Erro ao carregar config:', e); }
}

function saveConfig() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
    catch (e) { if (e.name === 'QuotaExceededError') alert('Imagem muito grande. Tente outra.'); }
}

function initUI() {
    // Logo
    if (config.logo) showLogoPreview(config.logo);

    // Difficulty
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.diff === config.difficulty);
    });
    document.getElementById('difficulty-select').value = config.difficulty;

    // Word count
    wordCount = Math.max(1, Math.min(10, config.words.length || 5));
    document.getElementById('word-count-display').textContent = wordCount;
    generateWordInputs();
}

function generateWordInputs() {
    const container = document.getElementById('words-container');
    container.innerHTML = '';
    for (let i = 0; i < wordCount; i++) {
        const div = document.createElement('div');
        div.className = 'word-field';

        const label = document.createElement('label');
        label.textContent = `Palavra ${i + 1}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 15;
        input.placeholder = 'Digite aqui...';
        input.value = config.words[i] || '';
        input.addEventListener('input', function () {
            this.value = this.value
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^A-Za-z]/g, '').toUpperCase();
        });

        div.appendChild(label);
        div.appendChild(input);
        container.appendChild(div);
    }
}

function setupEventListeners() {
    // Difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            config.difficulty = btn.dataset.diff;
            document.getElementById('difficulty-select').value = config.difficulty;
        });
    });

    // Qty +/-
    document.getElementById('qty-minus').addEventListener('click', () => {
        if (wordCount <= 1) return;
        saveCurrentWords();
        wordCount--;
        document.getElementById('word-count-display').textContent = wordCount;
        generateWordInputs();
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
        if (wordCount >= 10) return;
        saveCurrentWords();
        wordCount++;
        document.getElementById('word-count-display').textContent = wordCount;
        generateWordInputs();
    });

    // Play
    document.getElementById('btn-generate').addEventListener('click', () => {
        saveCurrentWords();
        config.words = config.words.filter(w => w.trim().length >= 3);
        if (config.words.length === 0) {
            alert('Digite pelo menos uma palavra com 3 ou mais letras.');
            return;
        }
        saveConfig();
        window.location.href = 'caca-palavras.html';
    });

    // Logo upload
    const zone = document.getElementById('logo-drop-zone');
    const input = document.getElementById('input-logo');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--gold)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.style.borderColor = '';
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

    document.getElementById('btn-remove-logo').addEventListener('click', () => {
        config.logo = null;
        saveConfig();
        document.getElementById('logo-preview-wrap').style.display = 'none';
        document.getElementById('logo-drop-zone').style.display = '';
    });
}

function saveCurrentWords() {
    const inputs = document.querySelectorAll('.word-field input');
    config.words = Array.from(inputs).map(i => i.value.trim());
}

function showLogoPreview(src) {
    document.getElementById('logo-preview-img').src = src;
    document.getElementById('logo-preview-wrap').style.display = 'block';
    document.getElementById('logo-drop-zone').style.display = 'none';
}

function processFile(file) {
    if (!file.type.match('image.*')) return alert('Selecione uma imagem PNG ou JPG.');
    const reader = new FileReader();
    reader.onload = e => resizeImage(e.target.result, 800, base64 => {
        config.logo = base64;
        saveConfig();
        showLogoPreview(base64);
    });
    reader.readAsDataURL(file);
}

function resizeImage(dataUrl, maxDim, callback) {
    const img = new Image();
    img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
            else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
}
