/**
 * quebra-cabeca-game.js
 * Lógica interativa do Quebra-Cabeça para Game Center
 */

const STORAGE_KEY = 'quebra_cabeca_config';

let config = {
    imageSrc: 'logo-game-center.jpg',
    difficulty: 'easy',
    allowPeek: true,
    showNumbers: false
};

let gridSize = 3;
let totalTiles = 9;
let boardSize = 640;
let currentTiles = []; // Array de objetos { correctIndex, tileId }
let selectedTilePos = null; // Índice no array currentTiles
let moves = 0;
let seconds = 0;
let timerInterval = null;
let isGameWon = false;
let draggedTilePos = null;

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initGame();
    setupModalsAndControls();
});

function loadConfig() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            config = { ...config, ...JSON.parse(raw) };
        } catch (e) {
            console.error('Erro ao carregar config:', e);
        }
    }

    if (config.difficulty === 'medium') {
        gridSize = 4;
    } else if (config.difficulty === 'hard') {
        gridSize = 5;
    } else {
        gridSize = 3;
    }
    totalTiles = gridSize * gridSize;
}

function setupModalsAndControls() {
    // Espiar Imagem
    const btnPeek = document.getElementById('btn-peek');
    const peekModal = document.getElementById('peek-modal');
    const peekImg = document.getElementById('peek-img');

    if (config.allowPeek) {
        btnPeek.style.display = 'inline-flex';
        peekImg.src = config.imageSrc;
        btnPeek.addEventListener('click', () => {
            peekModal.classList.add('active');
        });
        peekModal.addEventListener('click', () => {
            peekModal.classList.remove('active');
        });
    }

    // Embaralhar / Reiniciar
    document.getElementById('btn-shuffle').addEventListener('click', () => {
        resetGame();
    });

    // Jogar Novamente no Modal
    document.getElementById('btn-play-again').addEventListener('click', () => {
        document.getElementById('win-modal').classList.remove('active');
        resetGame();
    });
}

function initGame() {
    calcBoardSize();
    window.addEventListener('resize', () => {
        calcBoardSize();
        renderBoard();
    });

    resetGame();
}

function calcBoardSize() {
    // Adequar o tamanho da grade de acordo com a tela do totem
    const availableW = Math.min(window.innerWidth * 0.85, 720);
    const availableH = Math.min(window.innerHeight * 0.58, 720);
    boardSize = Math.floor(Math.min(availableW, availableH));
    if (boardSize < 300) boardSize = 300;
}

function resetGame() {
    isGameWon = false;
    moves = 0;
    seconds = 0;
    selectedTilePos = null;
    updateStats();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isGameWon) {
            seconds++;
            updateTimerDisplay();
        }
    }, 1000);

    // Inicializar peças
    currentTiles = [];
    for (let i = 0; i < totalTiles; i++) {
        currentTiles.push(i);
    }

    // Embaralhar até que não esteja resolvido
    shuffleTiles();

    renderBoard();
}

function shuffleTiles() {
    let attempts = 0;
    do {
        for (let i = currentTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentTiles[i], currentTiles[j]] = [currentTiles[j], currentTiles[i]];
        }
        attempts++;
    } while (countCorrectTiles() === totalTiles && attempts < 10);
}

function renderBoard() {
    const gridEl = document.getElementById('puzzle-grid');
    gridEl.innerHTML = '';
    gridEl.style.width = `${boardSize}px`;
    gridEl.style.height = `${boardSize}px`;
    gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

    const tileSize = boardSize / gridSize;

    currentTiles.forEach((correctIndex, pos) => {
        const tile = document.createElement('div');
        tile.className = 'puzzle-tile';
        tile.dataset.pos = pos;
        tile.dataset.correctIndex = correctIndex;

        // Calcular background position da fatia da imagem
        const row = Math.floor(correctIndex / gridSize);
        const col = correctIndex % gridSize;
        const bgPosX = -col * tileSize;
        const bgPosY = -row * tileSize;

        tile.style.backgroundImage = `url("${config.imageSrc}")`;
        tile.style.backgroundSize = `${boardSize}px ${boardSize}px`;
        tile.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;

        const isCorrect = correctIndex === pos;
        if (isCorrect) {
            tile.classList.add('correct');
            const check = document.createElement('div');
            check.className = 'correct-badge';
            check.textContent = '✓';
            tile.appendChild(check);
        }

        if (selectedTilePos === pos) {
            tile.classList.add('selected');
        }

        // Numeração de ajuda
        if (config.showNumbers) {
            const num = document.createElement('span');
            num.className = 'tile-number';
            num.textContent = correctIndex + 1;
            tile.appendChild(num);
        }

        // Click / Touch listener
        tile.addEventListener('click', () => handleTileClick(pos));

        // Drag & Drop
        tile.draggable = !isGameWon;
        tile.addEventListener('dragstart', (e) => {
            draggedTilePos = pos;
            e.dataTransfer.setData('text/plain', pos);
        });

        tile.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        tile.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromPos = draggedTilePos !== null ? draggedTilePos : parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(fromPos) && fromPos !== pos) {
                swapTiles(fromPos, pos);
            }
            draggedTilePos = null;
        });

        gridEl.appendChild(tile);
    });

    updateProgress();
}

function handleTileClick(pos) {
    if (isGameWon) return;

    if (selectedTilePos === null) {
        // Primeira peça selecionada
        selectedTilePos = pos;
        renderBoard();
    } else if (selectedTilePos === pos) {
        // Deselecionar
        selectedTilePos = null;
        renderBoard();
    } else {
        // Trocar posições
        const fromPos = selectedTilePos;
        selectedTilePos = null;
        swapTiles(fromPos, pos);
    }
}

function swapTiles(posA, posB) {
    [currentTiles[posA], currentTiles[posB]] = [currentTiles[posB], currentTiles[posA]];
    moves++;
    updateStats();
    renderBoard();

    // Checar vitória
    if (countCorrectTiles() === totalTiles) {
        setTimeout(handleVictory, 300);
    }
}

function countCorrectTiles() {
    let count = 0;
    currentTiles.forEach((correctIndex, pos) => {
        if (correctIndex === pos) count++;
    });
    return count;
}

function updateProgress() {
    const correct = countCorrectTiles();
    const percent = Math.round((correct / totalTiles) * 100);

    document.getElementById('stat-matches').textContent = `${correct} / ${totalTiles}`;
    document.getElementById('progress-text').textContent = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

function updateStats() {
    document.getElementById('stat-moves').textContent = moves;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('stat-time').textContent = `${m}:${s}`;
}

function handleVictory() {
    isGameWon = true;
    clearInterval(timerInterval);

    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const timeFormatted = `${m}:${s}`;

    document.getElementById('win-time').textContent = timeFormatted;
    document.getElementById('win-moves').textContent = moves;
    document.getElementById('win-modal').classList.add('active');

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 220,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#00f2fe', '#4facfe', '#a855f7', '#10b981', '#ffffff']
        });
    }
}
