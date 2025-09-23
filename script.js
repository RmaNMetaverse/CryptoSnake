const board = document.getElementById('game-board');
const ctx = board.getContext('2d');
const scoreEl = document.getElementById('score');
const tpsEl = document.getElementById('tps');
const speedEl = document.getElementById('speed');
const gameOverModal = document.getElementById('game-over-modal');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// Donate Modal Elements
const donateBtn = document.getElementById('donate-btn');
const donateModal = document.getElementById('donate-modal');
const closeDonateModalBtn = document.getElementById('close-donate-modal');
const addressList = document.getElementById('address-list');

// QR Code Modal Elements
const qrcodeModal = document.getElementById('qrcode-modal');
const closeQrcodeModalBtn = document.getElementById('close-qrcode-modal');
const qrcodeCanvas = document.getElementById('qrcode-canvas');
const qrcodeCryptoName = document.getElementById('qrcode-crypto-name');
const qrcodeAddressText = document.getElementById('qrcode-address-text');

// Game settings
const tileSize = 20;
const boardSize = board.width / tileSize;
const baseSpeed = 1.3; // Base ticks per second

// Game state
let snake, food, direction, score, gameOver, gameLoopTimeout, changingDirection;

// Crypto state
const donationAddresses = [
    { name: 'Bitcoin (BTC)', address: 'bc1qh00necgrdynp09qvp4zh53eatrtvzxv0zmvutc' },
    { name: 'USDT (TRC-20)', address: 'TTC1H8gomqsozKdka1AeKEpeZYQntaSQZ5' },
    { name: 'BCH (Bitcoin Cash)', address: 'qppdwk3healmqlhdsahp0mz3xmlc990yk585uncym3' },
    { name: 'TON', address: 'UQBALuXahFuK9s6eqBH0p4YJR7SPEyy0oOnEpXPSGGJL556s' },
    { name: 'TRX (Tron)', address: 'TTC1H8gomqsozKdka1AeKEpeZYQntaSQZ5' }
];
let tps = 0;
let speedMultiplier = 1;
let transactionCount = 0;
let ws;

// --- WebSocket Connection ---
function connectToBlockchain() {
    ws = new WebSocket('wss://ws.blockchain.info/inv');

    ws.onopen = () => {
        console.log('Connected to Blockchain WebSocket');
        statusIndicator.className = 'connected';
        statusText.textContent = 'Live on Bitcoin Network';
        ws.send(JSON.stringify({ "op": "unconfirmed_sub" }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.op === 'utx') { // Unconfirmed transaction
            transactionCount++;
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        statusIndicator.className = 'disconnected';
        statusText.textContent = 'Connection Lost. Retrying...';
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected. Attempting to reconnect...');
        statusIndicator.className = 'disconnected';
        statusText.textContent = 'Connection Lost. Retrying...';
        setTimeout(connectToBlockchain, 3000); // Retry connection after 3 seconds
    };
}

// --- TPS Calculation ---
setInterval(() => {
    tps = transactionCount;
    transactionCount = 0;
    speedMultiplier = tps > 0 ? tps : 1; // Ensure multiplier is at least 1

    // Update UI
    tpsEl.textContent = tps;
    speedEl.textContent = `x${speedMultiplier}`;

    // Adjust game loop speed dynamically
    if (!gameOver) {
        clearTimeout(gameLoopTimeout);
        scheduleNextTick();
    }
}, 1000);

// --- Game Logic ---
function init() {
    snake = [{ x: 10, y: 10 }];
    direction = { x: 0, y: 0 };
    score = 0;
    gameOver = false;
    changingDirection = false;
    scoreEl.textContent = 0;
    gameOverModal.style.display = 'none';
    generateFood();
    clearTimeout(gameLoopTimeout);
    gameLoop();
}

function gameLoop() {
    if (gameOver) return;
    changingDirection = false;
    update();
    draw();
    scheduleNextTick();
}

function scheduleNextTick() {
    const currentSpeed = baseSpeed * speedMultiplier;
    const tickInterval = 1000 / currentSpeed;
    gameLoopTimeout = setTimeout(gameLoop, tickInterval);
}

function update() {
    if (direction.x === 0 && direction.y === 0) return;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    snake.unshift(head);
    if (head.x < 0 || head.x >= boardSize || head.y < 0 || head.y >= boardSize || checkSnakeCollision()) {
        endGame();
        return;
    }
    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        generateFood();
    } else {
        snake.pop();
    }
}

function checkSnakeCollision() {
    const head = snake[0];
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) return true;
    }
    return false;
}

