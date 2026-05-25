'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_ATTEMPTS = 6;

function decrypt(encryptedBase64: string, key: string): string {
  const encrypted = Buffer.from(encryptedBase64, 'base64').toString();
  let result = '';
  for (let i = 0; i < encrypted.length; i++) {
    result += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

const SCRABBLE_POINTS_EN: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

const SCRABBLE_POINTS_ES: Record<string, number> = {
  A: 1, E: 1, O: 1, I: 1, S: 1, N: 1, L: 1, R: 1, U: 1, T: 1,
  D: 2, G: 2, C: 2,
  B: 3, M: 3, P: 3,
  H: 4, F: 4, V: 4, Y: 4,
  Q: 5, CH: 5,
  J: 8, Ñ: 8, X: 8, LL: 8, RR: 8,
  Z: 10,
};

function tokenizeSpanishWord(word: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < word.length) {
    if (i < word.length - 1) {
      const twoChar = word.substring(i, i + 2);
      if (twoChar === 'CH' || twoChar === 'LL' || twoChar === 'RR') {
        tokens.push(twoChar);
        i += 2;
        continue;
      }
    }
    tokens.push(word[i]);
    i++;
  }
  return tokens;
}

const TRANSLATIONS = {
  en: {
    title: 'ANAGRAMLE',
    target: 'TARGET',
    guess: 'GUESS',
    thisGuess: 'This guess',
    victory: 'Victory!',
    gameOver: 'Game Over',
    youGuessed: 'You guessed the word!',
    theWordWas: 'The word was:',
    yourScore: 'Your',
    targetScore: 'Target',
    score: 'Score:',
    baseScore: 'Base Score:',
    attemptBonus: 'Attempt Bonus:',
    longWordBonus: 'Long Word Bonus:',
    finalScore: 'Final Score:',
    playAgain: 'Play Again',
    enter: 'Enter',
    delete: 'Del',
    howToPlay: 'How to Play',
    instructions: 'Guess the word in 6 tries. Each guess must be a valid word.',
    colorGuide: 'Color Guide:',
    correctPos: 'Letter is correct and in the right position',
    wrongPos: 'Letter is in the word but wrong position',
    notInWord: 'Letter is not in the word',
    scoringLabel: 'Scoring:',
    scoringInfo: 'Words are scored like Scrabble with multipliers. Words longer than 7 letters show hints (dimmed letters).',
    letterValues: 'Letter Values',
    boardMultipliers: 'Board Multipliers:',
    tripleWordScore: 'Triple Word Score',
    doubleWordScore: 'Double Word Score',
    tripleLetterScore: 'Triple Letter Score',
    doubleLetterScore: 'Double Letter Score',
    wordNotInDictionary: 'Word not in dictionary',
    validationFailed: 'Validation failed',
    multipliers: { TWS: '3W', DWS: '2W', TLS: '3L', DLS: '2L' },
    solved: 'Solved',
    outOfGuesses: 'Out of guesses',
    leftLabel: 'left',
    solvedLabel: 'solved',
    finishedLabel: 'finished',
    best: 'best',
    yourBest: 'your best · target',
    quickGuide: 'Guess the word in 6 tries with color-coded feedback (green = correct position, yellow = wrong position). Score points like Scrabble with letter values and board multipliers.',
  },
  es: {
    title: 'ANAGRAMLE',
    target: 'OBJETIVO',
    guess: 'INTENTO',
    thisGuess: 'Este intento',
    victory: '¡Felicitaciones!',
    gameOver: 'Fin del Juego',
    youGuessed: '¡Adivinaste la palabra!',
    theWordWas: 'La palabra era:',
    yourScore: 'Tu',
    targetScore: 'Objetivo',
    score: 'Puntuación:',
    baseScore: 'Puntuación Base:',
    attemptBonus: 'Bono por Intento:',
    longWordBonus: 'Bono Palabra Larga:',
    finalScore: 'Puntuación Final:',
    playAgain: 'Jugar de nuevo',
    enter: 'Enter',
    delete: 'Del',
    howToPlay: 'Cómo Jugar',
    instructions: 'Adivina la palabra en 6 intentos. Cada intento debe ser una palabra válida.',
    colorGuide: 'Guía de colores:',
    correctPos: 'La letra está correcta y en la posición correcta',
    wrongPos: 'La letra está en la palabra pero en posición incorrecta',
    notInWord: 'La letra no está en la palabra',
    scoringLabel: 'Puntuación:',
    scoringInfo: 'Las palabras se puntúan como Scrabble con multiplicadores. Palabras de más de 7 letras muestran pistas (letras atenuadas).',
    letterValues: 'Valores de Letras',
    boardMultipliers: 'Multiplicadores del Tablero:',
    tripleWordScore: 'Triple Palabra',
    doubleWordScore: 'Doble Palabra',
    tripleLetterScore: 'Triple Letra',
    doubleLetterScore: 'Doble Letra',
    wordNotInDictionary: 'La palabra no está en el diccionario',
    validationFailed: 'Validación fallida',
    multipliers: { TWS: '3P', DWS: '2P', TLS: '3L', DLS: '2L' },
    solved: 'Resuelto',
    outOfGuesses: 'Sin intentos',
    leftLabel: 'restantes',
    solvedLabel: 'resuelto',
    finishedLabel: 'terminado',
    best: 'mejor',
    yourBest: 'tu mejor · objetivo',
    quickGuide: 'Adivina la palabra en 6 intentos con feedback por color (verde = posición correcta, amarillo = posición incorrecta). Suma puntos como en Scrabble con valores de letras y multiplicadores del tablero.',
  },
};

type MultiplierType = 'TWS' | 'DWS' | 'TLS' | 'DLS' | null;

const SCRABBLE_BOARD: MultiplierType[][] = [
  ['TWS', null, null, 'DLS', null, null, null, 'TWS', null, null, null, 'DLS', null, null, 'TWS'],
  [null, 'DWS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'DWS', null],
  [null, null, 'DWS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DWS', null, null],
  ['DLS', null, null, 'DWS', null, null, null, 'DLS', null, null, null, 'DWS', null, null, 'DLS'],
  [null, null, null, null, 'DWS', null, null, null, null, null, 'DWS', null, null, null, null],
  [null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null],
  [null, null, 'DLS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DLS', null, null],
  ['TWS', null, null, 'DLS', null, null, null, 'DWS', null, null, null, 'DLS', null, null, 'TWS'],
  [null, null, 'DLS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DLS', null, null],
  [null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null],
  [null, null, null, null, 'DWS', null, null, null, null, null, 'DWS', null, null, null, null],
  ['DLS', null, null, 'DWS', null, null, null, 'DLS', null, null, null, 'DWS', null, null, 'DLS'],
  [null, null, 'DWS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DWS', null, null],
  [null, 'DWS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'DWS', null],
  ['TWS', null, null, 'DLS', null, null, null, 'TWS', null, null, null, 'DLS', null, null, 'TWS'],
];

const getMultipliers = (wordLength: number, boardRow: number, startCol: number = 0): MultiplierType[] => {
  const multipliers: MultiplierType[] = [];
  const row = SCRABBLE_BOARD[boardRow];
  for (let i = 0; i < wordLength; i++) {
    const col = startCol + i;
    multipliers.push(col < row.length ? row[col] : null);
  }
  return multipliers;
};

// ── Design theme (ink / dark) ─────────────────────────────────────────
const T = {
  bg: '#0F0F17',
  bgAlt: '#161622',
  fg: '#F4EFE2',
  fgSoft: '#9B9685',
  accent: '#FFB17A',
  correct: '#6FA75B',
  present: '#E0A94A',
  absent: '#3B3B45',
  tileEmpty: '#191923',
  tileBorder: '#2B2B36',
  tileShadow: 'rgba(0,0,0,0.5)',
  multTWS: '#E26A4A',
  multDWS: '#E89B72',
  multTLS: '#5C95B5',
  multDLS: '#85B5CC',
  kbdBg: '#23232F',
  kbdAbsent: '#1B1B23',
  chipBg: '#23232F',
  overlay: 'rgba(0,0,0,0.65)',
};

const MULT_LABEL: Record<string, string> = { TWS: '3W', DWS: '2W', TLS: '3L', DLS: '2L' };
const MULT_COLOR: Record<string, string> = {
  TWS: T.multTWS, DWS: T.multDWS, TLS: T.multTLS, DLS: T.multDLS,
};

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

// ── Tile ──────────────────────────────────────────────────────────────
function Tile({
  ch, state, multiplier, isCurrent, isHint, size, scrabblePoints,
}: {
  ch: string; state: LetterState; multiplier?: MultiplierType;
  isCurrent?: boolean; isHint?: boolean; size: number; scrabblePoints: Record<string, number>;
}) {
  const radius = Math.round(size * 0.18);
  const showChips = size >= 26;
  const multAccent = multiplier ? MULT_COLOR[multiplier] : undefined;
  const showMultChip = state === 'empty' && !!multAccent;
  const stateBg = state === 'correct' ? T.correct
    : state === 'present' ? T.present
    : state === 'absent' ? T.absent
    : T.tileEmpty;
  const stateFg = state === 'empty' ? T.fg : '#fff';

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      borderRadius: radius,
      background: stateBg,
      color: stateFg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-instrument-serif), Georgia, serif',
      fontWeight: 400,
      fontSize: Math.max(11, size * 0.55),
      lineHeight: 1,
      transition: 'background 240ms ease, color 240ms ease',
      boxShadow: state === 'empty'
        ? showMultChip
          ? `inset 0 0 0 1.5px ${multAccent}40, 0 1px 0 ${T.tileShadow}`
          : `inset 0 0 0 1px ${T.tileBorder}, 0 1px 0 ${T.tileShadow}`
        : `0 1px 0 ${T.tileShadow}, 0 2px 4px ${T.tileShadow}`,
      outline: isCurrent ? `2px solid ${T.accent}` : 'none',
      outlineOffset: 2,
      flexShrink: 0,
    }}>
      {showMultChip && showChips && multiplier && (
        <div style={{
          position: 'absolute',
          top: Math.max(2, size * 0.06), left: Math.max(2, size * 0.06),
          padding: '1px 5px',
          borderRadius: 999,
          background: multAccent,
          color: '#fff',
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontWeight: 600,
          fontSize: Math.max(8, size * 0.16),
          lineHeight: 1.1,
          letterSpacing: 0.2,
        }}>{MULT_LABEL[multiplier]}</div>
      )}
      {showMultChip && !showChips && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          width: 6, height: 6, borderRadius: 999,
          background: multAccent,
        }} />
      )}
      <span style={{ opacity: isHint ? 0.45 : 1, fontStyle: isHint ? 'italic' : 'normal' }}>
        {ch}
      </span>
      {ch && showChips && (
        <span style={{
          position: 'absolute',
          right: Math.max(4, size * 0.08), bottom: Math.max(2, size * 0.04),
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontWeight: 500, fontSize: Math.max(8, size * 0.16),
          opacity: state === 'empty' ? 0.55 : 0.85,
          color: state === 'empty' ? T.fg : '#fff',
        }}>{scrabblePoints[ch] || ''}</span>
      )}
    </div>
  );
}

