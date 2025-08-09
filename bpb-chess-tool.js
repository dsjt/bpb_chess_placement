// 駒の定義
const pieceSymbols = {
    'white-pawn': '♙', 'white-knight': '♘', 'white-bishop': '♗',
    'white-rook': '♖', 'white-queen': '♕', 'white-king': '♔',
    'black-pawn': '♟', 'black-knight': '♞', 'black-bishop': '♝',
    'black-rook': '♜', 'black-queen': '♛', 'black-king': '♚'
};

const pieceNames = {
    'white-pawn': '白ポーン', 'white-knight': '白ナイト', 'white-bishop': '白ビショップ',
    'white-rook': '白ルーク', 'white-queen': '白クイーン', 'white-king': '白キング',
    'black-pawn': '黒ポーン', 'black-knight': '黒ナイト', 'black-bishop': '黒ビショップ',
    'black-rook': '黒ルーク', 'black-queen': '黒クイーン', 'black-king': '黒キング'
};

let pieceIdCounter = 0;

class ChessPiece {
    constructor(type, color, id = null) {
        this.type = type;           // 'pawn', 'knight', etc.
        this.color = color;         // 'white', 'black'
        this.id = id || ++pieceIdCounter;
        this.direction = 0;         // ポーンの向き（0-3）
    }

    // 文字列表現（既存コードとの互換性）
    toString() {
        return `${this.color}-${this.type}`;
    }

    // 記号取得
    getSymbol() {
        return pieceSymbols[this.toString()];
    }
}

// ボード状態
let board = Array(7).fill().map(() => Array(9).fill(null));
let blockedCells = new Set(); // "row,col" 形式で進行不可能セルを管理
let draggedPiece = null;
let draggedFromBoard = false;
let draggedFromCell = null;
// ストレージボード（2行×9列）
let storageBoard = Array(2).fill().map(() => Array(9).fill(null));