function generateFood() {
    do {
        food = {
            x: Math.floor(Math.random() * boardSize),
            y: Math.floor(Math.random() * boardSize)
        };
    } while (isPositionOnSnake(food));
}

function isPositionOnSnake(position) {
    return snake.some(segment => segment.x === position.x && segment.y === position.y);
}

function endGame() {
    gameOver = true;
    clearTimeout(gameLoopTimeout);
    finalScoreEl.textContent = `Final Score: ${score}`;
    gameOverModal.style.display = 'flex';
}

// --- Drawing ---
function draw() {
    ctx.fillStyle = '#010409';
    ctx.fillRect(0, 0, board.width, board.height);
    ctx.fillStyle = '#238636';
    snake.forEach(segment => ctx.fillRect(segment.x * tileSize, segment.y * tileSize, tileSize - 1, tileSize - 1));
    ctx.fillStyle = '#30a14e';
    ctx.fillRect(snake[0].x * tileSize, snake[0].y * tileSize, tileSize - 1, tileSize - 1);
    drawBitcoin(food.x * tileSize, food.y * tileSize);
}

function drawBitcoin(x, y) {
    ctx.save();
    ctx.fillStyle = '#f0b90b';
    ctx.font = `${tileSize * 0.9}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₿', x + tileSize / 2, y + tileSize / 2 + 1);
    ctx.restore();
}

// --- Donation Modal Logic ---
function populateDonationAddresses() {
    addressList.innerHTML = '';
    donationAddresses.forEach(crypto => {
        const entry = document.createElement('div');
        entry.className = 'crypto-entry';
        entry.innerHTML = `
            <div class="crypto-info">
                <span class="crypto-name">${crypto.name}</span>
                <span class="crypto-address">${crypto.address}</span>
            </div>
            <div class="crypto-actions">
                <button class="copy-btn" data-address="${crypto.address}">Copy</button>
                <button class="qrcode-btn" data-name="${crypto.name}" data-address="${crypto.address}">QR Code</button>
            </div>`;
        addressList.appendChild(entry);
    });
}

function showQrCode(name, address) {
    qrcodeCryptoName.textContent = name;
    qrcodeAddressText.textContent = address;
    QRCode.toCanvas(qrcodeCanvas, address, { width: 220, margin: 1 }, (error) => {
        if (error) console.error(error);
    });
    qrcodeModal.style.display = 'flex';
}

// --- Input Handling & Event Listeners ---
document.addEventListener('keydown', e => {
    if (changingDirection) return;
    const key = e.key;
    const isArrowKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
    if (!isArrowKey) return;
    changingDirection = true;
    switch (key) {
        case 'ArrowUp': if (direction.y === 0) direction = { x: 0, y: -1 }; break;
        case 'ArrowDown': if (direction.y === 0) direction = { x: 0, y: 1 }; break;
        case 'ArrowLeft': if (direction.x === 0) direction = { x: -1, y: 0 }; break;
        case 'ArrowRight': if (direction.x === 0) direction = { x: 1, y: 0 }; break;
    }
});

let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', e => {
    if (e.target === board) e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: false });

document.addEventListener('touchend', e => {
    if (e.target === board) e.preventDefault();
    if (changingDirection) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const swipeThreshold = 30;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > swipeThreshold && direction.x === 0) { direction = { x: 1, y: 0 }; changingDirection = true; }
        else if (deltaX < -swipeThreshold && direction.x === 0) { direction = { x: -1, y: 0 }; changingDirection = true; }
    } else {
        if (deltaY > swipeThreshold && direction.y === 0) { direction = { x: 0, y: 1 }; changingDirection = true; }
        else if (deltaY < -swipeThreshold && direction.y === 0) { direction = { x: 0, y: -1 }; changingDirection = true; }
    }
}, { passive: false });

restartBtn.addEventListener('click', init);
donateBtn.addEventListener('click', () => donateModal.style.display = 'flex');
closeDonateModalBtn.addEventListener('click', () => donateModal.style.display = 'none');
closeQrcodeModalBtn.addEventListener('click', () => qrcodeModal.style.display = 'none');

window.addEventListener('click', (event) => {
    if (event.target === donateModal) donateModal.style.display = 'none';
    if (event.target === qrcodeModal) qrcodeModal.style.display = 'none';
});

addressList.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('copy-btn')) {
        navigator.clipboard.writeText(target.dataset.address).then(() => {
            target.textContent = 'Copied!';
            setTimeout(() => { target.textContent = 'Copy'; }, 1500);
        });
    }
    if (target.classList.contains('qrcode-btn')) {
        showQrCode(target.dataset.name, target.dataset.address);
    }
});

// --- Start ---
connectToBlockchain();
init();
populateDonationAddresses();

