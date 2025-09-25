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
const restartBtn = document.getElementById('restart-btn'); // Restart button

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



// --- Constants ---

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
const baseSpeed = 1.6; // Base ticks per second, increased from 1.3

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
    
    // Cap the effective TPS to a realistic maximum of 7
    const effectiveTps = Math.min(tps, 7);
    
    // The speed multiplier is now based on the capped TPS, ensuring it also has a max of 7.
    // We use Math.max(1, ...) to ensure the speed never drops below the base speed.
    speedMultiplier = Math.max(1, effectiveTps);
    
    // Update the UI with the capped (more realistic) values
    tpsEl.textContent = effectiveTps;
    speedMultiplierEl.textContent = `x${speedMultiplier.toFixed(2)}`;
}, 1000);

// --- Telegram WebApp Integration ---
let Telegram;

// Initialize Telegram WebApp
if (typeof window.Telegram !== 'undefined') {
    Telegram = window.Telegram.WebApp;
    Telegram.ready();
    Telegram.expand();
    
    // Set theme colors based on Telegram's theme
    if (Telegram.colorScheme === 'dark') {
        document.body.classList.add('telegram-dark');
    } else {
        document.body.classList.add('telegram-light');
    }
    
    console.log('Telegram WebApp initialized');
} else {
    console.log('Running outside Telegram - using default theme');
}

// --- Init and Game Loop ---
document.addEventListener('DOMContentLoaded', () => {
    init();
    // Ensure the canvas can receive keyboard focus in Telegram Desktop
    try {
        board.tabIndex = 0;
        board.focus();
    } catch (_) {}
    // Focus the board on any pointer interaction to keep key events flowing
    const focusBoard = () => { try { board.focus(); } catch (_) {} };
    board.addEventListener('pointerdown', focusBoard);
    board.addEventListener('click', focusBoard);
    document.body.addEventListener('click', focusBoard, { once: true });
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
    restartBtn.focus();
}

// --- Input Handling ---
document.addEventListener('keydown', e => {
    // This flag prevents the player from changing direction multiple times
    // between game ticks, which can cause the snake to reverse on itself.
    if (changingDirection) return;

    const key = e.key.toLowerCase();
    const isWASD = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key);

    if (!isWASD) return;
    e.preventDefault();
    changingDirection = true;

    switch (key) {
        case 'w':
        case 'arrowup':
            if (direction.y === 0) direction = { x: 0, y: -1 };
            break;
        case 's':
        case 'arrowdown':
            if (direction.y === 0) direction = { x: 0, y: 1 };
            break;
        case 'a':
        case 'arrowleft':
            if (direction.x === 0) direction = { x: -1, y: 0 };
            break;
        case 'd':
        case 'arrowright':
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

// Event listener for the new restart button
restartBtn.addEventListener('click', init);

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
    try {
        // Clear any existing content
        qrcodeCanvas.innerHTML = '';
        
        // Check if qrcode function is available
        if (typeof qrcode === 'undefined') {
            console.error('QR code library not loaded');
            qrcodeCanvas.innerHTML = '<p style="color: #e55353;">QR code library not loaded</p>';
            qrcodeCryptoName.textContent = name;
            qrcodeAddressText.textContent = address;
            qrcodeModal.style.display = 'flex';
            return;
        }
        
        // Generate QR code using the qrcode-generator library
        const qr = qrcode(0, 'M'); // Error correction level M (Medium)
        qr.addData(address);
        qr.make();
        
        // Create an image element with the QR code
        const qrImg = qr.createImgTag(4, 10); // Size 4, margin 10
        qrcodeCanvas.innerHTML = qrImg;
        
        qrcodeCryptoName.textContent = name;
        qrcodeAddressText.textContent = address;
        qrcodeModal.style.display = 'flex';
        
        console.log('QR code generated successfully for:', name);
    } catch (error) {
        console.error('QR Code generation error:', error);
        qrcodeCanvas.innerHTML = '<p style="color: #e55353;">Failed to generate QR code: ' + error.message + '</p>';
        qrcodeCryptoName.textContent = name;
        qrcodeAddressText.textContent = address;
        qrcodeModal.style.display = 'flex';
    }
}