// ボード初期化
function initializeBoard() {
    const boardElement = document.getElementById('chessBoard');
    boardElement.innerHTML = '';

    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = `board-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            // 座標表示
            const coords = document.createElement('span');
            coords.className = 'coordinates';
            coords.textContent = `${row},${col}`;
            cell.appendChild(coords);

            // ドロップイベント
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragleave', handleDragLeave);

            // 右クリックイベント（ポーンの回転用）
            cell.addEventListener('contextmenu', handleRightClick);

            // 中クリックイベント（進行不可能設定用）
            cell.addEventListener('mousedown', handleMouseDown);

            boardElement.appendChild(cell);
        }
    }

}

function initializeStorage() {
    const storageArea = document.getElementById('storageArea');

    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = 'storage-cell';
            cell.dataset.storageRow = row;
            cell.dataset.storageCol = col;

            // ドロップイベント追加
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleStorageDrop);
            cell.addEventListener('dragleave', handleDragLeave);

            storageArea.appendChild(cell);
        }
    }
}

// パレットの駒にドラッグイベントを追加
function initializePalette() {
    document.querySelectorAll('.piece-item').forEach(item => {
        item.addEventListener('dragstart', handlePaletteDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function initializePlacementControls() {
    document.getElementById('suggestBtn').addEventListener('click', suggestPlacement);
    // document.getElementById('optimizeBtn').addEventListener('click', optimizePlacement);
}

// パレットからのドラッグ開始
function handlePaletteDragStart(e) {
    const [color, type] = e.target.dataset.piece.split("-")
    draggedPiece = new ChessPiece(type, color);
    draggedFromBoard = false;

    const draggingElement = document.getElementById('draggingPiece');
    draggingElement.textContent = pieceSymbols[draggedPiece.toString()];
    draggingElement.className = `dragging-piece ${draggedPiece.color === 'white' ? 'white-piece' : 'black-piece'}`;

    e.dataTransfer.effectAllowed = 'copy';

    // マウス追従
    document.addEventListener('mousemove', followMouse);
}


// ボード上の駒のドラッグ開始
function handleBoardDragStart(e) {
    const cell = e.target.closest('.board-cell');
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    draggedPiece = board[row][col];
    draggedFromBoard = true;
    draggedFromCell = { row, col };

    const draggingElement = document.getElementById('draggingPiece');
    draggingElement.textContent = pieceSymbols[draggedPiece];
    draggingElement.className = `dragging-piece ${getColor(draggedPiece) === 'white' ? 'white-piece' : 'black-piece'}`;

    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    document.addEventListener('mousemove', followMouse);
}

let draggedFromStorage = false;
let draggedFromStorageCell = null;

// ストレージからのドラッグ開始
function handleStorageDragStart(e) {
    const cell = e.target.closest('.storage-cell');
    const row = parseInt(cell.dataset.storageRow);
    const col = parseInt(cell.dataset.storageCol);

    draggedPiece = storageBoard[row][col];
    draggedFromStorage = true;
    draggedFromStorageCell = { row, col };
    draggedFromBoard = false;

    const draggingElement = document.getElementById('draggingPiece');
    draggingElement.textContent = draggedPiece.getSymbol();
    draggingElement.className = `dragging-piece ${draggedPiece.color === 'white' ? 'white-piece' : 'black-piece'}`;

    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    document.addEventListener('mousemove', followMouse);
}


// マウス追従
function followMouse(e) {
    const draggingElement = document.getElementById('draggingPiece');
    draggingElement.style.display = 'block';
    draggingElement.style.left = e.clientX + 'px';
    draggingElement.style.top = e.clientY + 'px';
}

// ドラッグオーバー
function handleDragOver(e) {
    e.preventDefault();
    const cell = e.target.closest('.board-cell') || e.target.closest('.storage-cell');
    if (cell && cell.classList) {
        cell.classList.add('drag-over');
    }
}

// ドラッグリーブ
function handleDragLeave(e) {
    const cell = e.target.closest('.board-cell, .storage-cell');
    if (cell) {
        cell.classList.remove('drag-over');
    }
}

// ドロップ
function handleDrop(e) {
    e.preventDefault();
    const cell = e.target.closest('.board-cell');
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    // 進行不可能セルには配置できない
    if (isBlocked(row, col)) {
        cell.classList.remove('drag-over');
        return;
    }

    // 元の位置から駒を削除（ボードからの移動の場合）
    if (draggedFromBoard && draggedFromCell) {
        board[draggedFromCell.row][draggedFromCell.col] = null;
        updateCellDisplay(draggedFromCell.row, draggedFromCell.col);
    } else if (draggedFromStorage && draggedFromStorageCell) {
        // ストレージからボードへ
        storageBoard[draggedFromStorageCell.row][draggedFromStorageCell.col] = null;
        updateStorageCellDisplay(draggedFromStorageCell.row, draggedFromStorageCell.col);
    }

    // 新しい位置に駒を配置
    board[row][col] = draggedPiece
    updateCellDisplay(row, col);

    cell.classList.remove('drag-over');
    updateStats();
}

function handleStorageDrop(e) {
    e.preventDefault();
    const cell = e.target.closest('.storage-cell');
    const row = parseInt(cell.dataset.storageRow);
    const col = parseInt(cell.dataset.storageCol);

    // 元の位置から駒を削除
    if (draggedFromBoard && draggedFromCell) {
        // ボードからストレージへ
        board[draggedFromCell.row][draggedFromCell.col] = null;
        updateCellDisplay(draggedFromCell.row, draggedFromCell.col);
    } else if (draggedFromStorage && draggedFromStorageCell) {
        // ストレージ内移動
        storageBoard[draggedFromStorageCell.row][draggedFromStorageCell.col] = null;
        updateStorageCellDisplay(draggedFromStorageCell.row, draggedFromStorageCell.col);
    }

    // ストレージに駒を配置
    storageBoard[row][col] = draggedPiece;
    updateStorageCellDisplay(row, col);

    cell.classList.remove('drag-over');
    sortStorage(); // 自動ソート
    updateStats();
}

// ドラッグ終了
function handleDragEnd(e) {
    document.removeEventListener('mousemove', followMouse);
    document.getElementById('draggingPiece').style.display = 'none';

    // ドラッグ中の表示をリセット
    document.querySelectorAll('.board-cell').forEach(cell => {
        cell.classList.remove('drag-over');
    });

    document.querySelectorAll('.placed-piece').forEach(piece => {
        piece.classList.remove('dragging');
    });

    // ボード外ドロップ時の削除処理
    if ((draggedFromBoard && draggedFromCell) || (draggedFromStorage && draggedFromStorageCell)) {
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (!dropTarget || (!dropTarget.closest('.board-cell') && !dropTarget.closest('.storage-cell'))) {
            // 削除処理
            if (draggedFromBoard && draggedFromCell) {
                board[draggedFromCell.row][draggedFromCell.col] = null;
                updateCellDisplay(draggedFromCell.row, draggedFromCell.col);
            } else if (draggedFromStorage && draggedFromStorageCell) {
                storageBoard[draggedFromStorageCell.row][draggedFromStorageCell.col] = null;
                updateStorageCellDisplay(draggedFromStorageCell.row, draggedFromStorageCell.col);
            }
            updateStats();
        }
    }

    // フラグリセット
    draggedPiece = null;
    draggedFromBoard = false;
    draggedFromStorage = false;
    draggedFromCell = null;
    draggedFromStorageCell = null;

    // updateInitialBoardState()

}

// セルの表示を更新
function updateCellDisplay(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const existingPiece = cell.querySelector('.placed-piece');
    const existingBlocked = cell.querySelector('.blocked-marker');

    if (existingPiece) {
        existingPiece.remove();
    }
    if (existingBlocked) {
        existingBlocked.remove();
    }

    // 進行不可能セルの表示
    if (isBlocked(row, col)) {
        const blockedMarker = document.createElement('span');
        blockedMarker.className = 'blocked-marker';
        blockedMarker.textContent = '⛔';
        cell.appendChild(blockedMarker);
        cell.classList.add('blocked');
        cell.classList.remove('occupied');
        return;
    } else {
        cell.classList.remove('blocked');
    }

    if (board[row][col]) {
        const piece = board[row][col];
        const pieceElement = document.createElement('span');
        pieceElement.className = `placed-piece ${getColor(piece) === 'white' ? 'white-piece' : 'black-piece'}`;

        // ポーンの場合は向きを反映した表示
        if (piece.type === 'pawn') {
            const direction = piece.direction;

            // ポーンの基本記号を使用
            pieceElement.textContent = pieceSymbols[piece];

            // 向きを視覚的に示すための回転
            const rotations = ['0deg', '90deg', '180deg', '270deg'];
            pieceElement.style.transform = `rotate(${rotations[direction]})`;
            pieceElement.style.transformOrigin = 'center';
            pieceElement.style.display = 'inline-block'; // 回転のために必要
        } else {
            pieceElement.textContent = pieceSymbols[piece.toString()];
        }

        pieceElement.draggable = true;

        pieceElement.addEventListener('dragstart', handleBoardDragStart);
        pieceElement.addEventListener('dragend', handleDragEnd);

        cell.appendChild(pieceElement);
        cell.classList.add('occupied');
    } else {
        cell.classList.remove('occupied');
    }
}

function updateStorageCellDisplay(row, col) {
    const cell = document.querySelector(`[data-storage-row="${row}"][data-storage-col="${col}"]`);
    const existingPiece = cell.querySelector('.placed-piece');

    if (existingPiece) {
        existingPiece.remove();
    }

    if (storageBoard[row][col]) {
        const piece = storageBoard[row][col];
        const pieceElement = document.createElement('span');
        pieceElement.className = `placed-piece ${piece.color === 'white' ? 'white-piece' : 'black-piece'}`;

        // ポーンの回転処理
        if (piece.type === 'pawn') {
            pieceElement.textContent = piece.getSymbol();
            const rotationDeg = piece.direction * 90;
            pieceElement.style.transform = `rotate(${rotationDeg}deg)`;
            pieceElement.style.transformOrigin = 'center';
            pieceElement.style.display = 'inline-block';
        } else {
            pieceElement.textContent = piece.getSymbol();
        }

        pieceElement.draggable = true;
        pieceElement.addEventListener('dragstart', handleStorageDragStart);
        pieceElement.addEventListener('dragend', handleDragEnd);

        cell.appendChild(pieceElement);
        cell.classList.add('occupied');
    } else {
        cell.classList.remove('occupied');
    }
}

// アニメーション
function animatePieceMove(fromRow, fromCol, toRow, toCol) {
    const fromCell = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
    const pieceElement = fromCell.querySelector('.placed-piece');

    if (!pieceElement) return;

    // 現在の回転状態を取得
    const currentTransform = pieceElement.style.transform || '';
    const rotateMatch = currentTransform.match(/rotate\([^)]*\)/);
    const currentRotation = rotateMatch ? rotateMatch[0] : '';

    // 移動距離を計算
    const cellSize = 62; // 60px + 2px gap
    const deltaX = (toCol - fromCol) * cellSize;  // col差 → X方向
    const deltaY = (toRow - fromRow) * cellSize;  // row差 → Y方向

    // アニメーション開始
    // 既存の回転を維持して移動
    pieceElement.style.transform = `translate(${deltaX}px, ${deltaY}px) ${currentRotation}`;
    pieceElement.style.zIndex = '1000'; // 他の駒の上に表示

    // アニメーション完了後の処理
    setTimeout(() => {
        // 実際のDOM更新
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;

        updateCellDisplay(fromRow, fromCol);
        updateCellDisplay(toRow, toCol);

        // スタイルリセット
        pieceElement.style.transform = currentRotation;
        pieceElement.style.zIndex = '';
    }, 500);
}

function animateCapture(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const pieceElement = cell.querySelector('.placed-piece');

    if (pieceElement) {
        // キャプチャアニメーション開始
        pieceElement.classList.add('piece-captured');

    }
}

// 中クリックイベント（進行不可能設定）
function handleMouseDown(e) {
    if (e.button === 1) { // 中クリック
        e.preventDefault();
        const cell = e.target.closest('.board-cell');
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        toggleBlockedCell(row, col);
    }
}

// 中クリックイベント（進行不可能設定）
function handleMouseDown(e) {
    if (e.button === 1) { // 中クリック
        e.preventDefault();
        const cell = e.target.closest('.board-cell');
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        toggleBlockedCell(row, col);
    }
}

// 進行不可能セルの切り替え
function toggleBlockedCell(row, col) {
    const cellKey = `${row},${col}`;

    if (isBlocked(row, col)) {
        // 進行不可能を解除
        blockedCells.delete(cellKey);
    } else {
        // 駒がある場合は先に駒を削除
        if (board[row][col]) {
            board[row][col] = null;
        }
        // 進行不可能に設定
        blockedCells.add(cellKey);
    }

    updateCellDisplay(row, col);
    updateStats();
}

// 右クリックイベント（ポーンの回転）
function handleRightClick(e) {
    e.preventDefault(); // コンテキストメニューを表示しない

    const cell = e.target.closest('.board-cell');
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const piece = board[row][col];

    // ポーンの場合のみ回転処理
    if (piece && piece.type === 'pawn') {
        piece.direction = (piece.direction + 1) % 4;

        // 表示を更新
        updateCellDisplay(row, col);

        // 評価を再計算
        updateStats();
    }
}

function getSortPriority(piece) {
    const colorPriority = piece.color === 'white' ? 0 : 1000;
    const typePriority = {
        'pawn': 1, 'knight': 2, 'bishop': 3,
        'rook': 4, 'queen': 5, 'king': 6
    };
    return colorPriority + (typePriority[piece.type] || 999);
}

function sortStorage() {
    // 全駒を配列に収集
    const allPieces = [];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 9; col++) {
            if (storageBoard[row][col]) {
                allPieces.push(storageBoard[row][col]);
                storageBoard[row][col] = null;
            }
        }
    }

    // ソート実行
    allPieces.sort((a, b) => getSortPriority(a) - getSortPriority(b));

    // 再配置
    let index = 0;
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 9; col++) {
            if (index < allPieces.length) {
                storageBoard[row][col] = allPieces[index++];
            }
            updateStorageCellDisplay(row, col);
        }
    }
}

// 駒の価値定義（デフォルト値）
const defaultPieceValues = {
    'white-pawn': [1, 1], 'white-knight': [3, 3], 'white-bishop': [3, 3],
    'white-rook': [5, 5], 'white-queen': [9, 9], 'white-king': [4, 2],
    'black-pawn': [1, 1], 'black-knight': [3, 3], 'black-bishop': [3, 3],
    'black-rook': [5, 5], 'black-queen': [9, 9], 'black-king': [4, 2]
};

// 現在の駒の価値（ユーザーが変更可能）
let pieceValues = JSON.parse(JSON.stringify(defaultPieceValues));

const pieceTypeNames = {
    'pawn': 'ポーン',
    'knight': 'ナイト',
    'bishop': 'ビショップ',
    'rook': 'ルーク',
    'queen': 'クイーン',
    'king': 'キング'
};

// スコア設定UIの初期化
function initializeScoreControls() {
    const whiteContainer = document.getElementById('whiteScoreControls');
    const blackContainer = document.getElementById('blackScoreControls');

    const pieceTypes = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

    pieceTypes.forEach(type => {
        // 白駒用
        const whiteDiv = document.createElement('div');
        whiteDiv.className = 'piece-score-control';

        if (type === 'king') {
            // キングは自軍効果の設定
            whiteDiv.innerHTML = `
                        <div class="piece-icon white-piece">${pieceSymbols['white-' + type]}</div>
                        <div class="score-input-group">
                            <div class="score-input-label">取る時</div>
                            <input type="number" class="score-input" id="white-${type}-capture"
                                   value="${pieceValues['white-' + type][0]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('white-${type}', 0, this.value)">
                        </div>
                        <div class="score-input-group">
                            <div class="score-input-label">自軍効果</div>
                            <input type="number" class="score-input" id="white-${type}-captured"
                                   value="${pieceValues['white-' + type][1]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('white-${type}', 1, this.value)">
                        </div>
                    `;
        } else {
            whiteDiv.innerHTML = `
                        <div class="piece-icon white-piece">${pieceSymbols['white-' + type]}</div>
                        <div class="score-input-group">
                            <div class="score-input-label">取る時</div>
                            <input type="number" class="score-input" id="white-${type}-capture"
                                   value="${pieceValues['white-' + type][0]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('white-${type}', 0, this.value)">
                        </div>
                        <div class="score-input-group">
                            <div class="score-input-label">取られる時</div>
                            <input type="number" class="score-input" id="white-${type}-captured"
                                   value="${pieceValues['white-' + type][1]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('white-${type}', 1, this.value)">
                        </div>
                    `;
        }
        whiteContainer.appendChild(whiteDiv);

        // 黒駒用
        const blackDiv = document.createElement('div');
        blackDiv.className = 'piece-score-control';

        if (type === 'king') {
            // キングは自軍効果の設定
            blackDiv.innerHTML = `
                        <div class="piece-icon black-piece">${pieceSymbols['black-' + type]}</div>
                        <div class="score-input-group">
                            <div class="score-input-label">取る時</div>
                            <input type="number" class="score-input" id="black-${type}-capture"
                                   value="${pieceValues['black-' + type][0]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('black-${type}', 0, this.value)">
                        </div>
                        <div class="score-input-group">
                            <div class="score-input-label">自軍効果</div>
                            <input type="number" class="score-input" id="black-${type}-captured"
                                   value="${pieceValues['black-' + type][1]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('black-${type}', 1, this.value)">
                        </div>
                    `;
        } else {
            blackDiv.innerHTML = `
                        <div class="piece-icon black-piece">${pieceSymbols['black-' + type]}</div>
                        <div class="score-input-group">
                            <div class="score-input-label">取る時</div>
                            <input type="number" class="score-input" id="black-${type}-capture"
                                   value="${pieceValues['black-' + type][0]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('black-${type}', 0, this.value)">
                        </div>
                        <div class="score-input-group">
                            <div class="score-input-label">取られる時</div>
                            <input type="number" class="score-input" id="black-${type}-captured"
                                   value="${pieceValues['black-' + type][1]}" min="0" max="20" step="1"
                                   onchange="updatePieceValue('black-${type}', 1, this.value)">
                        </div>
                    `;
        }
        blackContainer.appendChild(blackDiv);
    });
}

// 駒の価値更新
function updatePieceValue(pieceKey, valueIndex, newValue) {
    const value = parseFloat(newValue) || 0;
    pieceValues[pieceKey][valueIndex] = value;
    updateStats(); // 統計を再計算
}

// スコアをデフォルトにリセット
function resetScores() {
    if (confirm('効果値をデフォルトに戻しますか？')) {
        pieceValues = JSON.parse(JSON.stringify(defaultPieceValues));

        // UI更新
        Object.keys(pieceValues).forEach(pieceKey => {
            const [color, type] = pieceKey.split('-');
            document.getElementById(`${color}-${type}-capture`).value = pieceValues[pieceKey][0];
            document.getElementById(`${color}-${type}-captured`).value = pieceValues[pieceKey][1];
        });

        updateStats();
    }
}

function getAllPossibleMoves(color) {
    const moves = [];

    // 盤面の全マスをチェック
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = board[row][col];

            // 指定色の駒のみ処理
            if (piece && getColor(piece) === color) {
                const possibleMoves = getPossibleMoves(piece, row, col);

                // 各移動先に対してムーブオブジェクトを作成
                possibleMoves.forEach(([toRow, toCol]) => {
                    moves.push({
                        piece: piece,
                        from: { row, col },
                        to: { row: toRow, col: toCol },
                        target: board[toRow][toCol] // 移動先の駒（nullまたは敵駒）
                    });
                });
            }
        }
    }

    return moves;
}

function isCapture(move) {
    // 移動先に駒があり、かつ敵駒である場合
    return move.target !== null && getColor(move.target) !== getColor(move.piece);
}

// 駒の移動パターン取得
function getPossibleMoves(piece, row, col, currentBoard = board) {
    const moves = [];
    const pieceType = piece.type;

    switch (pieceType) {
    case 'pawn':
        // ポーン: 向きに応じた斜め前2方向
        const direction = piece.direction;

        // 向きごとの斜め前方向定義
        const pawnDirectionMoves = [
            [[-1, -1], [-1, 1]], // 上向き
            [[1, 1], [-1, 1]],   // 右向き
            [[1, -1], [1, 1]],   // 下向き
            [[-1, -1], [1, -1]]  // 左向き
        ];

        const pawnMoves = pawnDirectionMoves[direction];
        pawnMoves.forEach(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidPosition(newRow, newCol) && !isBlocked(newRow, newCol)) {
                const targetPiece = currentBoard[newRow][newCol];
                if (!targetPiece || getColor(targetPiece) !== getColor(piece)) {
                    moves.push([newRow, newCol]);
                }
            }
        });
        break;

    case 'knight':
        // ナイト: L字移動
        const knightMoves = [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]];
        knightMoves.forEach(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidPosition(newRow, newCol) && !isBlocked(newRow, newCol)) {
                const targetPiece = currentBoard[newRow][newCol];
                if (!targetPiece || getColor(targetPiece) !== getColor(piece)) {
                    moves.push([newRow, newCol]);
                }
            }
        });
        break;

    case 'bishop':
        // ビショップ: 斜め
        addSlidingMoves(moves, row, col, [[-1,-1], [-1,1], [1,-1], [1,1]], piece, currentBoard);
        break;

    case 'rook':
        // ルーク: 前後左右
        addSlidingMoves(moves, row, col, [[-1,0], [1,0], [0,-1], [0,1]], piece, currentBoard);
        break;

    case 'queen':
        // クイーン: 全方向
        addSlidingMoves(moves, row, col, [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]], piece, currentBoard);
        break;

    case 'king':
        // キング: 全方向1マス
        const kingMoves = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
        kingMoves.forEach(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidPosition(newRow, newCol) && !isBlocked(newRow, newCol)) {
                const targetPiece = currentBoard[newRow][newCol];
                if (!targetPiece || getColor(targetPiece) !== getColor(piece)) {
                    moves.push([newRow, newCol]);
                }
            }
        });
        break;
    }

    return moves;
}

function addSlidingMoves(moves, row, col, directions, piece, currentBoard = board) {
    directions.forEach(([dr, dc]) => {
        // 全て移動出来るわけではなく、5マスまで。
        for (let i = 1; i < 6; i++) {
            const newRow = row + dr * i;
            const newCol = col + dc * i;

            // 盤面外なら停止
            if (!isValidPosition(newRow, newCol)) break;

            // 進行不可能マスには移動できないが、通過は可能
            if (!isBlocked(newRow, newCol)) {
                const targetPiece = currentBoard[newRow][newCol];
                if (!targetPiece || getColor(targetPiece) !== getColor(piece)) {
                    moves.push([newRow, newCol]);
                }
            }
            // 駒があっても飛び越えて移動可能（BackpackBattlesルール）
        }
    });
}

function isValidPosition(row, col) {
    return row >= 0 && row < 7 && col >= 0 && col < 9;
}

function isBlocked(row, col) {
    return blockedCells.has(`${row},${col}`);
}

function getColor(piece) {
    return piece ? piece.color : null;
}

function getOppositeColor(color) {
    return color === 'white' ? 'black' : 'white';
}

function logAllPieces(currentBoard) {
    console.log("=== 現在の盤面の駒一覧 ===");
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = currentBoard[row][col];
            if (piece) {
                console.log(`${piece} at (${row}, ${col})`);
            }
        }
    }
}

// 盤面評価関数
function evaluateBoard(){
    // 軽量化のため盤面評価を打ち分ける。
    // 駒の数が6未満 => 全探索評価
    // 駒の数が6以上 => 確率的評価
    let count = 0;
    for(let row=0;row<7;row++){
        for(let col=0;col<9;col++){
            if(board[row][col]){
                count += 1;
            }
        }
    }

    // 駒の数が6未満ならば全探索
    if(count<6){
        return fullEvaluateBoard();
    }else{
        return probabilisticEvaluateBoard();
    }

}

function fullEvaluateBoard(boardState = null, depth = 0, turn = 'white', maxDepth = 6, firstCapture = null, noCaptureCount = 0) {


    // 深すぎる探索は重くなってしまうので、荒い評価で代用する。
    if (depth >= maxDepth) {
        return heuristicEvaluateBoard(boardState);
    }
    if (noCaptureCount >= 2) return 0;

    const currentBoard = boardState || board.map(row => [...row]);
    let totalScore = 0;
    let candidateNum = 0;

    // 初回戦闘フラグの初期化（個別駒ごと）
    if (firstCapture === null) {
        firstCapture = new Set();
    }

    // 指定色の全駒について評価
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = currentBoard[row][col];
            if (!piece || getColor(piece) !== turn) continue;

            const moves = getPossibleMoves(piece, row, col, currentBoard);

            for (const [newRow, newCol] of moves) {
                const eliminatePiece = currentBoard[newRow][newCol];

                // 取る駒がなければスキップ
                if (!eliminatePiece) {
                    continue;
                }

                candidateNum++;

                // スコア計算
                let score = 0;

                // 取る駒の基本効果
                score += pieceValues[piece.toString()][0];

                // キングは取られる効果なし、その他は取られる効果あり
                if (eliminatePiece.type !== 'king') {
                    score += pieceValues[eliminatePiece.toString()][1];
                }

                // キングの自軍効果をチェック
                let countKingSupport = countAllyKings(currentBoard, getColor(piece));
                const kingPiece = getColor(piece) === 'white' ? 'white-king' : 'black-king';
                const kingBonus = countKingSupport * pieceValues[kingPiece][1]; // キングの自軍効果は[1]に設定

                // 個別駒の初回戦闘の場合は2倍
                const firstFlag = !firstCapture.has(piece.id)
                if (!firstFlag) {
                    score += kingBonus * 2;
                    // 新しいSetを作成して状態を更新
                    firstCapture.add(piece.id);
                } else {
                    score += kingBonus
                }

                // 盤面を更新
                currentBoard[newRow][newCol] = piece;
                currentBoard[row][col] = null;

                // 再帰評価（更新された初回戦闘フラグを引き継ぎ）
                const b = fullEvaluateBoard(currentBoard, depth+1, getOppositeColor(turn), maxDepth, firstCapture, 0);
                score += b
                totalScore += score;

                // 盤面を元に戻す
                currentBoard[newRow][newCol] = eliminatePiece
                currentBoard[row][col] = piece
                if (firstFlag){
                    firstCapture.delete(piece.id)
                }
            }
        }
    }

    if (candidateNum > 0) {
        totalScore /= candidateNum
        return totalScore;
    }

    // 取得できる移動先がない場合
    // ランダムに移動
    // 指定色の全駒について評価
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = currentBoard[row][col];
            if (!piece || getColor(piece) !== turn) continue;
            const moves = getPossibleMoves(piece, row, col, currentBoard);

            for (const [newRow, newCol] of moves) {
                candidateNum++;

                // 移動シミュレーション
                currentBoard[newRow][newCol] = piece;
                currentBoard[row][col] = null;

                // 再帰評価
                let score = 0;
                score += fullEvaluateBoard(currentBoard, depth+1, getOppositeColor(turn), maxDepth, firstCapture, noCaptureCount+1);
                totalScore += score;

                // 盤面を元に戻す
                currentBoard[newRow][newCol] = null;
                currentBoard[row][col] = piece;
            }
        }
    }

    if (candidateNum > 0){
        totalScore /= candidateNum
        return totalScore;
    } else {
        // 移動できる駒がない場合
        let score = 0;
        score += fullEvaluateBoard(currentBoard, depth+1, getOppositeColor(turn), maxDepth, firstCapture, noCaptureCount+1);
        totalScore += score;

        return totalScore;
    }
}

// 自軍キングの数をカウント
function countAllyKings(boardState, color) {
    let kingCount = 0;
    // 盤面全体で自軍キングを探索
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 9; c++) {
            const piece = boardState[r][c];
            if (piece && piece.type === 'king' && getColor(piece) === color) {
                kingCount++;
            }
        }
    }
    return kingCount;
}

// 荒い盤面評価。
// 駒のスコアにのみ依存する。
function heuristicEvaluateBoard(boardState = null) {

    const currentBoard = boardState || board.map(row => [...row]);
    let totalScore = 0;

    let whiteCount = 0;
    let blackCount = 0
    let whiteKingCount = 0;
    let blackKingCount = 0;

    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = currentBoard[row][col];
            if (!piece) continue;

            if (getColor(piece) == 'white') {
                whiteCount++;
            }else{
                blackCount++;
            }

            if (piece.type !== 'king'){
                totalScore += pieceValues[piece.toString()][0];
                totalScore += pieceValues[piece.toString()][1];
            } else {
                // キングの自軍効果は別計算
                totalScore += pieceValues[piece.toString()][0];
                if (getColor(piece) === 'white'){
                    whiteKingCount++;
                } else{
                    blackKingCount++;
                }
            }
        }
    }

    // キングの自軍効果計算
    totalScore += whiteCount*pieceValues['white-king'][1]
    totalScore += blackCount*pieceValues['black-king'][1]

    return totalScore;
}

function probabilisticEvaluateBoard(iteration=1000){

    let score = 0;
    for(let i=0;i<iteration;i++){
        score += simulateScore();
    }
    return score/iteration;
}

function simulateScore(){

    let score = 0;
    let turn = 'white';
    let noBattleCount = 0;
    const initialBoard = board.map(row => [...row]);

    // 先にkingの数を求めておく
    let kingCount = {'white':0, 'black':0};
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = board[row][col];
            if (!piece) continue;
            if (piece.type == 'king'){
                kingCount[getColor(piece)] += 1
            }
        }
    }

    let firstCapture = new Set();

    for(let i=0;i<100;i++){
        const moves = getAllPossibleMoves(turn);
        const captureMoves = moves.filter(move => isCapture(move));

        let selectedMove;

        if (captureMoves.length > 0) {
            // 取る手があればランダム選択
            selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
            const { piece, from, to, target } = selectedMove;
            noBattleCount = 0;

            score += pieceValues[piece.toString()][0]
            if (target.type !== 'king'){
                score += pieceValues[target.toString()][1]
            }
            if (!firstCapture.has(piece.id)){
                score += 2*kingCount[getColor(piece)]*pieceValues[getColor(piece)+'-king'][1];
                firstCapture.add(piece.id)
            } else {
                score += kingCount[getColor(piece)]*pieceValues[getColor(piece)+'-king'][1];
            }

        } else if (moves.length > 0) {
            // 通常の手をランダム選択
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
            noBattleCount++;
        } else {
            // 動けない場合は手番スキップ
            noBattleCount++;
        }

        // 停止条件チェック
        if (noBattleCount >= 4) { // 4手連続戦闘なしで停止
            break;
        }

        if (selectedMove){
            const { piece, from, to, target } = selectedMove;

            // 即座に移動
            board[to.row][to.col] = board[from.row][from.col];
            board[from.row][from.col] = null;
        }

        // 手番交代
        turn = turn === 'white' ? 'black' : 'white';
    }
    board = initialBoard;

    return score;

}

let simulationRunning = false;
let currentTurn = 'white';
let battleCount = 0;
let noBattleCount = 0;
let initialBoardState = null;

function startSimulation() {
    if (simulationRunning) return;

    // 初期状態を保存
    initialBoardState = board.map(row => [...row]);

    simulationRunning = true;
    noBattleCount = 0;
    battleCount = 0;
    currentTurn = 'white'

    simulationStep();
}

function simulationStep() {

    if (!simulationRunning) return;

    const moves = getAllPossibleMoves(currentTurn);
    const captureMoves = moves.filter(move => isCapture(move));

    let selectedMove;
    if (captureMoves.length > 0) {
        // 取る手があればランダム選択
        selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        battleCount++;
        noBattleCount = 0;
    } else if (moves.length > 0) {
        // 通常の手をランダム選択
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
        noBattleCount++;
    } else {
        // 動けない場合は手番スキップ
        noBattleCount++;
    }

    // 停止条件チェック
    if (noBattleCount >= 4) { // 4手連続戦闘なしで停止
        stopSimulation();
        return;
    }

function executeMove(move) {
    const { piece, from, to, target } = move;

    // アニメーションありの場合
    if (simulationRunning) {
        animateCapture(to.row, to.col);
        animatePieceMove(from.row, from.col, to.row, to.col);
    } else {
        // 即座に移動

        board[to.row][to.col] = board[fromRow][fromCol];
        board[from.row][from.col] = null;

        // DOM更新
        updateCellDisplay(from.row, from.col);
        updateCellDisplay(to.row, to.col);

    }

    // 戦闘ログ出力
    if (target) {
        console.log(`${piece} が ${target} を取りました (${from.row},${from.col}) → (${to.row},${to.col})`);
    } else {
        console.log(`${piece} が移動しました (${from.row},${from.col}) → (${to.row},${to.col})`);
    }
}
    if (selectedMove) {
        executeMove(selectedMove);
    }

    // 手番交代
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    updateSimulationStatus();

    // 次の手を1秒後に実行
    setTimeout(simulationStep, 500);
}

function executeMove(move) {
    const { piece, from, to, target } = move;

    // アニメーションありの場合
    if (simulationRunning) {
        animateCapture(to.row, to.col);
        animatePieceMove(from.row, from.col, to.row, to.col);
    } else {
        // 即座に移動

        board[to.row][to.col] = board[fromRow][fromCol];
        board[from.row][from.col] = null;

        // DOM更新
        updateCellDisplay(from.row, from.col);
        updateCellDisplay(to.row, to.col);

    }

    // 戦闘ログ出力
    if (target) {
        console.log(`${piece} が ${target} を取りました (${from.row},${from.col}) → (${to.row},${to.col})`);
    } else {
        console.log(`${piece} が移動しました (${from.row},${from.col}) → (${to.row},${to.col})`);
    }
}


function stopSimulation() {
    simulationRunning = false;

    // UI更新
    updateSimulationStatus();

    // 停止理由をログ出力
    if (noBattleCount >= 4) {
        console.log('シミュレーション停止: 4手連続で戦闘なし');
    } else {
        console.log('シミュレーション停止: ユーザーによる停止');
    }

    // 最終統計表示
    console.log(`最終結果 - 戦闘回数: ${battleCount}, 総手数: ${battleCount + noBattleCount}`);
}

function updateSimulationStatus() {
    const currentTurnElement = document.getElementById('currentTurn');
    const battleCountElement = document.getElementById('battleCount');

    // 手番表示更新
    currentTurnElement.textContent = `手番: ${currentTurn === 'white' ? '白' : '黒'}`;

    // 戦闘回数表示更新
    battleCountElement.textContent = `戦闘回数: ${battleCount}`;
}

function resetSimulation() {
    // 実行中なら停止
    if (simulationRunning) {
        simulationRunning = false;
    }

    // 初期状態がない場合の処理
    if (!initialBoardState) {
        // console.warn('初期状態が保存されていません');
        return;
    }

    // 状態リセット
    currentTurn = 'white';
    battleCount = 0;
    noBattleCount = 0;

    // 盤面復旧（ディープコピー）
    board = initialBoardState.map(row => [...row]);

    // DOM更新
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            updateCellDisplay(row, col);
        }
    }

    // UI状態更新
    updateSimulationStatus();
    updateStats();

    console.log('盤面をリセットしました');
}

function updateInitialBoardState() {
    // 初期状態を保存
    initialBoardState = board.map(row => [...row]);
}

// 統計更新
function updateStats() {
    const stats = {};
    const colors = { white: 0, black: 0 };

    // 駒をカウント
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col]) {
                const piece = board[row][col];
                stats[piece.toString()] = (stats[piece.toString()] || 0) + 1;

                if (getColor(piece) === 'white') colors.white++;
                else colors.black++;
            }
        }
    }

    // 盤面評価スコア計算（白手番開始）
    const boardScore = evaluateBoard();
    // const boardScore = 0;

    // 統計表示を更新
    const statsElement = document.getElementById('pieceStats');
    let html = '';

    // 色別統計
    html += `<div class="piece-count"><strong>白駒総数:</strong> <span>${colors.white}</span></div>`;
    html += `<div class="piece-count"><strong>黒駒総数:</strong> <span>${colors.black}</span></div>`;
    html += `<div class="piece-count"><strong>バランス差:</strong> <span>${Math.abs(colors.white - colors.black)}</span></div>`;

    html += '<hr style="margin: 10px 0;">';

    // 盤面評価スコア
    html += `<div class="piece-count"><strong>盤面評価:</strong> <span>${boardScore.toFixed(1)}</span></div>`;

    html += '<hr style="margin: 10px 0;">';

    // 個別駒統計
    Object.keys(pieceNames).forEach(piece => {
        if (stats[piece]) {
            html += `<div class="piece-count">
                        <span>${pieceNames[piece]}:</span>
                        <span>${stats[piece]}</span>
                    </div>`;
        }
    });

    statsElement.innerHTML = html;
}

let initialPlacementState = null; // 初期配置状態
let bestPlacement = null;         // 最良配置
let bestScore = -Infinity;        // 最良スコア

function suggestPlacement() {
    // 初期状態を保存
    saveInitialPlacementState();

    // ストレージに駒がない場合は終了
    const storagePieces = getStoragePieces();
    if (storagePieces.length === 0) {
        alert('ストレージに駒がありません');
        return;
    }

    console.log(`配置提案開始: ${storagePieces.length}個の駒を配置`);

    // 最良配置をリセット
    bestPlacement = null;
    bestScore = -Infinity;

    // ボタンを無効化
    const suggestBtn = document.getElementById('suggestBtn');
    suggestBtn.disabled = true;
    suggestBtn.textContent = '🔄 計算中...';

    // 非同期で配置試行
    setTimeout(() => {
        tryRandomPlacements(storagePieces, 300);
        applyBestPlacement();

        // ボタンを復旧
        suggestBtn.disabled = false;
        suggestBtn.textContent = '🎯 配置提案';

        console.log(`最良スコア: ${bestScore.toFixed(2)}`);
    }, 100);
}

function saveInitialPlacementState() {
    initialPlacementState = {
        board: board.map(row => [...row]),
        storageBoard: storageBoard.map(row => [...row])
    };
}

function getStoragePieces() {
    const pieces = [];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 9; col++) {
            if (storageBoard[row][col]) {
                pieces.push({
                    piece: storageBoard[row][col],
                    storagePos: { row, col }
                });
            }
        }
    }
    return pieces;
}

function tryRandomPlacements(pieces, tryCount) {

    let successCount = 0;

    for (let attempt = 0; attempt < tryCount; attempt++) {
        // 初期状態に戻す
        resetToInitialState();

        // ランダム配置を試行
        const placement = generateRandomPlacement(pieces);

        if (placement.length === pieces.length) {
            successCount++;
            // 全駒配置成功時にスコア評価
            const score = evaluateBoard();
            if (score > bestScore) {
                bestScore = score;
                bestPlacement = [...placement];
                console.log(`新最良スコア: ${score.toFixed(2)} (試行${attempt + 1})`);
            }
        }
    }
    console.log(`成功配置: ${successCount}/${tryCount} (${(successCount/tryCount*100).toFixed(1)}%)`);
}

function generateRandomPlacement(pieces) {
    const placement = [];
    const shuffledPieces = [...pieces].sort(() => Math.random() - 0.5);

    for (const pieceData of shuffledPieces) {
        const candidates = getStrategicCandidates(pieceData.piece);

        if (candidates.length === 0) continue;

        // ランダムに候補から選択
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const position = candidates[randomIndex];

        // 駒を配置
        board[position.row][position.col] = pieceData.piece;
        placement.push({
            piece: pieceData.piece,
            position: position,
            storagePos: pieceData.storagePos
        });
    }

    return placement;
}

function getStrategicCandidates(newPiece) {
    const candidates = [];

    // 既存の駒の利き先候補
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            const existingPiece = board[row][col];
            if (!existingPiece) continue;

            const moves = getPossibleMoves(existingPiece, row, col);
            moves.forEach(([moveRow, moveCol]) => {
                if (!board[moveRow][moveCol] && !isBlocked(moveRow, moveCol)) {
                    candidates.push({ row: moveRow, col: moveCol, type: 'target' });
                }
            });
        }
    }

    // 新しい駒が既存駒を狙える位置
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] || isBlocked(row, col)) continue;

            // 仮配置して利きをチェック
            board[row][col] = newPiece;
            const moves = getPossibleMoves(newPiece, row, col);

            // 既存駒を狙えるかチェック
            const canAttackExisting = moves.some(([moveRow, moveCol]) => {
                const target = board[moveRow][moveCol];
                return target && target !== newPiece;
            });

            board[row][col] = null; // 仮配置を戻す

            if (canAttackExisting) {
                candidates.push({ row, col, type: 'attacker' });
            }
        }
    }

    // 候補がない場合は全ての空きマスを候補にする
    if (candidates.length === 0) {
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 9; col++) {
                if (!board[row][col] && !isBlocked(row, col)) {
                    candidates.push({ row, col, type: 'fallback' });
                }
            }
        }
    }

    // 重複を除去
    const uniqueCandidates = [];
    const seen = new Set();

    candidates.forEach(candidate => {
        const key = `${candidate.row},${candidate.col}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCandidates.push(candidate);
        }
    });

    return uniqueCandidates;
}


