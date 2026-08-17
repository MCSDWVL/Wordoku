"use strict";

const COLORS = ["#ffb7a5", "#f7d878", "#bde2bb", "#9edbd4", "#adc8f5", "#d6b8eb", "#f2b8d2"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_GENERATION_ATTEMPTS = 70;

const elements = {
  board: document.querySelector("#board"),
  meta: document.querySelector("#puzzle-meta"),
  form: document.querySelector("#guess-form"),
  input: document.querySelector("#guess-input"),
  button: document.querySelector("#guess-button"),
  reset: document.querySelector("#reset-button"),
  status: document.querySelector("#status"),
};

let dictionary;
let game;

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seedText) {
  let state = hashSeed(seedText);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function signature(word) { return [...word].sort().join(""); }
function cellKey(row, col) { return `${row},${col}`; }
function utcDay() { return new Date().toISOString().slice(0, 10); }

function currentSeed() {
  const supplied = new URLSearchParams(window.location.search).get("seed");
  return supplied && supplied.trim() ? supplied.trim() : utcDay();
}

function getNeighbors(row, col, size) {
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size);
}

// Regions have deliberately uneven sizes. One small, single-line region gives players an
// elimination foothold; the remaining cells are absorbed by the other connected regions.
// The seed squares remain on unique rows and columns, so the chosen word is always playable.
function createRegions(size, rng) {
  for (let layoutAttempt = 0; layoutAttempt < 80; layoutAttempt += 1) {
    const regions = Array.from({ length: size }, () => []);
    const owner = new Map();
    const stripeIsRow = rng() < 0.5;
    const stripeIndex = Math.floor(rng() * size);
    const footholdSize = 2 + Math.floor(rng() * (size - 2)); // Always 2 through n - 1.
    const stripeStart = Math.floor(rng() * (size - footholdSize + 1));
    const anchorIndex = Math.floor(rng() * footholdSize);
    const stripe = [...Array(footholdSize).keys()].map((offset) => stripeIsRow
      ? { row: stripeIndex, col: stripeStart + offset }
      : { row: stripeStart + offset, col: stripeIndex });
    const capacities = [footholdSize, ...Array(size - 1).fill(size)];
    // The small foothold's missing cells make one or more other regions larger than n.
    for (let extra = 0; extra < size - footholdSize; extra += 1) {
      capacities[1 + Math.floor(rng() * (size - 1))] += 1;
    }
    const anchor = stripe[anchorIndex];

    // Put the anchor first so it receives the first target letter.
    regions[0].push(anchor, ...stripe.filter((square) => square !== anchor));
    stripe.forEach((square) => owner.set(cellKey(square.row, square.col), 0));

    const availableRows = [...Array(size).keys()].filter((row) => row !== anchor.row);
    const availableCols = [...Array(size).keys()].filter((col) => col !== anchor.col);
    const rows = shuffle(availableRows, rng);
    const cols = shuffle(availableCols, rng);
    for (let region = 1; region < size; region += 1) {
      const square = { row: rows[region - 1], col: cols[region - 1] };
      regions[region].push(square);
      owner.set(cellKey(square.row, square.col), region);
    }

    let stuck = false;
    while (regions.some((region, index) => region.length < capacities[index])) {
      const smallest = Math.min(...regions
        .filter((region, index) => region.length < capacities[index])
        .map((region) => region.length));
      const candidates = [];
      regions.forEach((region, index) => {
        if (region.length !== smallest || region.length >= capacities[index]) return;
        const growth = [];
        region.forEach((square) => getNeighbors(square.row, square.col, size).forEach(([row, col]) => {
          if (!owner.has(cellKey(row, col))) growth.push({ row, col });
        }));
        if (growth.length) candidates.push({ index, growth });
      });
      if (!candidates.length) { stuck = true; break; }
      const choice = candidates[Math.floor(rng() * candidates.length)];
      const square = choice.growth[Math.floor(rng() * choice.growth.length)];
      owner.set(cellKey(square.row, square.col), choice.index);
      regions[choice.index].push(square);
    }
    if (!stuck) return { regions, anchors: regions.map((region) => region[0]) };
  }
  return null;
}

function enumerateSignatures(board, regions, size, requiredSignature) {
  const found = new Map();
  const usedRows = new Set();
  const usedCols = new Set();
  const selected = [];
  const orderedRegions = regions.map((cells, region) => ({ region, cells }))
    .sort((left, right) => left.cells.length - right.cells.length);

  function visit(depth) {
    if (requiredSignature && found.has(requiredSignature)) return;
    if (depth === orderedRegions.length) {
      const key = signature(selected.map((square) => board[square.row][square.col]).join(""));
      if (!requiredSignature ? dictionary.signatures[size].has(key) : key === requiredSignature) {
        found.set(key, [...selected]);
      }
      return;
    }
    for (const square of orderedRegions[depth].cells) {
      if (usedRows.has(square.row) || usedCols.has(square.col)) continue;
      usedRows.add(square.row); usedCols.add(square.col); selected.push(square);
      visit(depth + 1);
      selected.pop(); usedRows.delete(square.row); usedCols.delete(square.col);
      if (requiredSignature && found.has(requiredSignature)) return;
    }
  }
  visit(0);
  return found;
}

