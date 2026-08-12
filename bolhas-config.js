/**
 * bolhas-config.js
 * Gerencia a configuração do Estoure as Bolhas e persiste no localStorage.
 */

const STORAGE_KEY = 'bolhas_config';
const DEFAULT_CONFIG = {
    logo: null
};

let config = { ...DEFAULT_CONFIG };

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initUI();
    setupEventListeners();
});

function loadConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            config = { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch (e) {
        console.warn('Erro ao carregar config:', e);
        config = { ...DEFAULT_CONFIG };
    }
}

function saveConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.error('Erro ao salvar config:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Armazenamento local cheio. Tente usar uma imagem menor.');
        }
    }
}

function initUI() {
    // Logo
    if (config.logo) {
        document.getElementById('logo-preview-img').src = config.logo;
        document.getElementById('logo-preview-container').classList.remove('hidden');
        document.getElementById('logo-placeholder').classList.add('hidden');
    }
}

function setupEventListeners() {
    // Botão Salvar/Jogar
    document.getElementById('btn-generate').addEventListener('click', () => {
        saveConfig();
        window.location.href = 'bolhas.html';
    });

    setupImageUpload('logo-drop-zone', 'input-logo', 'logo-preview-container', 'logo-preview-img', 'logo-placeholder', 'btn-remove-logo', (base64) => {
        config.logo = base64;
        saveConfig();
    });
}

// ── Utilitários de Upload e Redimensionamento (Reaproveitados) ──

function setupImageUpload(zoneId, inputId, previewContainerId, previewImgId, placeholderId, removeBtnId, callback) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const container = document.getElementById(previewContainerId);
    const img = document.getElementById(previewImgId);
    const placeholder = document.getElementById(placeholderId);
    const removeBtn = document.getElementById(removeBtnId);

    zone.addEventListener('click', (e) => {
        if (e.target !== removeBtn) input.click();
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--accent-purple)';
        zone.style.background = 'rgba(255,255,255,0.08)';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = 'var(--border-glass)';
        zone.style.background = 'transparent';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--border-glass)';
        zone.style.background = 'transparent';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0], (base64) => {
                showPreview(base64);
                callback(base64);
            });
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0], (base64) => {
                showPreview(base64);
                callback(base64);
            });
        }
    });

    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePreview();
        input.value = '';
        callback(null);
    });

    function showPreview(src) {
        img.src = src;
        container.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }

    function hidePreview() {
        img.src = '';
        container.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
}

function processFile(file, callback) {
    if (!file.type.match('image.*')) {
        alert('Por favor, selecione uma imagem (PNG ou JPG).');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resizeImage(e.target.result, 1200, callback);
    reader.readAsDataURL(file);
}

function resizeImage(dataUrl, maxDim, callback) {
    const img = new Image();
    img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round((height *= maxDim / width));
                width = maxDim;
            } else {
                width = Math.round((width *= maxDim / height));
                height = maxDim;
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
}
