// --- DOM Elements ---
const board = document.getElementById('game-board');
const ctx = board.getContext('2d');
const scoreEl = document.getElementById('score');
const tpsEl = document.getElementById('tps');
const speedMultiplierEl = document.getElementById('speed-multiplier');
const connectionStatusEl = document.getElementById('connection-status');
const statusTextEl = document.getElementById('status-text');

// Game Over Modal Elements
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreEl = document.getElementById('final-score');
const playerNameInput = document.getElementById('player-name');
const submitScoreBtn = document.getElementById('submit-score-btn');

// Donate Modal Elements
const donateBtn = document.getElementById('donate-btn');
const donateModal = document.getElementById('donate-modal');
const closeDonateModal = document.getElementById('close-donate-modal');
const addressList = document.getElementById('address-list');

// QR Code Modal Elements
const qrcodeModal = document.getElementById('qrcode-modal');
const closeQrcodeModal = document.getElementById('close-qrcode-modal');
const qrcodeCanvas = document.getElementById('qrcode-canvas');
const qrcodeCryptoName = document.getElementById('qrcode-crypto-name');
const qrcodeAddressText = document.getElementById('qrcode-address-text');

// Leaderboard Modal Elements
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardModal = document.getElementById('close-leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');

// Visitor Counter Element
const playerCountEl = document.getElementById('player-count');


// --- Constants ---
const LEADERBOARD_KEY = 'cryptoSnakeLeaderboard';

// --- Donation Addresses ---
const cryptoWallets = {
    'Bitcoin (BTC)': 'bc1qh00necgrdynp09qvp4zh53eatrtvzxv0zmvutc',
    'USDT (TRC-20)': 'TTC1H8gomqsozKdka1AeKEpeZYQntaSQZ5',
    'Bitcoin Cash (BCH)': 'qppdwk3healmqlhdsahp0mz3xmlc990yk585uncym3',
    'TON': 'UQBALuXahFuK9s6eqBH0p4YJR7SPEyy0oOnEpXPSGGJL556s',
    'Tron (TRX)': 'TTC1H8gomqsozKdka1AeKEpeZYQntaSQZ5'
};


// --- Game Settings ---
const tileSize = 20;
const boardSize = board.width / tileSize;
const baseSpeed = 1.3; // Base ticks per second

// --- Game State ---
let snake, food, direction, score, gameOver, gameLoopTimeout, changingDirection;

// --- Crypto State ---
let tps = 0;
let speedMultiplier = 1.0;
let transactionCount = 0;

// --- WebSocket for Blockchain Data ---
let ws;

function connectWebSocket() {
    ws = new WebSocket('wss://ws.blockchain.info/inv');

    ws.onopen = () => {
        ws.send(JSON.stringify({ "op": "unconfirmed_sub" }));
        connectionStatusEl.className = 'status-connected';
        statusTextEl.textContent = 'Live on Blockchain';
    };

    ws.onmessage = () => {
        transactionCount++;
    };

    ws.onclose = () => {
        connectionStatusEl.className = 'status-disconnected';
        statusTextEl.textContent = 'Disconnected. Retrying...';
        setTimeout(connectWebSocket, 5000); // Retry connection after 5 seconds
    };

    ws.onerror = () => {
        connectionStatusEl.className = 'status-disconnected';
        statusTextEl.textContent = 'Connection Error';
        ws.close();
    };
}

// Update TPS and Speed Multiplier every second
setInterval(() => {
    tps = transactionCount;
    transactionCount = 0;
    
    // Ensure speed multiplier is at least 1
    speedMultiplier = Math.max(1, tps / 2); // Divide by 2 to make it less extreme
    
    tpsEl.textContent = tps;
    speedMultiplierEl.textContent = `x${speedMultiplier.toFixed(2)}`;
}, 1000);

// --- Init and Game Loop ---
document.addEventListener('DOMContentLoaded', () => {
    init();
    updateVisitorCount();
});