function generatePuzzle(seed) {
  const rng = makeRng(seed);
  const size = 5 + Math.floor(rng() * 3);
  const words = dictionary.words[size];
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const layout = createRegions(size, rng);
    if (!layout) continue;
    const word = words[Math.floor(rng() * words.length)];
    const board = Array.from({ length: size }, () => Array(size).fill(""));
    layout.anchors.forEach((square, region) => { board[square.row][square.col] = word[region]; });
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!board[row][col]) board[row][col] = ALPHABET[Math.floor(rng() * ALPHABET.length)];
      }
    }
    const matches = enumerateSignatures(board, layout.regions, size);
    const wanted = signature(word);
    if (matches.has(wanted) && matches.size === 1) {
      return { seed, size, board, regions: layout.regions, target: word, solution: matches.get(wanted) };
    }
  }
  // A deterministic fallback remains playable even if a rare seed cannot be made unique quickly.
  const layout = createRegions(size, rng);
  const word = words[Math.floor(rng() * words.length)];
  const board = Array.from({ length: size }, () => Array(size).fill("A"));
  layout.anchors.forEach((square, region) => { board[square.row][square.col] = word[region]; });
  return { seed, size, board, regions: layout.regions, target: word, solution: layout.anchors };
}

function regionAt(row, col) {
  return game.regions.findIndex((region) => region.some((square) => square.row === row && square.col === col));
}

function squaresConflict(left, right) {
  return left.row === right.row || left.col === right.col || left.region === right.region;
}

function updateSelectionMarks() {
  const selectedSquares = [...game.selected.values()];
  elements.board.querySelectorAll(".cell").forEach((button) => {
    const square = {
      row: Number(button.dataset.row),
      col: Number(button.dataset.col),
      region: Number(button.dataset.region),
    };
    const selected = game.selected.has(cellKey(square.row, square.col));
    const crossedOut = !selected && selectedSquares.some((other) => squaresConflict(square, other));
    button.classList.toggle("candidate", selected);
    button.classList.toggle("marked", crossedOut);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `${game.board[square.row][square.col]}, region ${square.region + 1}, row ${square.row + 1}, column ${square.col + 1}${selected ? ", selected" : crossedOut ? ", crossed out" : ""}`);
  });
}

function selectSquare(row, col) {
  if (game.completed) return;
  const key = cellKey(row, col);
  if (game.selected.has(key)) {
    game.selected.delete(key);
  } else {
    const square = { row, col, region: regionAt(row, col) };
    for (const [selectedKey, selectedSquare] of game.selected) {
      if (squaresConflict(square, selectedSquare)) game.selected.delete(selectedKey);
    }
    game.selected.set(key, square);
  }
  updateSelectionMarks();
}

function renderBoard() {
  elements.board.replaceChildren();
  elements.board.style.setProperty("--grid-size", game.size);
  for (let row = 0; row < game.size; row += 1) {
    for (let col = 0; col < game.size; col += 1) {
      const region = regionAt(row, col);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.style.backgroundColor = COLORS[region];
      button.dataset.row = row;
      button.dataset.col = col;
      button.dataset.region = region;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `${game.board[row][col]}, region ${region + 1}, row ${row + 1}, column ${col + 1}`);
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `<span class="region-number" aria-hidden="true">${region + 1}</span><span>${game.board[row][col]}</span>`;
      button.addEventListener("click", () => selectSquare(row, col));
      elements.board.append(button);
    }
  }
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
}

function showSolution(squares) {
  for (const square of squares) {
    elements.board.querySelector(`[data-row="${square.row}"][data-col="${square.col}"]`)?.classList.add("solved");
  }
}

function validateGuess(event) {
  event.preventDefault();
  if (!game || game.completed) return;
  const word = elements.input.value.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(word) || word.length !== game.size) {
    setStatus(`Enter a ${game.size}-letter word.`, "error");
    return;
  }
  if (!dictionary.wordSets[game.size].has(word)) {
    setStatus("That word is not in the puzzle dictionary. Keep looking!", "error");
    return;
  }
  const matches = enumerateSignatures(game.board, game.regions, game.size, signature(word));
  const solution = matches.get(signature(word));
  if (!solution) {
    setStatus("That word cannot be made from a legal set of squares. Try again.", "error");
    return;
  }
  game.completed = true;
  showSolution(solution);
  elements.input.disabled = true;
  elements.button.disabled = true;
  elements.reset.disabled = true;
  setStatus(`You found ${word}! Brilliant.`, "success");
}

async function start() {
  try {
    const response = await fetch("assets/dictionary.json");
    if (!response.ok) throw new Error(`Dictionary request failed (${response.status})`);
    const words = await response.json();
    dictionary = { words: {}, wordSets: {}, signatures: {} };
    for (const size of [5, 6, 7]) {
      dictionary.words[size] = words[String(size)] || [];
      dictionary.wordSets[size] = new Set(dictionary.words[size]);
      dictionary.signatures[size] = new Set(dictionary.words[size].map(signature));
      if (!dictionary.words[size].length) throw new Error(`No ${size}-letter words were loaded`);
    }
    game = generatePuzzle(currentSeed());
    game.selected = new Map();
    renderBoard();
    elements.meta.textContent = `${game.size} regions · ${game.size}-letter word · seed ${game.seed}`;
    elements.input.maxLength = game.size;
    elements.input.placeholder = `${game.size}-LETTER WORD`;
    elements.input.disabled = false;
    elements.button.disabled = false;
    elements.reset.disabled = false;
    elements.input.focus();
  } catch (error) {
    console.error(error);
    elements.meta.textContent = "The puzzle could not load.";
    setStatus("Run the dictionary build step, then serve this folder through a local web server.", "error");
  }
}

elements.form.addEventListener("submit", validateGuess);
elements.reset.addEventListener("click", () => {
  if (!game || game.completed) return;
  game.selected.clear();
  elements.input.value = "";
  setStatus("");
  updateSelectionMarks();
  elements.input.focus();
});
start();
