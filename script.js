(() => {
  "use strict";

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const historyEl = document.getElementById("moveHistory");
  const capturedByWhiteEl = document.getElementById("capturedByWhite");
  const capturedByBlackEl = document.getElementById("capturedByBlack");
  const newGameBtn = document.getElementById("newGameBtn");
  const undoBtn = document.getElementById("undoBtn");
  const flipBtn = document.getElementById("flipBtn");
  const promotionModal = document.getElementById("promotionModal");
  const promotionChoices = document.getElementById("promotionChoices");

  const PIECES = Object.freeze({
    wK: "♚", wQ: "♛", wR: "♜", wB: "♝", wN: "♞", wP: "♟",
    bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
  });

  const FILES = ["a","b","c","d","e","f","g","h"];
  const PROMOTIONS = ["Q", "R", "B", "N"];

  let state = freshState();
  let selected = null;
  let legalMoves = [];
  let flipped = false;
  let pendingPromotion = null;
  let snapshots = [];

  function freshState() {
    return {
      board: [
        ["bR","bN","bB","bQ","bK","bB","bN","bR"],
        ["bP","bP","bP","bP","bP","bP","bP","bP"],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ["wP","wP","wP","wP","wP","wP","wP","wP"],
        ["wR","wN","wB","wQ","wK","wB","wN","wR"]
      ],
      turn: "w",
      castling: {
        wK: true, wQ: true, bK: true, bQ: true
      },
      enPassant: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      history: [],
      capturedByWhite: [],
      capturedByBlack: [],
      gameOver: false
    };
  }

  function cloneState(src) {
    return {
      board: src.board.map(row => row.slice()),
      turn: src.turn,
      castling: { ...src.castling },
      enPassant: src.enPassant ? { ...src.enPassant } : null,
      halfmoveClock: src.halfmoveClock,
      fullmoveNumber: src.fullmoveNumber,
      history: src.history.slice(),
      capturedByWhite: src.capturedByWhite.slice(),
      capturedByBlack: src.capturedByBlack.slice(),
      gameOver: src.gameOver
    };
  }

  function inside(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function colorOf(piece) {
    return piece ? piece[0] : null;
  }

  function typeOf(piece) {
    return piece ? piece[1] : null;
  }

  function opposite(color) {
    return color === "w" ? "b" : "w";
  }

  function algebraic(r, c) {
    return FILES[c] + (8 - r);
  }

  function findKing(board, color) {
    const king = color + "K";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === king) return { r, c };
      }
    }
    return null;
  }

  function isSquareAttacked(board, r, c, byColor) {
    const pawnDir = byColor === "w" ? -1 : 1;
    const pawnRow = r - pawnDir;
    for (const dc of [-1, 1]) {
      const pc = c + dc;
      if (inside(pawnRow, pc) && board[pawnRow][pc] === byColor + "P") {
        return true;
      }
    }

    const knightOffsets = [
      [-2,-1],[-2,1],[-1,-2],[-1,2],
      [1,-2],[1,2],[2,-1],[2,1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const rr = r + dr, cc = c + dc;
      if (inside(rr, cc) && board[rr][cc] === byColor + "N") return true;
    }

    const kingOffsets = [
      [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]
    ];
    for (const [dr, dc] of kingOffsets) {
      const rr = r + dr, cc = c + dc;
      if (inside(rr, cc) && board[rr][cc] === byColor + "K") return true;
    }

    const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of diagDirs) {
      let rr = r + dr, cc = c + dc;
      while (inside(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (colorOf(p) === byColor && (typeOf(p) === "B" || typeOf(p) === "Q")) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    const straightDirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of straightDirs) {
      let rr = r + dr, cc = c + dc;
      while (inside(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (colorOf(p) === byColor && (typeOf(p) === "R" || typeOf(p) === "Q")) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    return false;
  }

  function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return true;
    return isSquareAttacked(board, king.r, king.c, opposite(color));
  }

  function pseudoMoves(currentState, r, c, includeCastling = true) {
    const board = currentState.board;
    const piece = board[r][c];
    if (!piece) return [];

    const color = colorOf(piece);
    const type = typeOf(piece);
    const moves = [];

    function add(rr, cc, special = null) {
      if (!inside(rr, cc)) return false;
      const target = board[rr][cc];
      if (!target) {
        moves.push({ r: rr, c: cc, special });
        return true;
      }
      if (colorOf(target) !== color) {
        moves.push({ r: rr, c: cc, special, capture: true });
      }
      return false;
    }

    function slide(dirs) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          if (!add(rr, cc)) break;
          rr += dr; cc += dc;
        }
      }
    }

    if (type === "P") {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const promoRow = color === "w" ? 0 : 7;

      const one = r + dir;
      if (inside(one, c) && !board[one][c]) {
        moves.push({ r: one, c, promotion: one === promoRow });

        const two = r + dir * 2;
        if (r === startRow && !board[two][c]) {
          moves.push({ r: two, c, special: "doublePawn" });
        }
      }

      for (const dc of [-1, 1]) {
        const rr = r + dir, cc = c + dc;
        if (!inside(rr, cc)) continue;

        const target = board[rr][cc];
        if (target && colorOf(target) !== color) {
          moves.push({ r: rr, c: cc, capture: true, promotion: rr === promoRow });
        }

        if (
          currentState.enPassant &&
          currentState.enPassant.r === rr &&
          currentState.enPassant.c === cc
        ) {
          moves.push({ r: rr, c: cc, special: "enPassant", capture: true });
        }
      }
    }

    if (type === "N") {
      const offsets = [
        [-2,-1],[-2,1],[-1,-2],[-1,2],
        [1,-2],[1,2],[2,-1],[2,1]
      ];
      for (const [dr, dc] of offsets) add(r + dr, c + dc);
    }

    if (type === "B") {
      slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
    }

    if (type === "R") {
      slide([[-1,0],[1,0],[0,-1],[0,1]]);
    }

    if (type === "Q") {
      slide([
        [-1,-1],[-1,1],[1,-1],[1,1],
        [-1,0],[1,0],[0,-1],[0,1]
      ]);
    }

    if (type === "K") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) add(r + dr, c + dc);
        }
      }

      if (includeCastling && !isInCheck(board, color)) {
        const homeRow = color === "w" ? 7 : 0;
        const enemy = opposite(color);

        if (
          r === homeRow && c === 4 &&
          currentState.castling[color + "K"] &&
          board[homeRow][5] === null &&
          board[homeRow][6] === null &&
          board[homeRow][7] === color + "R" &&
          !isSquareAttacked(board, homeRow, 5, enemy) &&
          !isSquareAttacked(board, homeRow, 6, enemy)
        ) {
          moves.push({ r: homeRow, c: 6, special: "castleK" });
        }

        if (
          r === homeRow && c === 4 &&
          currentState.castling[color + "Q"] &&
          board[homeRow][1] === null &&
          board[homeRow][2] === null &&
          board[homeRow][3] === null &&
          board[homeRow][0] === color + "R" &&
          !isSquareAttacked(board, homeRow, 3, enemy) &&
          !isSquareAttacked(board, homeRow, 2, enemy)
        ) {
          moves.push({ r: homeRow, c: 2, special: "castleQ" });
        }
      }
    }

    return moves;
  }

  function applyMoveToState(targetState, from, move, promotionType = "Q", recordHistory = true) {
    const board = targetState.board;
    const piece = board[from.r][from.c];
    const color = colorOf(piece);
    const enemy = opposite(color);
    const targetBefore = board[move.r][move.c];

    if (recordHistory && targetBefore) {
      if (color === "w") targetState.capturedByWhite.push(targetBefore);
      else targetState.capturedByBlack.push(targetBefore);
    }

    board[move.r][move.c] = piece;
    board[from.r][from.c] = null;

    if (move.special === "enPassant") {
      const capturedPawnRow = move.r + (color === "w" ? 1 : -1);
      const captured = board[capturedPawnRow][move.c];
      if (recordHistory && captured) {
        if (color === "w") targetState.capturedByWhite.push(captured);
        else targetState.capturedByBlack.push(captured);
      }
      board[capturedPawnRow][move.c] = null;
    }

    if (move.special === "castleK") {
      const row = color === "w" ? 7 : 0;
      board[row][5] = board[row][7];
      board[row][7] = null;
    }

    if (move.special === "castleQ") {
      const row = color === "w" ? 7 : 0;
      board[row][3] = board[row][0];
      board[row][0] = null;
    }

    if (typeOf(piece) === "P" && (move.r === 0 || move.r === 7)) {
      board[move.r][move.c] = color + promotionType;
    }

    if (piece === "wK") {
      targetState.castling.wK = false;
      targetState.castling.wQ = false;
    }
    if (piece === "bK") {
      targetState.castling.bK = false;
      targetState.castling.bQ = false;
    }

    if (piece === "wR" && from.r === 7 && from.c === 0) targetState.castling.wQ = false;
    if (piece === "wR" && from.r === 7 && from.c === 7) targetState.castling.wK = false;
    if (piece === "bR" && from.r === 0 && from.c === 0) targetState.castling.bQ = false;
    if (piece === "bR" && from.r === 0 && from.c === 7) targetState.castling.bK = false;

    if (targetBefore === "wR" && move.r === 7 && move.c === 0) targetState.castling.wQ = false;
    if (targetBefore === "wR" && move.r === 7 && move.c === 7) targetState.castling.wK = false;
    if (targetBefore === "bR" && move.r === 0 && move.c === 0) targetState.castling.bQ = false;
    if (targetBefore === "bR" && move.r === 0 && move.c === 7) targetState.castling.bK = false;

    targetState.enPassant = null;
    if (typeOf(piece) === "P" && move.special === "doublePawn") {
      targetState.enPassant = {
        r: (from.r + move.r) / 2,
        c: from.c
      };
    }

    if (typeOf(piece) === "P" || targetBefore || move.special === "enPassant") {
      targetState.halfmoveClock = 0;
    } else {
      targetState.halfmoveClock += 1;
    }

    if (color === "b") targetState.fullmoveNumber += 1;
    targetState.turn = enemy;
  }

  function legalMovesFor(currentState, r, c) {
    const piece = currentState.board[r][c];
    if (!piece) return [];
    const color = colorOf(piece);

    return pseudoMoves(currentState, r, c, true).filter(move => {
      const test = cloneState(currentState);
      applyMoveToState(test, { r, c }, move, "Q", false);
      return !isInCheck(test.board, color);
    });
  }

  function allLegalMoves(currentState, color) {
    const result = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (colorOf(currentState.board[r][c]) === color) {
          const moves = legalMovesFor(currentState, r, c);
          for (const move of moves) result.push({ from: { r, c }, move });
        }
      }
    }
    return result;
  }

  function moveNotation(piece, from, move, captured, promotionType, givesCheck, isMate) {
    if (move.special === "castleK") return isMate ? "O-O#" : givesCheck ? "O-O+" : "O-O";
    if (move.special === "castleQ") return isMate ? "O-O-O#" : givesCheck ? "O-O-O+" : "O-O-O";

    const type = typeOf(piece);
    const letter = type === "P" ? "" : type;
    const captureMark = captured ? "x" : "";
    const pawnFile = type === "P" && captured ? FILES[from.c] : "";
    const promo = move.promotion ? "=" + promotionType : "";
    const suffix = isMate ? "#" : givesCheck ? "+" : "";

    return `${letter}${pawnFile}${captureMark}${algebraic(move.r, move.c)}${promo}${suffix}`;
  }

  function executeMove(from, move, promotionType = "Q") {
    if (state.gameOver) return;

    snapshots.push(cloneState(state));

    const piece = state.board[from.r][from.c];
    const captured =
      state.board[move.r][move.c] ||
      (move.special === "enPassant" ? opposite(colorOf(piece)) + "P" : null);

    applyMoveToState(state, from, move, promotionType, true);

    const checkedColor = state.turn;
    const checked = isInCheck(state.board, checkedColor);
    const responses = allLegalMoves(state, checkedColor);
    const mate = checked && responses.length === 0;
    const stalemate = !checked && responses.length === 0;

    const notation = moveNotation(piece, from, move, Boolean(captured), promotionType, checked, mate);
    state.history.push(notation);

    if (mate || stalemate || state.halfmoveClock >= 100) {
      state.gameOver = true;
    }

    selected = null;
    legalMoves = [];
    render();
  }

  function handleSquareClick(r, c) {
    if (state.gameOver || pendingPromotion) return;

    const clicked = state.board[r][c];

    if (selected) {
      const chosen = legalMoves.find(m => m.r === r && m.c === c);
      if (chosen) {
        if (chosen.promotion) {
          pendingPromotion = { from: selected, move: chosen };
          openPromotion(colorOf(state.board[selected.r][selected.c]));
        } else {
          executeMove(selected, chosen);
        }
        return;
      }
    }

    if (clicked && colorOf(clicked) === state.turn) {
      selected = { r, c };
      legalMoves = legalMovesFor(state, r, c);
    } else {
      selected = null;
      legalMoves = [];
    }

    renderBoard();
  }

  function openPromotion(color) {
    promotionChoices.replaceChildren();

    for (const type of PROMOTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `promotion-choice ${color === "w" ? "white-piece" : "black-piece"}`;
      btn.textContent = PIECES[color + type];
      btn.setAttribute("aria-label", `Promote to ${type}`);
      btn.addEventListener("click", () => {
        const data = pendingPromotion;
        pendingPromotion = null;
        promotionModal.classList.add("hidden");
        executeMove(data.from, data.move, type);
      }, { once: true });
      promotionChoices.appendChild(btn);
    }

    promotionModal.classList.remove("hidden");
  }

  function renderBoard() {
    boardEl.replaceChildren();

    const rowOrder = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    const colOrder = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

    const currentKing = findKing(state.board, state.turn);
    const kingInCheck = currentKing && isInCheck(state.board, state.turn);

    for (const r of rowOrder) {
      for (const c of colOrder) {
        const square = document.createElement("button");
        square.type = "button";
        square.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
        square.dataset.r = String(r);
        square.dataset.c = String(c);
        square.setAttribute("aria-label", algebraic(r, c));

        const piece = state.board[r][c];
        if (piece) {
          const span = document.createElement("span");
          span.className = `piece ${colorOf(piece) === "w" ? "white-piece" : "black-piece"}`;
          span.textContent = PIECES[piece];
          square.appendChild(span);
        }

        if (selected && selected.r === r && selected.c === c) {
          square.classList.add("selected-square");
        }

        const lm = legalMoves.find(m => m.r === r && m.c === c);
        if (lm) {
          if (state.board[r][c] || lm.special === "enPassant") {
            square.classList.add("capture-move");
          } else {
            square.classList.add("possible-move");
          }
        }

        if (kingInCheck && currentKing.r === r && currentKing.c === c) {
          square.classList.add("in-check");
        }

        const shownBottomRow = flipped ? r === 0 : r === 7;
        const shownLeftCol = flipped ? c === 7 : c === 0;

        if (shownBottomRow) {
          const file = document.createElement("span");
          file.className = "coord file";
          file.textContent = FILES[c];
          square.appendChild(file);
        }

        if (shownLeftCol) {
          const rank = document.createElement("span");
          rank.className = "coord rank";
          rank.textContent = String(8 - r);
          square.appendChild(rank);
        }

        square.addEventListener("click", () => handleSquareClick(r, c));
        boardEl.appendChild(square);
      }
    }
  }

  function renderStatus() {
    const checked = isInCheck(state.board, state.turn);
    const available = allLegalMoves(state, state.turn);

    let text;

    if (checked && available.length === 0) {
      text = `Мат. Победили ${state.turn === "w" ? "чёрные" : "белые"}.`;
    } else if (!checked && available.length === 0) {
      text = "Пат. Ничья.";
    } else if (state.halfmoveClock >= 100) {
      text = "Ничья по правилу 50 ходов.";
    } else {
      text = `${state.turn === "w" ? "Белые" : "Чёрные"} ходят${checked ? " — шах!" : ""}`;
    }

    statusEl.textContent = text;
  }

  function renderHistory() {
    historyEl.replaceChildren();

    state.history.forEach((move, i) => {
      const li = document.createElement("li");
      const moveNo = Math.floor(i / 2) + 1;
      li.textContent = `${i % 2 === 0 ? moveNo + ". " : ""}${move}`;
      historyEl.appendChild(li);
    });

    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function renderCaptured() {
    capturedByWhiteEl.textContent =
      state.capturedByWhite.length ? state.capturedByWhite.map(p => PIECES[p]).join(" ") : "—";

    capturedByBlackEl.textContent =
      state.capturedByBlack.length ? state.capturedByBlack.map(p => PIECES[p]).join(" ") : "—";
  }

  function render() {
    renderBoard();
    renderStatus();
    renderHistory();
    renderCaptured();
    undoBtn.disabled = snapshots.length === 0;
  }

  newGameBtn.addEventListener("click", () => {
    state = freshState();
    selected = null;
    legalMoves = [];
    pendingPromotion = null;
    snapshots = [];
    promotionModal.classList.add("hidden");
    render();
  });

  undoBtn.addEventListener("click", () => {
    if (snapshots.length === 0) return;
    state = snapshots.pop();
    selected = null;
    legalMoves = [];
    pendingPromotion = null;
    promotionModal.classList.add("hidden");
    render();
  });

  flipBtn.addEventListener("click", () => {
    flipped = !flipped;
    renderBoard();
  });

  render();
})();
