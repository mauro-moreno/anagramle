import { tokenizeWord } from './tokenize';

export const MAX_ATTEMPTS = 6;

export type LetterState = 'correct' | 'present' | 'absent' | 'empty';
export type MultiplierType = 'TWS' | 'DWS' | 'TLS' | 'DLS' | null;

export const SCRABBLE_POINTS_EN: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

export const SCRABBLE_POINTS_ES: Record<string, number> = {
  A: 1, E: 1, O: 1, I: 1, S: 1, N: 1, L: 1, R: 1, U: 1, T: 1,
  D: 2, G: 2, C: 2,
  B: 3, M: 3, P: 3,
  H: 4, F: 4, V: 4, Y: 4,
  Q: 5, CH: 5,
  J: 8, Ñ: 8, X: 8, LL: 8, RR: 8,
  Z: 10,
};

export function getScrabblePoints(language: 'en' | 'en-world' | 'es'): Record<string, number> {
  return language === 'es' ? SCRABBLE_POINTS_ES : SCRABBLE_POINTS_EN;
}

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

export function getMultipliers(wordLength: number, boardRow: number, startCol = 0): MultiplierType[] {
  const row = SCRABBLE_BOARD[boardRow];
  const result: MultiplierType[] = [];
  for (let i = 0; i < wordLength; i++) {
    const col = startCol + i;
    result.push(col < row.length ? row[col] : null);
  }
  return result;
}

export function calculateScore(
  guess: string,
  boardRow: number,
  startCol: number,
  language: 'en' | 'en-world' | 'es',
): number {
  if (!guess) return 0;
  const tokens = tokenizeWord(guess, language);
  const mults = getMultipliers(tokens.length, boardRow, startCol);
  const pts = getScrabblePoints(language);
  let score = 0, wordMult = 1;
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
}

export function evaluateGuess(guessTokens: string[], targetTokens: string[]): LetterState[] {
  return guessTokens.map((token, colIndex) => {
    if (targetTokens[colIndex] === token) return 'correct';
    const countInTarget = targetTokens.filter(t => t === token).length;
    if (countInTarget === 0) return 'absent';
    let correctCount = 0;
    for (let i = 0; i < guessTokens.length; i++) {
      if (guessTokens[i] === token && targetTokens[i] === token) correctCount++;
    }
    let presentBefore = 0;
    for (let i = 0; i < colIndex; i++) {
      if (guessTokens[i] === token && targetTokens[i] !== token) presentBefore++;
    }
    return correctCount + presentBefore < countInTarget ? 'present' : 'absent';
  });
}

export function evaluateKeyboard(
  allGuessTokens: string[][],
  targetTokens: string[],
): Map<string, LetterState> {
  const map = new Map<string, LetterState>();
  for (const guessTokens of allGuessTokens) {
    if (!guessTokens.length) continue;
    const rowStates = evaluateGuess(guessTokens, targetTokens);
    guessTokens.forEach((token, i) => {
      const incoming = rowStates[i];
      const current = map.get(token) ?? 'empty';
      if (incoming === 'correct') map.set(token, 'correct');
      else if (incoming === 'present' && current !== 'correct') map.set(token, 'present');
      else if (incoming === 'absent' && current === 'empty') map.set(token, 'absent');
    });
  }
  return map;
}
