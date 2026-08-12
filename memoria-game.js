/**
 * memoria-game.js
 * Lógica principal do Jogo da Memória.
 */

const STORAGE_KEY = 'memoria_config';

let config = null;
let cards = [];
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matches = 0;
let attempts = 0;

document.addEventListener('DOMContentLoaded', initGame);

function initGame() {
    loadConfig();
    setupUI();
    generateDeck();
    renderBoard();
    
    // Modal events
    document.getElementById('btn-modal-close').addEventListener('click', hideModal);
    document.getElementById('btn-play-again').addEventListener('click', () => {
        hideModal();
        resetGame();
    });
}

function loadConfig() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        config = JSON.parse(raw);
    } else {
        // Fallback básico
        config = {
            pairsCount: 2,
            bgColor: '#000000',
            cards: []
        };
    }
}

function setupUI() {
    // Background
    if (config.bgColor) {
        document.body.style.setProperty('--bg-color', config.bgColor);
    }
    if (config.bgImage) {
        document.body.style.setProperty('--bg-image', `url(${config.bgImage})`);
    }

    // Logo
    if (config.logo) {
        const logoEl = document.getElementById('game-logo');
        logoEl.src = config.logo;
        logoEl.style.display = 'block';
    }

    document.getElementById('total-pairs').textContent = config.pairsCount;
    updateStats();
}

function generateDeck() {
    cards = [];
    // O usuário configurou N pares. Cada par tem uma imagem.
    // Precisamos criar 2 cartas para cada imagem enviada.
    
    // Se o usuário não enviou imagens suficientes, usaremos imagens genéricas ou cores
    for (let i = 0; i < config.pairsCount; i++) {
        const imgSrc = config.cards[i] || `https://picsum.photos/seed/${i+1}/200/200`;
        
        // Criar par
        const card1 = { id: `card_${i}_a`, matchId: i, image: imgSrc };
        const card2 = { id: `card_${i}_b`, matchId: i, image: imgSrc };
        
        cards.push(card1, card2);
    }

    // Embaralhar (Fisher-Yates)
    shuffle(cards);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function renderBoard() {
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';

    // Configurar colunas do grid dinamicamente
    const totalCards = cards.length;
    let columns = 4;
    if (totalCards <= 8) columns = 4;
    else if (totalCards <= 12) columns = 4;
    else if (totalCards <= 16) columns = 4;
    else columns = 5;

    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'memory-card';
        cardEl.dataset.matchId = card.matchId;
        
        cardEl.innerHTML = `
            <div class="memory-card-face memory-card-front">
                <img src="${card.image}" alt="Carta" draggable="false">
            </div>
            <div class="memory-card-face memory-card-back">
                ?
            </div>
        `;
        
        cardEl.addEventListener('click', flipCard);
        grid.appendChild(cardEl);
    });
}

function flipCard() {
    if (lockBoard) return;
    if (this === firstCard) return;

    this.classList.add('flip');

    if (!firstCard) {
        // Primeira carta
        firstCard = this;
        return;
    }

    // Segunda carta
    secondCard = this;
    attempts++;
    updateStats();
    
    checkForMatch();
}

function checkForMatch() {
    const isMatch = firstCard.dataset.matchId === secondCard.dataset.matchId;

    if (isMatch) {
        disableCards();
    } else {
        unflipCards();
    }
}

function disableCards() {
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);
    
    // Efeito visual de carta acertada
    setTimeout(() => {
        firstCard.classList.add('matched');
        secondCard.classList.add('matched');
        
        matches++;
        updateStats();
        resetBoard();
        
        checkWinCondition();
    }, 400);
}

function unflipCards() {
    lockBoard = true;

    setTimeout(() => {
        firstCard.classList.remove('flip');
        secondCard.classList.remove('flip');
        resetBoard();
    }, 1000);
}

function resetBoard() {
    [firstCard, secondCard, lockBoard] = [null, null, false];
}

function updateStats() {
    document.getElementById('attempts-count').textContent = attempts;
    document.getElementById('matches-count').textContent = matches;
}

function checkWinCondition() {
    if (matches === config.pairsCount) {
        setTimeout(showWinModal, 500);
    }
}

function showWinModal() {
    document.getElementById('final-attempts').textContent = attempts;
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.remove('hidden');
    modalOverlay.setAttribute('aria-hidden', 'false');
    
    // Disparar confetes se disponível
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#a855f7', '#ec4899', '#fbbf24', '#22c55e']
        });
    }
}

function hideModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
    modalOverlay.setAttribute('aria-hidden', 'true');
}

function resetGame() {
    matches = 0;
    attempts = 0;
    updateStats();
    generateDeck();
    renderBoard();
}
