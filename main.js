// ===== 常量与状态 =====
const SIZE = 4;
const BEST_KEY = "bestScore_2048_plus";

let board = [];
let score = 0;
let bestScore = 0;
let history = [];
let gameOver = false;

// ===== DOM 引用 =====
const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");

const restartBtn = document.getElementById("restartBtn");
const undoBtn = document.getElementById("undoBtn");
const tryAgainBtn = document.getElementById("tryAgainBtn");
const themeBtn = document.getElementById("themeBtn");
const gameContainerEl = document.querySelector(".game-container");

// ===== 音效 =====
const moveSound = new Audio("sounds/move.mp3");
const mergeSound = new Audio("sounds/merge.mp3");
moveSound.preload = "auto";
mergeSound.preload = "auto";

// ===== 工具函数 =====
function createGrid() {
  gridEl.innerHTML = "";
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "cell cell-0";
    gridEl.appendChild(cell);
  }
}

function deepCopy(bd) {
  return bd.map((row) => row.slice());
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function saveHistory() {
  history.push({
    board: deepCopy(board),
    score,
  });
}

function undo() {
  if (history.length === 0) return;
  const prev = history.pop();
  board = deepCopy(prev.board);
  score = prev.score;
  scoreEl.textContent = score.toString();
  render();
  gameOver = false;
  overlayEl.classList.remove("show");
}

// ===== 最高分相关 =====
function loadBestScore() {
  const saved = localStorage.getItem(BEST_KEY);
  if (saved) {
    bestScore = parseInt(saved, 10) || 0;
  } else {
    bestScore = 0;
  }
  bestEl.textContent = bestScore.toString();
}

function updateScore(delta) {
  score += delta;
  scoreEl.textContent = score.toString();

  if (score > bestScore) {
    bestScore = score;
    bestEl.textContent = bestScore.toString();
    localStorage.setItem(BEST_KEY, bestScore.toString());
  }
}

// ===== 随机方块 =====
function addRandomTile(changes) {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) {
        empty.push({ r, c });
      }
    }
  }
  if (!empty.length) return;

  const pos = empty[Math.floor(Math.random() * empty.length)];
  board[pos.r][pos.c] = Math.random() < 0.9 ? 2 : 4;
  changes.push({ ...pos, type: "new" });
}

// ===== 渲染 =====
function render() {
  const cells = gridEl.children;
  let index = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = board[r][c];
      const cell = cells[index++];
      cell.className = `cell cell-${value}`;
      cell.textContent = value === 0 ? "" : value;
    }
  }
}

function renderWithAnimation(changes) {
  render();
  const cells = gridEl.children;
  const idx = (r, c) => r * SIZE + c;

  for (const ch of changes) {
    if (ch.r == null || ch.c == null) continue;
    const cell = cells[idx(ch.r, ch.c)];
    if (ch.type === "new") cell.classList.add("new-tile");
    if (ch.type === "merge") cell.classList.add("merge");
    setTimeout(() => {
      cell.classList.remove("new-tile", "merge");
    }, 300);
  }
}

// ===== 是否还能移动 =====
function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true;
    }
  }
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      if (board[r][c] === board[r][c + 1]) return true;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE - 1; r++) {
      if (board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

// ===== 滑动与合并核心 =====
function slide(arr, changes, lineIndex, isRow, direction) {
  const filtered = arr.filter((v) => v !== 0);
  const result = [];
  let posIndex = 0;

  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      result.push(merged);

      // 合并音效
      mergeSound.currentTime = 0;
      mergeSound.play();

      updateScore(merged);

      // 估算动画坐标
      let r, c;
      if (isRow) {
        if (direction === "left") {
          r = lineIndex;
          c = posIndex;
        } else {
          r = lineIndex;
          c = SIZE - 1 - posIndex;
        }
      } else {
        if (direction === "up") {
          r = posIndex;
          c = lineIndex;
        } else {
          r = SIZE - 1 - posIndex;
          c = lineIndex;
        }
      }
      changes.push({ r, c, type: "merge" });

      i++;
    } else {
      result.push(filtered[i]);
    }
    posIndex++;
  }

  while (result.length < SIZE) result.push(0);
  return result;
}

function move(direction) {
  if (gameOver) return;

  saveHistory();

  let moved = false;
  const changes = [];

  if (direction === "left" || direction === "right") {
    for (let r = 0; r < SIZE; r++) {
      const row = board[r];
      if (direction === "left") {
        const newRow = slide(row, changes, r, true, "left");
        if (!arraysEqual(row, newRow)) moved = true;
        board[r] = newRow;
      } else {
        const rev = row.slice().reverse();
        const newRow = slide(rev, changes, r, true, "right").reverse();
        if (!arraysEqual(row, newRow)) moved = true;
        board[r] = newRow;
      }
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const col = board.map((row) => row[c]);
      if (direction === "up") {
        const newCol = slide(col, changes, c, false, "up");
        for (let r = 0; r < SIZE; r++) {
          if (board[r][c] !== newCol[r]) moved = true;
          board[r][c] = newCol[r];
        }
      } else {
        const rev = col.slice().reverse();
        const newCol = slide(rev, changes, c, false, "down").reverse();
        for (let r = 0; r < SIZE; r++) {
          if (board[r][c] !== newCol[r]) moved = true;
          board[r][c] = newCol[r];
        }
      }
    }
  }

  if (!moved) {
    history.pop();
    return;
  }

  // 移动音效
  moveSound.currentTime = 0;
  moveSound.play();

  addRandomTile(changes);
  renderWithAnimation(changes);

  if (!canMove()) {
    gameOver = true;
    overlayEl.classList.add("show");
  }
}

// ===== 新游戏 =====
function newGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  scoreEl.textContent = "0";
  history = [];
  gameOver = false;
  overlayEl.classList.remove("show");

  addRandomTile([]);
  addRandomTile([]);
  render();
}

// ===== 手机触摸滑动 =====
let startX = 0;
let startY = 0;

gameContainerEl.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  },
  { passive: false }
);

gameContainerEl.addEventListener(
  "touchmove",
  (e) => {
    // 阻止页面上下滚动
    e.preventDefault();
  },
  { passive: false }
);

gameContainerEl.addEventListener(
  "touchend",
  (e) => {
    if (e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 30; // 滑动阈值

    if (absX < threshold && absY < threshold) {
      return;
    }

    if (absX > absY) {
      if (dx > 0) move("right");
      else move("left");
    } else {
      if (dy > 0) move("down");
      else move("up");
    }
  },
  { passive: false }
);

// ===== 键盘控制（PC） =====
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") move("left");
  if (e.key === "ArrowRight") move("right");
  if (e.key === "ArrowUp") move("up");
  if (e.key === "ArrowDown") move("down");
});

// ===== 按钮事件 =====
restartBtn.onclick = newGame;
tryAgainBtn.onclick = newGame;
undoBtn.onclick = undo;

themeBtn.onclick = () => {
  if (document.body.classList.contains("light")) {
    document.body.classList.remove("light");
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
    document.body.classList.add("light");
  }
};

// ===== 启动 =====
createGrid();
loadBestScore();
newGame();
