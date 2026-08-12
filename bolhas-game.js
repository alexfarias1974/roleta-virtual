/**
 * bolhas-game.js
 * Lógica principal do jogo Estoure as Bolhas.
 */

const STORAGE_KEY = 'bolhas_config';

let config = null;
let score = 0;
let poppedCount = 0;
let timeLeft = 30;
let gameInterval = null;
let spawnerInterval = null;
let isPlaying = false;

// Valores possíveis
const VALUES = [100, 200, 500, 1000, -100, -200, -500, -1000];

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    loadConfig();
    setupUI();
    
    document.getElementById('btn-start-game').addEventListener('click', startGame);
    document.getElementById('btn-play-again').addEventListener('click', () => {
        hideModal();
        startGame();
    });
    document.getElementById('btn-modal-close').addEventListener('click', hideModal);
}

function loadConfig() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        config = JSON.parse(raw);
    } else {
        config = { logo: null };
    }
}

function setupUI() {
    // Carregar a marca d'água
    if (config && config.logo) {
        const logoEl = document.getElementById('game-logo');
        logoEl.src = config.logo;
        logoEl.style.display = 'block';
    }
}

function startGame() {
    document.getElementById('start-overlay').classList.add('hidden');
    
    // Reset status
    score = 0;
    poppedCount = 0;
    timeLeft = 30;
    isPlaying = true;
    updateHUD();
    
    // Limpar bolhas que ficaram na tela
    document.getElementById('game-area').innerHTML = '';

    // Iniciar timers
    gameInterval = setInterval(gameTick, 1000);
    // Spawna uma bolha a cada 600ms
    spawnerInterval = setInterval(spawnBubble, 600);
}

function gameTick() {
    timeLeft--;
    updateHUD();

    if (timeLeft <= 0) {
        endGame();
    }
}

function spawnBubble() {
    if (!isPlaying) return;

    const gameArea = document.getElementById('game-area');
    
    // Escolher um valor aleatório
    const val = VALUES[Math.floor(Math.random() * VALUES.length)];
    const isNegative = val < 0;

    // Criar elemento bolha
    const bubble = document.createElement('div');
    bubble.className = `bubble ${isNegative ? 'bubble-neg' : 'bubble-pos'}`;
    bubble.textContent = isNegative ? val : `+${val}`;
    
    // Posição X aleatória (0 a 90vw para não sair da tela)
    const posX = Math.random() * 90;
    bubble.style.left = `${posX}vw`;
    
    // Variar o tamanho baseando no valor (módulo)
    const absVal = Math.abs(val);
    let size = 80;
    if (absVal === 100) size = 70;
    if (absVal === 200) size = 85;
    if (absVal === 500) size = 100;
    if (absVal === 1000) size = 120;
    
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.lineHeight = `${size}px`; // centralizar texto verticalmente
    bubble.style.fontSize = `${size * 0.3}px`;
    
    // Determinar velocidade
    // 1000 -> rápido (3s), 100 -> lento (6s)
    // Negativos -> lentos (5s a 7s) para servirem de armadilha
    let duration = 5;
    if (isNegative) {
        duration = 5 + Math.random() * 3; // 5s a 8s
    } else {
        if (absVal === 1000) duration = 2.5 + Math.random();
        else if (absVal === 500) duration = 3.5 + Math.random();
        else duration = 4.5 + Math.random();
    }
    
    // Delay de animação para balançar de forma aleatória
    const delay = Math.random() * -5;
    
    bubble.style.animation = `
        floatUp ${duration}s linear forwards,
        wobble 3s ease-in-out ${delay}s infinite alternate
    `;

    // Evento de clique
    bubble.addEventListener('mousedown', (e) => popBubble(e, bubble, val));
    bubble.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Evita duplo disparo em touch
        popBubble(e, bubble, val);
    });
    
    // Limpar após animação
    setTimeout(() => {
        if (bubble.parentNode) bubble.remove();
    }, duration * 1000);

    gameArea.appendChild(bubble);
}

function popBubble(e, bubbleEl, value) {
    if (!isPlaying) return;
    
    // Prevenir duplo clique rápido na mesma bolha
    if (bubbleEl.dataset.popped) return;
    bubbleEl.dataset.popped = "true";

    // Atualizar placar
    score += value;
    poppedCount++;
    
    // Efeito visual no HUD
    const scoreDisplay = document.getElementById('score-display');
    scoreDisplay.style.transform = 'scale(1.3)';
    setTimeout(() => scoreDisplay.style.transform = 'scale(1)', 150);

    updateHUD();

    // Trocar a classe para a animação de explosão (pop)
    bubbleEl.style.animation = 'none'; // Para a subida e o wobble
    
    // Mantém a posição exata de onde clicou
    const rect = bubbleEl.getBoundingClientRect();
    bubbleEl.style.left = `${rect.left}px`;
    bubbleEl.style.top = `${rect.top}px`;
    bubbleEl.style.bottom = 'auto'; // Remove o bottom do floatUp
    
    bubbleEl.classList.add('popped');
    bubbleEl.textContent = ''; // Limpa o número

    // Remove do DOM após o fim da animação de pop
    setTimeout(() => {
        if (bubbleEl.parentNode) bubbleEl.remove();
    }, 300);
}

function updateHUD() {
    const scoreEl = document.getElementById('score-display');
    scoreEl.textContent = score;
    
    if (score > 0) {
        scoreEl.className = 'hud-value score-positive';
    } else if (score < 0) {
        scoreEl.className = 'hud-value score-negative';
    } else {
        scoreEl.className = 'hud-value';
        scoreEl.style.color = '#fff';
    }

    document.getElementById('timer-display').textContent = timeLeft;
}

function endGame() {
    isPlaying = false;
    clearInterval(gameInterval);
    clearInterval(spawnerInterval);

    // Travar animações das bolhas restantes
    const remaining = document.querySelectorAll('.bubble');
    remaining.forEach(b => {
        if (!b.classList.contains('popped')) {
            b.style.opacity = '0';
            b.style.pointerEvents = 'none';
        }
    });

    setTimeout(showWinModal, 500);
}

function showWinModal() {
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-count').textContent = poppedCount;
    
    const title = document.getElementById('modal-title');
    if (score > 0) {
        title.textContent = 'Parabéns!';
        title.className = 'modal-title score-high';
        // Disparar confetes se positivo
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }
    } else {
        title.textContent = 'Fim do Tempo!';
        title.className = 'modal-title score-low';
    }

    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.remove('hidden');
    modalOverlay.setAttribute('aria-hidden', 'false');
}

function hideModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
    modalOverlay.setAttribute('aria-hidden', 'true');
}