// --- Game Logic ---
function init() {
    snake = [{ x: 10, y: 10 }];
    direction = { x: 0, y: 0 };
    score = 0;
    gameOver = false;
    changingDirection = false;
    scoreEl.textContent = 0;
    gameOverModal.style.display = 'none';
    leaderboardModal.style.display = 'none';
    donateModal.style.display = 'none';
    qrcodeModal.style.display = 'none';
    generateFood();
    clearTimeout(gameLoopTimeout);
    gameLoop();
    connectWebSocket();
    populateDonationAddresses();
}

function gameLoop() {
    if (gameOver) return;

    // A new tick has started, so we can accept the next direction change.
    changingDirection = false;

    update();
    draw();
    
    scheduleNextTick();
}

function scheduleNextTick() {
     // The speed is baseSpeed * multiplier. The timeout is the inverse.
    const currentSpeed = baseSpeed * speedMultiplier;
    const tickInterval = 1000 / currentSpeed;
    gameLoopTimeout = setTimeout(gameLoop, tickInterval);
}

function update() {
    // Don't move snake until player provides input
    if (direction.x === 0 && direction.y === 0) {
        return;
    }

    // Move snake
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    snake.unshift(head);

    // Check for game over conditions
    if (
        head.x < 0 || head.x >= boardSize ||
        head.y < 0 || head.y >= boardSize ||
        isCollidingWithTail(head)
    ) {
        onGameOver();
        return;
    }

    // Check for food
    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        generateFood();
    } else {
        snake.pop(); // Only pop if we didn't eat
    }
}

function draw() {
    // Clear board
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, board.width, board.height);

    // Draw snake
    ctx.fillStyle = '#57ab5a';
    snake.forEach(segment => {
        ctx.fillRect(segment.x * tileSize, segment.y * tileSize, tileSize, tileSize);
    });

    // Draw food
    ctx.font = `${tileSize}px sans-serif`;
    ctx.fillText('₿', food.x * tileSize, food.y * tileSize + tileSize - 2);
}

function generateFood() {
    let foodPosition;
    do {
        foodPosition = {
            x: Math.floor(Math.random() * boardSize),
            y: Math.floor(Math.random() * boardSize)
        };
    } while (isCollidingWithSnake(foodPosition));
    food = foodPosition;
}

function isCollidingWithSnake(position) {
    return snake.some(segment => segment.x === position.x && segment.y === position.y);
}

function isCollidingWithTail(head) {
    return snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y);
}

function onGameOver() {
    gameOver = true;
    clearTimeout(gameLoopTimeout);
    if(ws) ws.close(); // Close WebSocket connection
    finalScoreEl.textContent = `Score: ${score}`;
    gameOverModal.style.display = 'flex';
    playerNameInput.focus();
}

// --- Input Handling ---
document.addEventListener('keydown', e => {
    // This flag prevents the player from changing direction multiple times
    // between game ticks, which can cause the snake to reverse on itself.
    if (changingDirection) return;

    const key = e.key;
    const isArrowKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);

    if (!isArrowKey) return;
    
    changingDirection = true;

    switch (key) {
        case 'ArrowUp':
            if (direction.y === 0) direction = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (direction.y === 0) direction = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (direction.x === 0) direction = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (direction.x === 0) direction = { x: 1, y: 0 };
            break;
    }
});

// Touch controls
let touchStartX = 0;
let touchStartY = 0;

board.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartX = e.touches[0].screenX;
    touchStartY = e.touches[0].screenY;
}, { passive: false });

board.addEventListener('touchend', e => {
    e.preventDefault();
    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;

    handleSwipe(touchStartX, touchStartY, endX, endY);
}, { passive: false });