// ── End overlay (bottom sheet) ────────────────────────────────────────
function EndOverlay({
  won, targetWord, finalScore, targetScore, attempts, onClose, onPlayAgain, t,
}: {
  won: boolean; targetWord: string; finalScore: number; targetScore: number;
  attempts: number; onClose: () => void; onPlayAgain: () => void;
  t: typeof TRANSLATIONS['en'];
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: T.overlay,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }} onClick={onClose}>
      {won && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const colors = [T.accent, T.correct, T.present, T.multTLS];
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 37) % 100}%`,
                top: -10,
                width: 8, height: 12,
                background: colors[i % colors.length],
                borderRadius: 2,
                animation: `confetti ${1800 + (i * 41) % 1200}ms linear ${(i * 73) % 600}ms forwards`,
              }} />
            );
          })}
        </div>
      )}
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%',
        background: T.bgAlt,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '28px 24px 48px',
        animation: 'sheetUp 360ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: `0 -8px 30px ${T.tileShadow}`,
        textAlign: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 4,
          background: T.tileBorder,
          margin: '0 auto 18px',
        }} />
        <div style={{
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontSize: 11, letterSpacing: 2,
          color: won ? T.correct : T.fgSoft,
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          {won ? `${t.solved} in ${attempts}` : t.outOfGuesses}
        </div>
        <h2 style={{
          margin: 0,
          fontFamily: 'var(--font-instrument-serif), Georgia, serif',
          fontSize: 44, lineHeight: 1,
          fontStyle: 'italic',
          letterSpacing: -1,
          color: T.fg,
        }}>{targetWord.toLowerCase()}</h2>
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'baseline',
          gap: 14, margin: '20px 0 6px',
        }}>
          <div style={{
            fontFamily: 'var(--font-instrument-serif), Georgia, serif',
            fontSize: 48, lineHeight: 1, color: T.fg,
          }}>{finalScore}</div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            fontSize: 12, color: T.fgSoft,
          }}>/ {targetScore}</div>
        </div>
        <div style={{
          fontSize: 13, color: T.fgSoft, marginBottom: 22,
        }}>{t.yourBest}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onPlayAgain} style={{
            flex: 1, maxWidth: 200,
            height: 50, borderRadius: 14,
            background: T.fg, color: T.bg,
            border: 'none',
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer',
          }}>{t.playAgain}</button>
          <button onClick={onClose} style={{
            flex: 1, maxWidth: 200,
            height: 50, borderRadius: 14,
            background: 'transparent', color: T.fg,
            border: `1.5px solid ${T.tileBorder}`,
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer',
          }}>Share</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function Home() {
  const [targetWord, setTargetWord] = useState('');
  const [targetTokens, setTargetTokens] = useState<string[]>([]);
  const [wordLength, setWordLength] = useState(0);
  const [boardRow, setBoardRow] = useState(0);
  const [startCol, setStartCol] = useState(0);
  const [hintPositions, setHintPositions] = useState<Set<number>>(new Set());
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_ATTEMPTS).fill(''));
  const [guessTokens, setGuessTokens] = useState<string[][]>(Array.from({ length: MAX_ATTEMPTS }, () => []));
  const [currentGuess, setCurrentGuess] = useState('');
  const [currentGuessTokens, setCurrentGuessTokens] = useState<string[]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [guessScores, setGuessScores] = useState<number[]>(Array(MAX_ATTEMPTS).fill(0));
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [language, setLanguage] = useState<'en' | 'en-world' | 'es'>('en');
  const [errorMessage, setErrorMessage] = useState('');
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [languageInitialized, setLanguageInitialized] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [attemptMultiplier, setAttemptMultiplier] = useState(1);
  const [scoreFlash, setScoreFlash] = useState(false);

  // Grid auto-sizing
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [tileSize, setTileSize] = useState(52);

  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const currentGuessRef = useRef('');
  currentGuessRef.current = currentGuess;

  const tr = TRANSLATIONS[language === 'en-world' ? 'en' : language];

  // ── Auto-size tiles ──────────────────────────────────────────────
  const measureTiles = useCallback(() => {
    if (!gridContainerRef.current || !wordLength) return;
    const w = gridContainerRef.current.getBoundingClientRect().width;
    if (w <= 0) return;
    const gap = wordLength <= 7 ? 6 : wordLength <= 10 ? 5 : 3;
    const px = Math.floor((w - gap * (wordLength - 1)) / wordLength);
    setTileSize(Math.min(64, Math.max(16, px)));
  }, [wordLength]);

  useEffect(() => {
    measureTiles();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measureTiles)
      : null;
    if (ro && gridContainerRef.current) ro.observe(gridContainerRef.current);
    window.addEventListener('resize', measureTiles);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureTiles);
    };
  }, [measureTiles]);

  // ── Language init ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !languageInitialized) {
      const saved = localStorage.getItem('anagramle-language');
      if (saved && (saved === 'en' || saved === 'en-world' || saved === 'es')) {
        setLanguage(saved as 'en' | 'en-world' | 'es');
      } else if (navigator.language.toLowerCase().startsWith('es')) {
        setLanguage('es');
      }
      setLanguageInitialized(true);
    }
  }, [languageInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && languageInitialized) {
      localStorage.setItem('anagramle-language', language);
    }
  }, [language, languageInitialized]);

  // ── Save game state ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && targetWord) {
      const gameState = {
        targetWord, targetTokens, wordLength, boardRow, startCol,
        hintPositions: Array.from(hintPositions),
        guesses, guessTokens, currentGuess, currentGuessTokens,
        currentRow, gameOver, won, guessScores, language, finalScore, attemptMultiplier,
      };
      localStorage.setItem('anagramle-game-state', JSON.stringify(gameState));
    }
  }, [targetWord, targetTokens, wordLength, boardRow, startCol, hintPositions, guesses, guessTokens, currentGuess, currentGuessTokens, currentRow, gameOver, won, guessScores, language, finalScore, attemptMultiplier]);

  // ── Load / fetch word ──────────────────────────────────────────────
  useEffect(() => {
    const loadOrFetch = async () => {
      if (typeof window === 'undefined' || !languageInitialized) return;
      const savedState = localStorage.getItem('anagramle-game-state');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          if (state.language === language) {
            setTargetWord(state.targetWord);
            setTargetTokens(state.targetTokens);
            setWordLength(state.wordLength);
            setBoardRow(state.boardRow);
            setStartCol(state.startCol);
            setHintPositions(new Set(state.hintPositions));
            setGuesses(state.guesses);
            setGuessTokens(state.guessTokens);
            setCurrentGuess(state.currentGuess);
            setCurrentGuessTokens(state.currentGuessTokens);
            setCurrentRow(state.currentRow);
            setGameOver(state.gameOver);
            setWon(state.won);
            setGuessScores(state.guessScores);
            setFinalScore(state.finalScore || 0);
            setAttemptMultiplier(state.attemptMultiplier || 1);
            if (state.gameOver) setShowModal(true);
            return;
          }
        } catch {
          // fall through to fetch
        }
      }
      try {
        const response = await fetch(`/api/word?language=${language}`);
        const data = await response.json();
        const newWord = decrypt(data.data, data.key);
        const tokens = language === 'es' ? tokenizeSpanishWord(newWord) : newWord.split('');
        setTargetWord(newWord);
        setTargetTokens(tokens);
        setWordLength(data.length);
        setBoardRow(data.boardRow);
        setStartCol(data.startCol);
        const hints = new Set<number>();
        if (tokens.length > 7) {
          const numHints = tokens.length - 7;
          const available = Array.from({ length: tokens.length }, (_, i) => i);
          for (let i = 0; i < numHints; i++) {
            const idx = Math.floor(Math.random() * available.length);
            hints.add(available[idx]);
            available.splice(idx, 1);
          }
        }
        setHintPositions(hints);
        setGuesses(Array(MAX_ATTEMPTS).fill(''));
        setGuessTokens(Array.from({ length: MAX_ATTEMPTS }, () => []));
        setCurrentGuess('');
        setCurrentGuessTokens([]);
        setCurrentRow(0);
        setGameOver(false);
        setWon(false);
        setGuessScores(Array(MAX_ATTEMPTS).fill(0));
      } catch (err) {
        console.error('Failed to fetch word:', err);
      }
    };
    loadOrFetch();
  }, [language, languageInitialized]);

  // ── Helpers ────────────────────────────────────────────────────────
  const getScrabblePoints = () => language === 'es' ? SCRABBLE_POINTS_ES : SCRABBLE_POINTS_EN;

  const tokenizeWord = (word: string) =>
    language === 'es' ? tokenizeSpanishWord(word) : word.split('');

  const calculateScore = (guess: string, row: number, col = 0): number => {
    if (!guess) return 0;
    let score = 0, wordMult = 1;
    const tokens = tokenizeWord(guess);
    const mults = getMultipliers(tokens.length, row, col);
    const pts = getScrabblePoints();
    tokens.forEach((tok, i) => {
      let v = pts[tok] || 0;
      const m = mults[i];
      if (m === 'DLS') v *= 2;
      else if (m === 'TLS') v *= 3;
      else if (m === 'DWS') wordMult *= 2;
      else if (m === 'TWS') wordMult *= 3;
      score += v;
    });
    return score * wordMult;
  };

  const getLetterState = (rowIndex: number, colIndex: number): LetterState => {
    const tokens = guessTokens[rowIndex];
    if (!tokens || tokens.length === 0 || rowIndex > currentRow) return 'empty';
    const token = tokens[colIndex];
    if (!token) return 'empty';
    if (targetTokens[colIndex] === token) return 'correct';
    const countInTarget = targetTokens.filter(t => t === token).length;
    if (countInTarget === 0) return 'absent';
    let correctCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === token && targetTokens[i] === token) correctCount++;
    }
    let presentBefore = 0;
    for (let i = 0; i < colIndex; i++) {
      if (tokens[i] === token && targetTokens[i] !== token) presentBefore++;
    }
    return correctCount + presentBefore < countInTarget ? 'present' : 'absent';
  };

  const getKeyboardLetterState = (letter: string): LetterState => {
    if (language === 'es' && (letter === 'W' || letter === 'K')) {
      for (let r = 0; r < currentRow; r++) {
        const tokens = guessTokens[r];
        if (!tokens) continue;
        for (let c = 0; c < tokens.length; c++) {
          if (tokens[c] === letter) return getLetterState(r, c);
        }
      }
      return 'absent';
    }
    let best: LetterState = 'empty';
    for (let r = 0; r < currentRow; r++) {
      const tokens = guessTokens[r];
      if (!tokens) continue;
      for (let c = 0; c < tokens.length; c++) {
        if (tokens[c] !== letter) continue;
        const st = getLetterState(r, c);
        if (st === 'correct') return 'correct';
        if (st === 'present') best = 'present';
        else if (st === 'absent' && best === 'empty') best = 'absent';
      }
    }
    return best;
  };

  // ── Input handlers ─────────────────────────────────────────────────
  const handleKey = (ch: string) => {
    if (gameOver) return;
    const newGuess = currentGuessRef.current + ch;
    if (language === 'es') {
      const tokens = tokenizeSpanishWord(newGuess);
      if (tokens.length <= wordLength) {
        setCurrentGuess(newGuess);
        setCurrentGuessTokens(tokens);
      }
    } else {
      if (newGuess.length <= wordLength) {
        setCurrentGuess(newGuess);
        setCurrentGuessTokens(newGuess.split(''));
      }
    }
  };

  const handleBackspace = () => {
    if (currentGuess.length === 0) return;
    if (language === 'es' && currentGuessTokens.length > 0) {
      const last = currentGuessTokens[currentGuessTokens.length - 1];
      setCurrentGuess(prev => prev.slice(0, -last.length));
      setCurrentGuessTokens(prev => prev.slice(0, -1));
    } else {
      setCurrentGuess(prev => prev.slice(0, -1));
      setCurrentGuessTokens(prev => prev.slice(0, -1));
    }
  };

  const handleSubmit = async () => {
    if (currentGuessTokens.length !== wordLength) return;
    try {
      const response = await fetch(`/api/validate?word=${encodeURIComponent(currentGuess)}&language=${language}`);
      const data = await response.json();
      if (!data.valid) {
        setErrorMessage(tr.wordNotInDictionary);
        setShakeRow(currentRow);
        setTimeout(() => { setErrorMessage(''); setShakeRow(null); }, 600);
        return;
      }
    } catch {
      setErrorMessage(tr.validationFailed);
      setShakeRow(currentRow);
      setTimeout(() => { setErrorMessage(''); setShakeRow(null); }, 600);
      return;
    }
    setErrorMessage('');
    const newGuesses = [...guesses];
    newGuesses[currentRow] = currentGuess;
    setGuesses(newGuesses);
    const newGuessTokensList = [...guessTokens];
    newGuessTokensList[currentRow] = currentGuessTokens;
    setGuessTokens(newGuessTokensList);
    const score = calculateScore(currentGuess, boardRow, startCol);
    const newScores = [...guessScores];
    newScores[currentRow] = score;
    setGuessScores(newScores);
    setScoreFlash(true);
    setTimeout(() => setScoreFlash(false), 600);
    if (currentGuess === targetWord) {
      setAnimatingRow(currentRow);
      const attemptNumber = currentRow + 1;
      const multiplier = 3.5 - attemptNumber * 0.5;
      let finalScoreValue = Math.round(score * multiplier);
      if (wordLength >= 7) finalScoreValue += 50;
      setAttemptMultiplier(multiplier);
      setFinalScore(finalScoreValue);
      setCurrentRow(currentRow + 1);
      setTimeout(() => {
        setWon(true);
        setGameOver(true);
        setAnimatingRow(null);
        setShowModal(true);
      }, 1500);
    } else if (currentRow === MAX_ATTEMPTS - 1) {
      setTimeout(() => { setGameOver(true); setShowModal(true); }, 500);
    } else {
      setCurrentRow(currentRow + 1);
    }
    setCurrentGuess('');
    setCurrentGuessTokens([]);
  };

  const resetGame = async () => {
    if (typeof window !== 'undefined') localStorage.removeItem('anagramle-game-state');
    try {
      const response = await fetch(`/api/word?language=${language}`);
      const data = await response.json();
      const newWord = decrypt(data.data, data.key);
      const tokens = language === 'es' ? tokenizeSpanishWord(newWord) : newWord.split('');
      setTargetWord(newWord);
      setTargetTokens(tokens);
      setWordLength(data.length);
      setBoardRow(data.boardRow);
      setStartCol(data.startCol);
      const hints = new Set<number>();
      if (tokens.length > 7) {
        const numHints = tokens.length - 7;
        const available = Array.from({ length: tokens.length }, (_, i) => i);
        for (let i = 0; i < numHints; i++) {
          const idx = Math.floor(Math.random() * available.length);
          hints.add(available[idx]);
          available.splice(idx, 1);
        }
      }
      setHintPositions(hints);
      setGuesses(Array(MAX_ATTEMPTS).fill(''));
      setGuessTokens(Array.from({ length: MAX_ATTEMPTS }, () => []));
      setCurrentGuess('');
      setCurrentGuessTokens([]);
      setCurrentRow(0);
      setGameOver(false);
      setWon(false);
      setGuessScores(Array(MAX_ATTEMPTS).fill(0));
      setAnimatingRow(null);
      setShowModal(false);
      setFinalScore(0);
      setAttemptMultiplier(1);
    } catch (err) {
      console.error('Failed to fetch word:', err);
    }
  };

  // ── Keyboard event listener ────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.key === 'Process') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (showLanguageDropdown) setShowLanguageDropdown(false);
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      else if (e.key === 'Backspace') { e.preventDefault(); handleBackspace(); }
      else if (/^[a-zA-ZñÑ]$/.test(e.key)) { e.preventDefault(); handleKey(e.key.toUpperCase()); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGuess, gameOver, currentRow, targetWord, wordLength, language, showLanguageDropdown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (showModal) { setShowModal(false); resetGame(); }
      } else if (e.key === 'Enter' && showModal) {
        setShowModal(false); resetGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHelp, showModal]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    if (showLanguageDropdown) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [showLanguageDropdown]);

  useEffect(() => {
    if (targetWord) resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Derived values ─────────────────────────────────────────────────
  const multipliers = wordLength ? getMultipliers(wordLength, boardRow, startCol) : [];
  const pts = getScrabblePoints();
  const currentGuessScore = calculateScore(currentGuess, boardRow, startCol);
  const targetWordScore = calculateScore(targetWord, boardRow, startCol);
  const hasUserInput = currentGuess.length > 0;

  // Best score among submitted rows
  let bestScore = 0;
  for (let r = 0; r < currentRow; r++) {
    bestScore = Math.max(bestScore, guessScores[r]);
  }

  // Gap between tiles (tighter for longer words)
  const gap = wordLength <= 7 ? 6 : wordLength <= 10 ? 5 : 3;

  // Keyboard rows
  const kbdRows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    language === 'es'
      ? ['A','S','D','F','G','H','J','K','L','Ñ']
      : ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M'],
  ];
  const digraphRow = language === 'es' ? ['CH', 'LL', 'RR'] : [];

  const kbdStateBg = (state: LetterState) =>
    state === 'correct' ? T.correct
    : state === 'present' ? T.present
    : state === 'absent' ? T.kbdAbsent
    : T.kbdBg;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebApplication",
                "@id": "https://anagramle.vercel.app/#webapp",
                "name": "Anagramle",
                "description": "A word puzzle game combining Wordle gameplay with Scrabble scoring.",
                "url": "https://anagramle.vercel.app",
                "applicationCategory": "Game",
                "operatingSystem": "Any",
                "inLanguage": ["en-US", "es-ES"],
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
              },
            ],
          })
        }}
      />

      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        height: '100svh',
        background: T.bg, color: T.fg,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <header style={{
          flexShrink: 0,
          padding: '16px 18px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: T.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 18, lineHeight: 1, fontStyle: 'italic',
              position: 'relative',
              boxShadow: `0 1px 0 ${T.tileShadow}`,
              flexShrink: 0,
            }}>
              a
              <span style={{
                position: 'absolute', right: 3, bottom: 2,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 7, fontWeight: 600, opacity: 0.85,
              }}>1</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 22, lineHeight: 1, fontStyle: 'italic',
              letterSpacing: -0.3,
            }}>anagramle</div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Language */}
            <div ref={languageDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                style={{
                  height: 28, padding: '0 10px',
                  background: T.chipBg, color: T.fg,
                  border: 'none', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  cursor: 'pointer',
                  boxShadow: `0 1px 0 ${T.tileShadow}`,
                  fontFamily: 'var(--font-geist-sans), sans-serif',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                <span>{language === 'es' ? '🇪🇸' : language === 'en-world' ? '🇬🇧' : '🇺🇸'}</span>
                <span style={{ fontSize: 8, color: T.fgSoft }}>{showLanguageDropdown ? '▲' : '▼'}</span>
              </button>
              {showLanguageDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: T.bgAlt,
                  border: `1px solid ${T.tileBorder}`,
                  borderRadius: 12, overflow: 'hidden',
                  zIndex: 50,
                  boxShadow: `0 8px 24px ${T.tileShadow}`,
                }}>
                  {(['en', 'en-world', 'es'] as const).map(lang => (
                    <button key={lang} onClick={() => { setLanguage(lang); setShowLanguageDropdown(false); }} style={{
                      display: 'block', width: '100%',
                      padding: '10px 16px',
                      background: language === lang ? T.chipBg : 'transparent',
                      color: T.fg, border: 'none',
                      cursor: 'pointer', fontSize: 18, textAlign: 'center',
                    }}>
                      {lang === 'en' ? '🇺🇸' : lang === 'en-world' ? '🇬🇧' : '🇪🇸'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Help */}
            <button
              onClick={() => setShowHelp(true)}
              style={{
                width: 28, height: 28, padding: 0,
                background: T.chipBg, color: T.fgSoft,
                border: 'none', borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                fontFamily: 'var(--font-instrument-serif), serif',
                fontSize: 16, fontStyle: 'italic',
                boxShadow: `0 1px 0 ${T.tileShadow}`,
              }}
            >?</button>
          </div>
        </header>

        {/* ── Score row ──────────────────────────────────────────────── */}
        <section style={{
          flexShrink: 0,
          padding: '8px 18px 10px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: 10, letterSpacing: 1.5, color: T.fgSoft,
              textTransform: 'uppercase', marginBottom: 2,
            }}>{tr.thisGuess}</div>
            <div className={scoreFlash ? 'score-flash' : ''} style={{
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 36, lineHeight: 1,
              color: hasUserInput ? T.fg : T.fgSoft,
              display: 'flex', alignItems: 'baseline', gap: 6,
              transformOrigin: 'left bottom',
            }}>
              {hasUserInput ? currentGuessScore : '—'}
              {bestScore > 0 && (
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  fontSize: 11, color: T.fgSoft, fontStyle: 'normal',
                }}>{tr.best} {bestScore}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: 10, letterSpacing: 1.5, color: T.fgSoft,
              textTransform: 'uppercase', marginBottom: 2,
            }}>{tr.target}</div>
            <div style={{
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 28, lineHeight: 1,
              color: T.correct, fontStyle: 'italic',
            }}>{targetWordScore || '—'}</div>
          </div>
        </section>

        {/* ── Attempt dots ────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: '0 18px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => {
              const used = i < currentRow;
              const isNext = i === currentRow && !gameOver;
              return (
                <span key={i} style={{
                  width: isNext ? 24 : 8, height: 4, borderRadius: 4,
                  background: used ? T.accent : isNext ? T.fg : T.tileBorder,
                  opacity: used ? 0.6 : 1,
                  transition: 'width 240ms ease, background 240ms ease',
                  display: 'block',
                }} />
              );
            })}
          </div>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            fontSize: 10, color: T.fgSoft, letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            {gameOver
              ? (won ? tr.solvedLabel : tr.finishedLabel)
              : `${MAX_ATTEMPTS - currentRow} ${tr.leftLabel}`}
          </span>
        </div>

        {/* ── Tile grid ───────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '0 18px', position: 'relative' }}>
          {errorMessage && (
            <div style={{
              position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
              zIndex: 20, padding: '6px 14px',
              background: T.bgAlt,
              border: `1px solid ${T.tileBorder}`,
              color: T.fg,
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 16px ${T.tileShadow}`,
            }}>
              {errorMessage}
            </div>
          )}
          <div ref={gridContainerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap }}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
              const isCurrent = rowIndex === currentRow && !gameOver;
              const isSubmitted = rowIndex < currentRow || (rowIndex === currentRow && gameOver && guessTokens[rowIndex]?.length > 0);
              const rowTokens = isCurrent ? currentGuessTokens : (guessTokens[rowIndex] || []);

              // Cursor: first unfilled position in current row
              const cursorCol = isCurrent
                ? (() => {
                    let typed = 0;
                    for (let ci = 0; ci < wordLength; ci++) {
                      if (typed >= currentGuessTokens.length) return ci;
                      typed++;
                    }
                    return -1;
                  })()
                : -1;

              return (
                <div key={rowIndex} style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${wordLength || 6}, minmax(0, 1fr))`,
                  gap,
                  animation: shakeRow === rowIndex ? 'shake 400ms ease' : undefined,
                }}>
                  {Array.from({ length: wordLength }).map((_, colIndex) => {
                    let ch = '';
                    let state: LetterState = 'empty';
                    let isHint = false;

                    if (isCurrent) {
                      ch = rowTokens[colIndex] || '';
                      if (!ch && hintPositions.has(colIndex)) {
                        ch = targetTokens[colIndex] || '';
                        isHint = true;
                      }
                    } else if (isSubmitted) {
                      ch = rowTokens[colIndex] || '';
                      state = getLetterState(rowIndex, colIndex);
                    }

                    const isAnimating = animatingRow === rowIndex;

                    return (
                      <Tile
                        key={colIndex}
                        ch={ch}
                        state={isSubmitted ? state : 'empty'}
                        multiplier={multipliers[colIndex]}
                        isCurrent={colIndex === cursorCol}
                        isHint={isHint}
                        size={tileSize}
                        scrabblePoints={pts}
                      />
                    );
                    void isAnimating;
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Flex spacer ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 8 }} />

        {/* ── Keyboard ────────────────────────────────────────────────── */}
        <section style={{ flexShrink: 0, padding: '8px 10px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {kbdRows.map((row, ri) => (
              <div key={ri} style={{
                display: 'flex', gap: 5,
                padding: ri === 1 ? '0 16px' : 0,
              }}>
                {ri === 2 && (
                  <button
                    onClick={handleSubmit}
                    style={{
                      flex: 1.6, height: 44, minWidth: 0, padding: 0,
                      borderRadius: 10, border: 'none',
                      background: T.kbdBg, color: T.fg,
                      fontWeight: 600, fontSize: 12,
                      textTransform: 'uppercase', letterSpacing: 0.8,
                      cursor: 'pointer',
                      boxShadow: `0 1px 0 ${T.tileShadow}`,
                    }}
                  >{tr.enter}</button>
                )}
                {row.map(L => {
                  const st = getKeyboardLetterState(L);
                  const bg = kbdStateBg(st);
                  const fg = st !== 'empty' ? '#fff' : T.fg;
                  return (
                    <button key={L} onClick={() => handleKey(L)} style={{
                      flex: 1, height: 44, minWidth: 0, padding: 0,
                      borderRadius: 10, border: 'none',
                      background: bg, color: fg,
                      fontWeight: 600,
                      fontSize: L.length > 1 ? 14 : 17,
                      position: 'relative',
                      cursor: 'pointer',
                      boxShadow: `0 1px 0 ${T.tileShadow}`,
                      transition: 'transform 80ms ease, background 200ms ease',
                    }}>
                      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {L}
                        {pts[L] !== undefined && (
                          <span style={{
                            position: 'absolute', bottom: -11, right: -9,
                            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                            fontSize: 9, fontWeight: 500, opacity: 0.65,
                          }}>{pts[L]}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {ri === 2 && (
                  <button onClick={handleBackspace} style={{
                    flex: 1.6, height: 44, minWidth: 0, padding: 0,
                    borderRadius: 10, border: 'none',
                    background: T.kbdBg, color: T.fg,
                    fontWeight: 600, fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: `0 1px 0 ${T.tileShadow}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
                      <path d="M7 1.5h12.5a1.5 1.5 0 011.5 1.5v10a1.5 1.5 0 01-1.5 1.5H7L1 8 7 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M10 5.5l5 5M15 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Digraph row for Spanish */}
            {digraphRow.length > 0 && (
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                {digraphRow.map(tok => {
                  const st = getKeyboardLetterState(tok);
                  const bg = kbdStateBg(st);
                  const fg = st !== 'empty' ? '#fff' : T.fg;
                  return (
                    <button key={tok} onClick={() => handleKey(tok)} style={{
                      width: 72, height: 44, padding: 0, flexShrink: 0,
                      borderRadius: 10, border: 'none',
                      background: bg, color: fg,
                      fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                      fontWeight: 600, fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: `0 1px 0 ${T.tileShadow}`,
                      transition: 'transform 80ms ease, background 200ms ease',
                    }}>{tok}</button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── End overlay ─────────────────────────────────────────────── */}
        {showModal && (
          <EndOverlay
            won={won}
            targetWord={targetWord}
            finalScore={won ? finalScore : 0}
            targetScore={targetWordScore}
            attempts={currentRow}
            onClose={() => setShowModal(false)}
            onPlayAgain={() => { setShowModal(false); resetGame(); }}
            t={tr}
          />
        )}

        {/* ── Help sheet ──────────────────────────────────────────────── */}
        {showHelp && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: T.overlay,
            display: 'flex', alignItems: 'flex-end',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }} onClick={() => setShowHelp(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%',
              background: T.bgAlt,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: '20px 24px 44px',
              animation: 'sheetUp 360ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: `0 -8px 30px ${T.tileShadow}`,
              maxHeight: '88vh',
              overflowY: 'auto',
            }}>
              {/* Pull handle */}
              <div style={{
                width: 36, height: 4, borderRadius: 4,
                background: T.tileBorder,
                margin: '0 auto 20px',
              }} />

              <h2 style={{
                fontFamily: 'var(--font-instrument-serif), serif',
                fontSize: 32, lineHeight: 1, fontStyle: 'italic', letterSpacing: -0.5,
                margin: '0 0 6px', color: T.fg,
              }}>{tr.howToPlay}</h2>
              <p style={{ color: T.fgSoft, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                {tr.quickGuide}
              </p>

              {/* Color guide */}
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: T.fgSoft, marginBottom: 10,
              }}>{tr.colorGuide}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {([
                  { bg: T.correct, ch: 'A', label: tr.correctPos },
                  { bg: T.present, ch: 'B', label: tr.wrongPos },
                  { bg: T.absent,  ch: 'C', label: tr.notInWord },
                ] as { bg: string; ch: string; label: string }[]).map(({ bg, ch, label }) => (
                  <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 7,
                      background: bg, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-instrument-serif), serif',
                      fontSize: 22, flexShrink: 0,
                      boxShadow: `0 2px 4px ${T.tileShadow}`,
                    }}>{ch}</div>
                    <span style={{ color: T.fgSoft, fontSize: 14, lineHeight: 1.4 }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Board multipliers */}
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: T.fgSoft, marginBottom: 10,
              }}>{tr.boardMultipliers}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 24 }}>
                {([
                  { color: T.multTWS, label: tr.multipliers.TWS, name: tr.tripleWordScore },
                  { color: T.multDWS, label: tr.multipliers.DWS, name: tr.doubleWordScore },
                  { color: T.multTLS, label: tr.multipliers.TLS, name: tr.tripleLetterScore },
                  { color: T.multDLS, label: tr.multipliers.DLS, name: tr.doubleLetterScore },
                ] as { color: string; label: string; name: string }[]).map(({ color, label, name }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: T.kbdBg, borderRadius: 10, padding: '10px 12px',
                  }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 999,
                      background: color, color: '#fff',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontWeight: 600, fontSize: 13, flexShrink: 0,
                    }}>{label}</span>
                    <span style={{ color: T.fgSoft, fontSize: 12, lineHeight: 1.3 }}>{name}</span>
                  </div>
                ))}
              </div>

              {/* Letter values */}
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: T.fgSoft, marginBottom: 10,
              }}>{tr.letterValues}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {Object.entries(pts)
                  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
                  .map(([letter, points]) => (
                    <div key={letter} style={{
                      aspectRatio: '1/1',
                      background: T.kbdBg, borderRadius: 7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-instrument-serif), serif',
                      fontSize: letter.length > 1 ? 12 : 18,
                      color: T.fg, position: 'relative',
                    }}>
                      {letter}
                      <span style={{
                        position: 'absolute', bottom: 3, right: 4,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 8, fontWeight: 600, opacity: 0.6, color: T.fgSoft,
                      }}>{points}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
