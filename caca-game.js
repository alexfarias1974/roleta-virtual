/**
 * caca-game.js — Versão 2 (layout premium)
 */

const STORAGE_KEY = 'caca_config';

let config = null;
let wordsToFind = [];
let wordsFound = 0;
let gridSize = 12;
let grid = [];
let cellElements = [];
let firstSelectedCell = null;

document.addEventListener('DOMContentLoaded', initGame);

function initGame() {
    loadConfig();
    setupUI();
    generateBoard();

    document.getElementById('btn-modal-close').addEventListener('click', hideModal);
    document.getElementById('btn-play-again').addEventListener('click', () => {
        hideModal();
        generateBoard();
    });
}

function loadConfig() {
    const raw = localStorage.getItem(STORAGE_KEY);
    config = raw ? JSON.parse(raw) : { difficulty: 'easy', words: ['TESTE', 'JOGO', 'Brasil'] };
}

function setupUI() {
    if (config.logo) {
        const logoEl = document.getElementById('game-logo');
        logoEl.src = config.logo;
        logoEl.style.display = 'block';
    }
}

function generateBoard() {
    wordsFound = 0;
    firstSelectedCell = null;
    wordsToFind = [...config.words];

    // Word list
    const listEl = document.getElementById('word-list');
    listEl.innerHTML = '';
    wordsToFind.forEach(w => {
        const li = document.createElement('li');
        li.className = 'word-chip';
        li.id = `word-${w}`;

        // Icon SVG (circle = unfound, check = found)
        li.innerHTML = `
            <svg class="chip-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9"/>
            </svg>
            <span class="word-text">${w}</span>
        `;
        listEl.appendChild(li);
    });

    document.getElementById('count-found').textContent = '0';
    document.getElementById('count-total').textContent = wordsToFind.length;

    // Grid size
    let maxLen = Math.max(...wordsToFind.map(w => w.length));
    gridSize = Math.max(12, maxLen + 2);

    // Calc cell size to fit in ~70vh
    const availableH = Math.floor(window.innerHeight * 0.88);
    const availableW = Math.floor(window.innerWidth * 0.62);
    const maxCellByH = Math.floor(availableH / gridSize);
    const maxCellByW = Math.floor(availableW / gridSize);
    const cellSize = Math.min(52, maxCellByH, maxCellByW);

    const gridEl = document.getElementById('word-grid');
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;

    grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
    cellElements = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    placeWords();

    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (!grid[r][c]) grid[r][c] = ALPHA[Math.floor(Math.random() * 26)];

            const cell = document.createElement('div');
            cell.className = 'caca-cell';
            cell.textContent = grid[r][c];
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.style.fontSize = `${Math.round(cellSize * 0.48)}px`;
            cell.addEventListener('click', () => handleCellClick(r, c, cell));

            gridEl.appendChild(cell);
            cellElements[r][c] = cell;
        }
    }
}

function placeWords() {
    const dirs = getDirs();
    wordsToFind.forEach(word => {
        let placed = false, attempts = 0;
        while (!placed && attempts < 300) {
            attempts++;
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            const r = Math.floor(Math.random() * gridSize);
            const c = Math.floor(Math.random() * gridSize);
            if (canPlace(word, r, c, d[0], d[1])) {
                for (let i = 0; i < word.length; i++)
                    grid[r + i * d[0]][c + i * d[1]] = word[i];
                placed = true;
            }
        }
    });
}

function getDirs() {
    if (config.difficulty === 'easy')   return [[0,1],[1,0]];
    if (config.difficulty === 'medium') return [[0,1],[1,0],[1,1],[-1,1]];
    return [[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];
}

function canPlace(word, r, c, dr, dc) {
    for (let i = 0; i < word.length; i++) {
        const nr = r + i * dr, nc = c + i * dc;
        if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) return false;
        if (grid[nr][nc] && grid[nr][nc] !== word[i]) return false;
    }
    return true;
}

function handleCellClick(r, c, cell) {
    if (cell.classList.contains('found-cell')) return;

    if (!firstSelectedCell) {
        firstSelectedCell = { r, c, el: cell };
        cell.classList.add('selected');
        return;
    }

    const { r: r1, c: c1, el } = firstSelectedCell;
    el.classList.remove('selected');
    firstSelectedCell = null;

    const dr = r - r1, dc = c - c1;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return;

    const steps = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
    const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
    const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

    let word = '';
    const cells = [];
    for (let i = 0; i < steps; i++) {
        word += grid[r1 + i * stepR][c1 + i * stepC];
        cells.push(cellElements[r1 + i * stepR][c1 + i * stepC]);
    }

    checkMatch(word, cells);
}

function checkMatch(word, cells) {
    const rev = word.split('').reverse().join('');
    const match = wordsToFind.find(w => w === word || w === rev);

    if (!match) return;

    const li = document.getElementById(`word-${match}`);
    if (!li || li.classList.contains('found')) return;

    // Mark cells
    cells.forEach(c => c.classList.add('found-cell'));

    // Mark word in list — swap icon to checkmark
    li.classList.add('found');
    const icon = li.querySelector('.chip-icon');
    if (icon) {
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`;
    }

    wordsFound++;
    document.getElementById('count-found').textContent = wordsFound;

    if (wordsFound === wordsToFind.length) setTimeout(showWinModal, 600);
}

function showWinModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-overlay').setAttribute('aria-hidden', 'false');
    if (typeof confetti === 'function') {
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ['#f5c842','#10b981','#fff'] });
    }
}

function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-overlay').setAttribute('aria-hidden', 'true');
}