function handleSwipe(startX, startY, endX, endY) {
    if (changingDirection) return;
    
    const diffX = endX - startX;
    const diffY = endY - startY;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    if (absDiffX > 20 || absDiffY > 20) { // Threshold to count as a swipe
        changingDirection = true;
        if (absDiffX > absDiffY) {
            // Horizontal swipe
            if (diffX > 0 && direction.x === 0) { // Right
                direction = { x: 1, y: 0 };
            } else if (diffX < 0 && direction.x === 0) { // Left
                direction = { x: -1, y: 0 };
            }
        } else {
            // Vertical swipe
            if (diffY > 0 && direction.y === 0) { // Down
                direction = { x: 0, y: 1 };
            } else if (diffY < 0 && direction.y === 0) { // Up
                direction = { x: 0, y: -1 };
            }
        }
    }
}

// --- UI / Modal Logic ---

function updateVisitorCount() {
    const namespace = 'cryptosnake-github-page'; // Unique ID for your counter
    const key = 'player-visits';
    const apiUrl = `https://api.countapi.xyz/hit/${namespace}/${key}`;

    fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
            if (playerCountEl) {
                playerCountEl.textContent = data.value.toLocaleString();
            }
        })
        .catch(error => {
            console.error("Could not fetch player count:", error);
            if (playerCountEl) {
                playerCountEl.textContent = 'N/A';
            }
        });
}


// Leaderboard
leaderboardBtn.addEventListener('click', showLeaderboard);
closeLeaderboardModal.addEventListener('click', () => leaderboardModal.style.display = 'none');
submitScoreBtn.addEventListener('click', saveScore);

function showLeaderboard() {
    const scores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
    
    // Sort scores descending
    scores.sort((a, b) => b.score - a.score);

    leaderboardList.innerHTML = ''; // Clear previous list

    if (scores.length === 0) {
        leaderboardList.innerHTML = '<li>No scores yet. Be the first!</li>';
    } else {
        scores.slice(0, 10).forEach(score => { // Show top 10
            const li = document.createElement('li');
            const date = new Date(score.timestamp).toLocaleDateString();
            li.innerHTML = `
                <div>
                    <span class="score-name">${score.name}</span>
                    <span class="score-date">${date}</span>
                </div>
                <span class="score-points">${score.score} pts</span>
            `;
            leaderboardList.appendChild(li);
        });
    }

    leaderboardModal.style.display = 'flex';
}

function saveScore() {
    const playerName = playerNameInput.value.trim() || 'Anonymous';
    const scores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];

    const newScore = {
        name: playerName,
        score: score,
        timestamp: new Date().toISOString()
    };

    scores.push(newScore);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
    
    // Clear input for next time and restart game
    playerNameInput.value = '';
    init();
}


// Donations
donateBtn.addEventListener('click', () => donateModal.style.display = 'flex');
closeDonateModal.addEventListener('click', () => donateModal.style.display = 'none');
closeQrcodeModal.addEventListener('click', () => qrcodeModal.style.display = 'none');

function populateDonationAddresses() {
    addressList.innerHTML = ''; // Clear existing
    for (const [name, address] of Object.entries(cryptoWallets)) {
        const item = document.createElement('div');
        item.className = 'address-item';
        item.innerHTML = `
            <div class="address-info">
                <div class="crypto-name">${name}</div>
                <div class="crypto-address">${address}</div>
            </div>
            <div class="address-actions">
                <button title="Copy Address">📋</button>
                <button title="Show QR Code">📱</button>
            </div>
        `;
        const [copyBtn, qrBtn] = item.querySelectorAll('button');
        copyBtn.addEventListener('click', () => copyAddress(address, copyBtn));
        qrBtn.addEventListener('click', () => showQrCode(name, address));

        addressList.appendChild(item);
    }
}

function copyAddress(address, button) {
    navigator.clipboard.writeText(address).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 1500);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function showQrCode(name, address) {
    const qr = qrcode(0, 'L');
    qr.addData(address);
    qr.make();
    
    qrcodeCanvas.innerHTML = qr.createImgTag(5, 10);
    qrcodeCryptoName.textContent = name;
    qrcodeAddressText.textContent = address;
    qrcodeModal.style.display = 'flex';
}

