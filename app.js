"use strict";

const COLORS = ["#ffb7a5", "#f7d878", "#bde2bb", "#9edbd4", "#adc8f5", "#d6b8eb", "#f2b8d2"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PUZZLE_SIZE = 5;
const MULTI_SIZE = 6;
const MAX_GENERATION_ATTEMPTS = 70;
const MULTI_GENERATION_ATTEMPTS = 1000;
const MULTI_MIN_WORDS = 8;
const MULTI_MAX_WORDS = 12;

const DIFFICULTY_TUNING = {
  easy: { label: "Easy", seedSuffix: "", minimumRegionSize: 1, singleCellChance: 0.16, minimumFootholdLength: 2, maximumFootholdLength: 4, threeFootholdThreshold: 0.18, twoFootholdThreshold: 0.62, showRegionNumbers: true },
  medium: { label: "Medium", seedSuffix: ":medium", minimumRegionSize: 2, singleCellChance: 0, minimumFootholdLength: 2, maximumFootholdLength: 4, threeFootholdThreshold: 0.18, twoFootholdThreshold: 0.62, showRegionNumbers: false },
  hard: { label: "Hard", seedSuffix: ":hard", minimumRegionSize: 3, singleCellChance: 0, minimumFootholdLength: 3, maximumFootholdLength: 4, threeFootholdThreshold: 0.18, twoFootholdThreshold: 0.62, showRegionNumbers: false },
};
const MULTI_REGION_TUNING = { minimumRegionSize: 6, singleCellChance: 0, minimumFootholdLength: 6, maximumFootholdLength: 6, threeFootholdThreshold: 0.25, twoFootholdThreshold: 0.6 };
const MULTI_FALLBACK_LETTERS = "ARJSVLRIOADMREBDSBEJTRRCHHSREJALKXST";

const elements = {
  board: document.querySelector("#board"), meta: document.querySelector("#puzzle-meta"), rulesTitle: document.querySelector("#rules-title"), rulesCopy: document.querySelector("#rules-copy"),
  difficultyTabs: [...document.querySelectorAll(".difficulty-tab")], reset: document.querySelector("#reset-button"), status: document.querySelector("#status"), selectionHelp: document.querySelector("#selection-help"),
  foundPanel: document.querySelector("#found-panel"), foundCount: document.querySelector("#found-count"), foundWords: document.querySelector("#found-words"),
};
let dictionary;
let game;

function hashSeed(value) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function makeRng(seedText) { let state = hashSeed(seedText); return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(items, rng) { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(rng() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
function signature(word) { return [...word].sort().join(""); }
function cellKey(row, col) { return `${row},${col}`; }
function utcDay() { return new Date().toISOString().slice(0, 10); }
function currentSeed() { const supplied = new URLSearchParams(window.location.search).get("seed"); return supplied && supplied.trim() ? supplied.trim() : utcDay(); }
function getNeighbors(row, col, size) { return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size); }

function createRegions(size, rng, tuning) {
  for (let layoutAttempt = 0; layoutAttempt < 80; layoutAttempt += 1) {
    const regions = Array.from({ length: size }, () => []); const owner = new Map();
    const footholdCount = rng() < tuning.threeFootholdThreshold ? 3 : rng() < tuning.twoFootholdThreshold ? 2 : 1;
    const lineLengths = []; const anchorRows = new Set(); const anchorCols = new Set(); let failed = false;
    for (let region = 0; region < footholdCount; region += 1) {
      let placed = false;
      for (let lineAttempt = 0; lineAttempt < 100 && !placed; lineAttempt += 1) {
        const minimumLength = Math.max(tuning.minimumRegionSize, tuning.minimumFootholdLength);
        const lineLength = tuning.singleCellChance > 0 && rng() < tuning.singleCellChance ? 1 : minimumLength + Math.floor(rng() * (tuning.maximumFootholdLength - minimumLength + 1));
        const stripeIsRow = rng() < 0.5; const stripeIndex = Math.floor(rng() * size); const stripeStart = Math.floor(rng() * (size - lineLength + 1));
        const line = [...Array(lineLength).keys()].map((offset) => stripeIsRow ? { row: stripeIndex, col: stripeStart + offset } : { row: stripeStart + offset, col: stripeIndex });
        if (line.some((square) => owner.has(cellKey(square.row, square.col)))) continue;
        const anchor = shuffle(line, rng).find((square) => !anchorRows.has(square.row) && !anchorCols.has(square.col)); if (!anchor) continue;
        regions[region].push(anchor, ...line.filter((square) => square !== anchor)); line.forEach((square) => owner.set(cellKey(square.row, square.col), region)); anchorRows.add(anchor.row); anchorCols.add(anchor.col); lineLengths.push(lineLength); placed = true;
      }
      if (!placed) { failed = true; break; }
    }
    if (failed) continue;
    const seedSquares = [];
    function placeRemainingSeeds(region) {
      if (region === size) return true;
      const candidates = [];
      for (const row of shuffle([...Array(size).keys()].filter((value) => !anchorRows.has(value)), rng)) for (const col of shuffle([...Array(size).keys()].filter((value) => !anchorCols.has(value)), rng)) if (!owner.has(cellKey(row, col))) candidates.push({ row, col });
      for (const square of candidates) { anchorRows.add(square.row); anchorCols.add(square.col); seedSquares.push(square); if (placeRemainingSeeds(region + 1)) return true; seedSquares.pop(); anchorRows.delete(square.row); anchorCols.delete(square.col); }
      return false;
    }
    if (!placeRemainingSeeds(footholdCount)) continue;
    seedSquares.forEach((square, index) => { const region = footholdCount + index; regions[region].push(square); owner.set(cellKey(square.row, square.col), region); });
    const capacities = [...lineLengths, ...Array(size - footholdCount).fill(size)];
    const extraCells = (footholdCount * size) - lineLengths.reduce((total, length) => total + length, 0);
    for (let extra = 0; extra < extraCells; extra += 1) capacities[footholdCount + Math.floor(rng() * (size - footholdCount))] += 1;
    let stuck = false;
    while (regions.some((region, index) => region.length < capacities[index])) {
      const smallest = Math.min(...regions.filter((region, index) => region.length < capacities[index]).map((region) => region.length)); const candidates = [];
      regions.forEach((region, index) => { if (region.length !== smallest || region.length >= capacities[index]) return; const growth = []; region.forEach((square) => getNeighbors(square.row, square.col, size).forEach(([row, col]) => { if (!owner.has(cellKey(row, col))) growth.push({ row, col }); })); if (growth.length) candidates.push({ index, growth }); });
      if (!candidates.length) { stuck = true; break; }
      const choice = candidates[Math.floor(rng() * candidates.length)]; const square = choice.growth[Math.floor(rng() * choice.growth.length)]; owner.set(cellKey(square.row, square.col), choice.index); regions[choice.index].push(square);
    }
    if (!stuck) return { regions, anchors: regions.map((region) => region[0]) };
  }
  return null;
}

function enumerateSignatures(board, regions, size, allowedSignatures, requiredSignature) {
  const found = new Map(); const usedRows = new Set(); const usedCols = new Set(); const selected = [];
  const orderedRegions = regions.map((cells, region) => ({ region, cells })).sort((left, right) => left.cells.length - right.cells.length);
  function visit(depth) {
    if (requiredSignature && found.has(requiredSignature)) return;
    if (depth === orderedRegions.length) { const key = signature(selected.map((square) => board[square.row][square.col]).join("")); if (allowedSignatures.has(key) && (!requiredSignature || key === requiredSignature)) found.set(key, [...selected]); return; }
    for (const square of orderedRegions[depth].cells) { if (usedRows.has(square.row) || usedCols.has(square.col)) continue; usedRows.add(square.row); usedCols.add(square.col); selected.push(square); visit(depth + 1); selected.pop(); usedRows.delete(square.row); usedCols.delete(square.col); if (requiredSignature && found.has(requiredSignature)) return; }
  }
  visit(0); return found;
}
function countLegalSelections(regions, size, minimum) {
  const usedRows = new Set(); const usedCols = new Set(); let count = 0;
  function visit(region) { if (count >= minimum) return; if (region === size) { count += 1; return; } for (const square of regions[region]) { if (usedRows.has(square.row) || usedCols.has(square.col)) continue; usedRows.add(square.row); usedCols.add(square.col); visit(region + 1); usedRows.delete(square.row); usedCols.delete(square.col); } }
  visit(0); return count;
}
function weightedLetters(size) { return dictionary.targetWords[size].flatMap((word) => [...word]); }

function generatePuzzle(seed, difficulty) {
  const rng = makeRng(seed); const size = PUZZLE_SIZE; const tuning = DIFFICULTY_TUNING[difficulty]; const words = dictionary.targetWords[size];
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const layout = createRegions(size, rng, tuning); if (!layout) continue; const word = words[Math.floor(rng() * words.length)]; const board = Array.from({ length: size }, () => Array(size).fill(""));
    layout.anchors.forEach((square, region) => { board[square.row][square.col] = word[region]; }); for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) if (!board[row][col]) board[row][col] = ALPHABET[Math.floor(rng() * ALPHABET.length)];
    const matches = enumerateSignatures(board, layout.regions, size, dictionary.signatures[size]); const wanted = signature(word);
    if (matches.has(wanted) && matches.size === 1) return { seed, difficulty, size, board, regions: layout.regions, target: word, solution: matches.get(wanted), mode: "single" };
  }
  const layout = createRegions(size, rng, tuning); const word = words[Math.floor(rng() * words.length)]; const board = Array.from({ length: size }, () => Array(size).fill("A")); layout.anchors.forEach((square, region) => { board[square.row][square.col] = word[region]; });
  return { seed, difficulty, size, board, regions: layout.regions, target: word, solution: layout.anchors, mode: "single" };
}
function multiFallback() {
  const board = Array.from({ length: MULTI_SIZE }, (_, row) => [...MULTI_FALLBACK_LETTERS.slice(row * MULTI_SIZE, (row + 1) * MULTI_SIZE)]);
  const regions = Array.from({ length: MULTI_SIZE }, (_, row) => Array.from({ length: MULTI_SIZE }, (_, col) => ({ row, col })));
  return { size: MULTI_SIZE, board, regions, matches: enumerateSignatures(board, regions, MULTI_SIZE, dictionary.targetSignatures[MULTI_SIZE]), mode: "multi" };
}
function generateMultiPuzzle(seed) {
  const rng = makeRng(`${seed}:multi`); const letters = weightedLetters(MULTI_SIZE);
  for (let attempt = 0; attempt < MULTI_GENERATION_ATTEMPTS; attempt += 1) {
    const layout = createRegions(MULTI_SIZE, rng, MULTI_REGION_TUNING); if (!layout || countLegalSelections(layout.regions, MULTI_SIZE, 160) < 160) continue;
    const board = Array.from({ length: MULTI_SIZE }, () => Array.from({ length: MULTI_SIZE }, () => letters[Math.floor(rng() * letters.length)]));
    const matches = enumerateSignatures(board, layout.regions, MULTI_SIZE, dictionary.targetSignatures[MULTI_SIZE]);
    if (matches.size >= MULTI_MIN_WORDS && matches.size <= MULTI_MAX_WORDS) return { seed, size: MULTI_SIZE, board, regions: layout.regions, matches, mode: "multi" };
  }
  return { seed, ...multiFallback() };
}

function regionAt(row, col) { return game.regions.findIndex((region) => region.some((square) => square.row === row && square.col === col)); }
function squaresConflict(left, right) { return left.row === right.row || left.col === right.col || left.region === right.region; }
function updateSelectionMarks() {
  const selectedSquares = [...game.selected.values()];
  elements.board.querySelectorAll(".cell").forEach((button) => { const square = { row: Number(button.dataset.row), col: Number(button.dataset.col), region: Number(button.dataset.region) }; const selected = game.selected.has(cellKey(square.row, square.col)); const crossedOut = !selected && selectedSquares.some((other) => squaresConflict(square, other)); button.classList.toggle("candidate", selected); button.classList.toggle("marked", crossedOut); button.setAttribute("aria-pressed", String(selected)); const regionLabel = game.mode === "single" && DIFFICULTY_TUNING[game.difficulty].showRegionNumbers ? `, region ${square.region + 1}` : ""; button.setAttribute("aria-label", `${game.board[square.row][square.col]}${regionLabel}, row ${square.row + 1}, column ${square.col + 1}${selected ? ", selected" : crossedOut ? ", crossed out" : ""}`); });
}
function selectSquare(row, col) {
  if (game.mode === "single" && game.completed) return; const key = cellKey(row, col);
  if (game.selected.has(key)) game.selected.delete(key); else { const square = { row, col, region: regionAt(row, col) }; for (const [selectedKey, selectedSquare] of game.selected) if (squaresConflict(square, selectedSquare)) game.selected.delete(selectedKey); game.selected.set(key, square); }
  if (game.selected.size < game.size) setStatus(""); updateSelectionMarks(); validateSelection();
}
function renderBoard() {
  elements.board.replaceChildren(); elements.board.style.setProperty("--grid-size", game.size);
  for (let row = 0; row < game.size; row += 1) for (let col = 0; col < game.size; col += 1) { const region = regionAt(row, col); const button = document.createElement("button"); button.type = "button"; button.className = "cell"; button.style.backgroundColor = COLORS[region]; button.dataset.row = row; button.dataset.col = col; button.dataset.region = region; button.setAttribute("role", "gridcell"); const showNumber = game.mode === "single" && DIFFICULTY_TUNING[game.difficulty].showRegionNumbers; button.setAttribute("aria-label", `${game.board[row][col]}${showNumber ? `, region ${region + 1}` : ""}, row ${row + 1}, column ${col + 1}`); button.setAttribute("aria-pressed", "false"); button.innerHTML = `${showNumber ? `<span class="region-number" aria-hidden="true">${region + 1}</span>` : ""}<span>${game.board[row][col]}</span>`; button.addEventListener("click", () => selectSquare(row, col)); elements.board.append(button); }
}
function setStatus(message, type = "") { elements.status.textContent = message; elements.status.className = `status ${type}`; }
function flashSolution(squares) { for (const square of squares) elements.board.querySelector(`[data-row="${square.row}"][data-col="${square.col}"]`)?.classList.add("solved"); if (game.mode === "multi") window.setTimeout(() => elements.board.querySelectorAll(".solved").forEach((cell) => cell.classList.remove("solved")), 700); }
function updateFoundWords() { elements.foundCount.textContent = `${game.found.size} found`; elements.foundWords.replaceChildren(...[...game.found.values()].sort().map((word) => { const item = document.createElement("li"); item.textContent = word; return item; })); }
function validateSelection() {
  if (!game || (game.mode === "single" && game.completed) || game.selected.size !== game.size) return;
  const selectedSquares = [...game.selected.values()]; const key = signature(selectedSquares.map((square) => game.board[square.row][square.col]).join(""));
  if (game.mode === "multi") { const word = dictionary.targetWordBySignature[MULTI_SIZE].get(key); if (!word) { setStatus("Those letters are not one of today's familiar words. Try another selection.", "error"); return; } if (game.found.has(key)) { game.selected.clear(); updateSelectionMarks(); setStatus(`${word} is already on your list.`, "error"); return; } game.found.set(key, word); flashSolution(selectedSquares); game.selected.clear(); updateSelectionMarks(); updateFoundWords(); setStatus(`Found ${word}! ${game.found.size} found.`, "success"); return; }
  const word = dictionary.wordsBySignature[game.size].get(key); if (!word) { setStatus("Those letters do not form a word in the puzzle dictionary. Try another selection.", "error"); return; } const displayWord = dictionary.targetWordBySignature[game.size].get(key) || game.target || word; game.completed = true; flashSolution(selectedSquares); elements.reset.disabled = true; setStatus(`You found ${displayWord}! Brilliant.`, "success");
}
async function start() {
  try {
    const response = await fetch("assets/dictionary.json"); if (!response.ok) throw new Error(`Dictionary request failed (${response.status})`); const payload = await response.json(); const words = payload.words || payload; const targets = payload.targets || words;
    dictionary = { words: {}, targetWords: {}, signatures: {}, targetSignatures: {}, wordsBySignature: {}, targetWordBySignature: {} };
    for (const size of [PUZZLE_SIZE, MULTI_SIZE]) { dictionary.words[size] = words[String(size)] || []; dictionary.targetWords[size] = targets[String(size)] || []; dictionary.signatures[size] = new Set(dictionary.words[size].map(signature)); dictionary.targetSignatures[size] = new Set(dictionary.targetWords[size].map(signature)); dictionary.wordsBySignature[size] = new Map(); dictionary.targetWordBySignature[size] = new Map(); dictionary.words[size].forEach((word) => { const key = signature(word); if (!dictionary.wordsBySignature[size].has(key)) dictionary.wordsBySignature[size].set(key, word); }); dictionary.targetWords[size].forEach((word) => { const key = signature(word); if (!dictionary.targetWordBySignature[size].has(key)) dictionary.targetWordBySignature[size].set(key, word); }); if (!dictionary.words[size].length || !dictionary.targetWords[size].length) throw new Error(`No ${size}-letter words were loaded`); }
    selectDifficulty("easy");
  } catch (error) { console.error(error); elements.meta.textContent = "The puzzle could not load."; setStatus("Run the dictionary build step, then serve this folder through a local web server.", "error"); }
}
function selectDifficulty(difficulty) {
  if (!dictionary) return; const baseSeed = currentSeed(); const isMulti = difficulty === "multi";
  game = isMulti ? generateMultiPuzzle(baseSeed) : generatePuzzle(`${baseSeed}${DIFFICULTY_TUNING[difficulty].seedSuffix}`, difficulty); game.difficulty = difficulty; game.selected = new Map(); if (isMulti) game.found = new Map();
  renderBoard(); elements.meta.textContent = isMulti ? `Multi · 6 regions · six-letter words · seed ${baseSeed}` : `${DIFFICULTY_TUNING[difficulty].label} · ${game.size} regions · ${game.size}-letter word · seed ${baseSeed}`;
  elements.rulesTitle.textContent = isMulti ? "Find as many words as you can" : "Find one letter from every region"; elements.rulesCopy.textContent = "Choose one letter from each colored region. No two chosen letters can share a row or column."; elements.selectionHelp.textContent = isMulti ? "Choose six letters. Familiar words are submitted automatically." : "Choose five letters. A valid word is submitted automatically.";
  elements.foundPanel.hidden = !isMulti; if (isMulti) updateFoundWords(); elements.reset.disabled = false; setStatus(""); elements.difficultyTabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.difficulty === difficulty)));
}
elements.difficultyTabs.forEach((tab) => tab.addEventListener("click", () => selectDifficulty(tab.dataset.difficulty)));
elements.reset.addEventListener("click", () => { if (!game || (game.mode === "single" && game.completed)) return; game.selected.clear(); setStatus(""); updateSelectionMarks(); });
start();
