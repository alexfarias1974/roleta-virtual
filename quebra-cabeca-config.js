/**
 * quebra-cabeca-config.js
 * Gerenciamento de configurações do Quebra-Cabeça (localStorage)
 */

const STORAGE_KEY = 'quebra_cabeca_config';

const DEFAULT_CONFIG = {
    imageSrc: 'logo-game-center.jpg',
    isCustomImage: false,
    difficulty: 'easy', // 'easy' (3x3), 'medium' (4x4), 'hard' (5x5)
    allowPeek: true,
    showNumbers: false
};

let currentConfig = { ...DEFAULT_CONFIG };

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    setupEventListeners();
});

function loadConfig() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        } catch (e) {
            console.error('Erro ao ler config do quebra-cabeça:', e);
            currentConfig = { ...DEFAULT_CONFIG };
        }
    }
    renderUI();
}

function renderUI() {
    // 1. Imagem e Preview
    const previewBox = document.getElementById('preview-box');
    const previewImg = document.getElementById('preview-img');
    const previewFilename = document.getElementById('preview-filename');

    if (currentConfig.imageSrc) {
        previewImg.src = currentConfig.imageSrc;
        previewFilename.textContent = currentConfig.isCustomImage ? 'Imagem Personalizada' : currentConfig.imageSrc;
        previewBox.classList.add('active');
    } else {
        previewBox.classList.remove('active');
    }

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        if (!currentConfig.isCustomImage && btn.dataset.src === currentConfig.imageSrc) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Dificuldade
    const radio = document.querySelector(`input[name="difficulty"][value="${currentConfig.difficulty}"]`);
    if (radio) radio.checked = true;

    // 3. Opções
    document.getElementById('opt-peek').checked = !!currentConfig.allowPeek;
    document.getElementById('opt-numbers').checked = !!currentConfig.showNumbers;
}

function setupEventListeners() {
    // Upload de arquivo
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files[0]) {
            handleFileUpload(dt.files[0]);
        }
    });

    // Remover imagem
    document.getElementById('btn-remove-img').addEventListener('click', () => {
        currentConfig.imageSrc = 'logo-game-center.jpg';
        currentConfig.isCustomImage = false;
        fileInput.value = '';
        renderUI();
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentConfig.imageSrc = btn.dataset.src;
            currentConfig.isCustomImage = false;
            fileInput.value = '';
            renderUI();
        });
    });

    // Dificuldade
    document.querySelectorAll('input[name="difficulty"]').forEach(input => {
        input.addEventListener('change', (e) => {
            currentConfig.difficulty = e.target.value;
        });
    });

    // Opções
    document.getElementById('opt-peek').addEventListener('change', (e) => {
        currentConfig.allowPeek = e.target.checked;
    });

    document.getElementById('opt-numbers').addEventListener('change', (e) => {
        currentConfig.showNumbers = e.target.checked;
    });

    // Salvar e Iniciar
    document.getElementById('btn-save-launch').addEventListener('click', () => {
        saveAndLaunch();
    });
}

function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido (JPG ou PNG).');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Redimensionar para manter boa qualidade e caber no localStorage (< 1MB)
            const canvas = document.createElement('canvas');
            let maxDim = 1080;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
            currentConfig.imageSrc = compressedBase64;
            currentConfig.isCustomImage = true;
            renderUI();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function saveAndLaunch() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
        window.location.href = 'quebra-cabeca.html';
    } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
        alert('A imagem é muito grande para o armazenamento local. Tente uma imagem mais leve.');
    }
}
