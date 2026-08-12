/**
 * memoria-config.js
 * Gerencia a configuração do Jogo da Memória e persiste no localStorage.
 */

const STORAGE_KEY = 'memoria_config';
const DEFAULT_CONFIG = {
    pairsCount: 4,
    bgColor: '#000000',
    bgImage: null,
    logo: null,
    cards: [] // array de data-urls para as cartas
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
            // Garantir limites
            if (config.pairsCount < 2) config.pairsCount = 2;
            if (config.pairsCount > 10) config.pairsCount = 10;
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
            alert('Armazenamento local cheio. Tente imagens menores.');
        }
    }
}

function initUI() {
    // Quantidade de Pares
    document.getElementById('pairs-count-display').textContent = config.pairsCount;
    
    // Background Color
    document.getElementById('input-bg-color').value = config.bgColor;
    document.getElementById('bg-color-hex').textContent = config.bgColor;
    
    // Background Image
    if (config.bgImage) {
        document.getElementById('bg-preview-img').src = config.bgImage;
        document.getElementById('bg-preview-container').classList.remove('hidden');
        document.getElementById('bg-placeholder').classList.add('hidden');
    }
    
    // Logo
    if (config.logo) {
        document.getElementById('logo-preview-img').src = config.logo;
        document.getElementById('logo-preview-container').classList.remove('hidden');
        document.getElementById('logo-placeholder').classList.add('hidden');
    }

    renderCardsList();
}

function setupEventListeners() {
    // Quantidade de Pares
    document.getElementById('btn-pairs-up').addEventListener('click', () => {
        if (config.pairsCount < 10) {
            config.pairsCount++;
            document.getElementById('pairs-count-display').textContent = config.pairsCount;
            renderCardsList();
            saveConfig();
        }
    });

    document.getElementById('btn-pairs-down').addEventListener('click', () => {
        if (config.pairsCount > 2) {
            config.pairsCount--;
            document.getElementById('pairs-count-display').textContent = config.pairsCount;
            renderCardsList();
            saveConfig();
        }
    });

    // Background Color
    document.getElementById('input-bg-color').addEventListener('input', (e) => {
        config.bgColor = e.target.value;
        document.getElementById('bg-color-hex').textContent = e.target.value;
        saveConfig();
    });

    // Botão Salvar/Jogar
    document.getElementById('btn-generate').addEventListener('click', () => {
        // Validação simples
        let missingPhotos = false;
        for (let i = 0; i < config.pairsCount; i++) {
            if (!config.cards[i]) {
                missingPhotos = true;
                break;
            }
        }
        if (missingPhotos) {
            const proceed = confirm("Você não fez o upload de todas as fotos necessárias. Deseja continuar mesmo assim?");
            if (!proceed) return;
        }
        
        saveConfig();
        window.location.href = 'memoria.html';
    });

    // Resetar
    document.getElementById('btn-reset').addEventListener('click', () => {
        if (confirm('Deseja resetar todas as configurações do Jogo da Memória?')) {
            config = { ...DEFAULT_CONFIG };
            saveConfig();
            initUI();
        }
    });

    // File Uploads (Drag & Drop e Input) - Utilizando funções utilitárias similares ao app.js
    setupImageUpload('bg-drop-zone', 'input-bg', 'bg-preview-container', 'bg-preview-img', 'bg-placeholder', 'btn-remove-bg', (base64) => {
        config.bgImage = base64;
        saveConfig();
    });

    setupImageUpload('logo-drop-zone', 'input-logo', 'logo-preview-container', 'logo-preview-img', 'logo-placeholder', 'btn-remove-logo', (base64) => {
        config.logo = base64;
        saveConfig();
    });
}

function renderCardsList() {
    const container = document.getElementById('cards-list');
    container.innerHTML = '';

    for (let i = 0; i < config.pairsCount; i++) {
        const item = document.createElement('div');
        item.className = 'card-config-item';
        
        const hasImg = !!config.cards[i];
        const imgSrc = hasImg ? config.cards[i] : '';

        item.innerHTML = `
            <div class="card-number">${i + 1}</div>
            <div class="card-upload-area">
                <div class="card-preview">
                    ${hasImg ? `<img src="${imgSrc}" alt="Carta ${i + 1}">` : `<div class="card-preview-placeholder">🖼️</div>`}
                </div>
                <div>
                    <label class="card-upload-btn" for="input-card-${i}">Carregar Foto</label>
                    <input type="file" id="input-card-${i}" accept="image/png,image/jpeg" style="display:none">
                    ${hasImg ? `<button type="button" class="btn btn-secondary btn-remove-card" data-idx="${i}" style="margin-left: 10px; padding: 6px 12px; font-size: 0.8rem;">Remover</button>` : ''}
                </div>
            </div>
        `;
        container.appendChild(item);

        // Upload da carta
        const fileInput = item.querySelector(`#input-card-${i}`);
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                processFile(file, (base64) => {
                    config.cards[i] = base64;
                    saveConfig();
                    renderCardsList();
                });
            }
        });

        // Remover carta
        const removeBtn = item.querySelector('.btn-remove-card');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                config.cards[i] = null;
                saveConfig();
                renderCardsList();
            });
        }
    }
}

// ── Utilitários de Upload e Redimensionamento ──

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
        callback(canvas.toDataURL('image/jpeg', 0.85)); // Usar jpeg compressão para economizar localStorage
    };
    img.src = dataUrl;
}