function applyBestPlacement() {
    if (!bestPlacement) {
        alert('最適な配置が見つかりませんでした');
        return;
    }

    // 初期状態に戻す
    resetToInitialState();

    // 最良配置を適用
    bestPlacement.forEach(placement => {
        const { piece, position, storagePos } = placement;

        // ストレージから除去
        storageBoard[storagePos.row][storagePos.col] = null;
        updateStorageCellDisplay(storagePos.row, storagePos.col);

        // 盤面に配置
        board[position.row][position.col] = piece;
        updateCellDisplay(position.row, position.col);
    });

    // ストレージをソート
    sortStorage();
    updateStats();
}

function resetToInitialState() {
    if (!initialPlacementState) return;

    // 盤面復旧
    board = initialPlacementState.board.map(row => [...row]);
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 9; col++) {
            updateCellDisplay(row, col);
        }
    }

    // ストレージ復旧
    storageBoard = initialPlacementState.storageBoard.map(row => [...row]);
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 9; col++) {
            updateStorageCellDisplay(row, col);
        }
    }
}


// ボードクリア
function clearBoard() {
    if (confirm('ボードをクリアしますか？')) {
        board = Array(7).fill().map(() => Array(9).fill(null));
        blockedCells.clear(); // 進行不可能セル情報をクリア

        // **駒ID情報をクリア**
        pieceIdCounter = 0;

        document.querySelectorAll('.board-cell').forEach(cell => {
            const piece = cell.querySelector('.placed-piece');
            const blocked = cell.querySelector('.blocked-marker');
            if (piece) piece.remove();
            if (blocked) blocked.remove();
            cell.classList.remove('occupied', 'blocked');
        });

        updateStats();
    }

    updateInitialBoardState()
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeBoard();
    initializePalette();
    initializeStorage();
    initializeScoreControls();
    initializePlacementControls(); // 追加

    // **ボタンイベントの追加**
    document.getElementById('simulateBtn').addEventListener('click', startSimulation);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);

    document.getElementById('suggestBtn').addEventListener('click', suggestPlacement);
    document.getElementById('suggestResetBtn').addEventListener('click', resetToInitialState);

    updateStats();
});
