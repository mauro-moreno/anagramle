import { calculateScore, computeFinalScore, MAX_ATTEMPTS, ScoreBreakdown } from './game';
import { tokenizeWord } from './tokenize';

// ── Domain types ───────────────────────────────────────────────────────────

export type Language = 'en' | 'en-world' | 'es';
export type GameMode = 'daily' | 'practice';

// ── Grouped state ──────────────────────────────────────────────────────────

export type PuzzleState = {
  targetWord: string;
  targetTokens: string[];
  wordLength: number;
  boardRow: number;
  startCol: number;
  hintPositions: Set<number>;
};

export type BoardState = {
  guesses: string[];
  guessTokens: string[][];
  currentGuess: string;
  currentGuessTokens: string[];
  currentRow: number;
  gameOver: boolean;
  won: boolean;
  guessScores: number[];
  animatingRow: number | null;
  scoreBreakdown: ScoreBreakdown | null;
};

export type ConfigState = {
  language: Language;
  gameMode: GameMode;
  loadedMode: GameMode;
  loadedLanguage: Language;
};

export type ReducerState = {
  puzzle: PuzzleState;
  board: BoardState;
  showModal: boolean;
  config: ConfigState;
};

// ── Initial values ─────────────────────────────────────────────────────────

const emptyBoard = (): BoardState => ({
  guesses: Array(MAX_ATTEMPTS).fill(''),
  guessTokens: Array.from({ length: MAX_ATTEMPTS }, () => []),
  currentGuess: '',
  currentGuessTokens: [],
  currentRow: 0,
  gameOver: false,
  won: false,
  guessScores: Array(MAX_ATTEMPTS).fill(0),
  animatingRow: null,
  scoreBreakdown: null,
});

export const INITIAL_STATE: ReducerState = {
  puzzle: { targetWord: '', targetTokens: [], wordLength: 0, boardRow: 0, startCol: 0, hintPositions: new Set() },
  board: emptyBoard(),
  showModal: false,
  config: { language: 'en', gameMode: 'daily', loadedMode: 'daily', loadedLanguage: 'en' },
};

// ── Actions ────────────────────────────────────────────────────────────────

export type GameLoadedPayload = {
  targetWord: string;
  targetTokens: string[];
  wordLength: number;
  boardRow: number;
  startCol: number;
  hintPositions: number[];
  mode: GameMode;
  language: Language;
  // Optional restore fields (absent = fresh board)
  guesses?: string[];
  guessTokens?: string[][];
  currentGuess?: string;
  currentGuessTokens?: string[];
  currentRow?: number;
  gameOver?: boolean;
  won?: boolean;
  guessScores?: number[];
  scoreBreakdown?: ScoreBreakdown | null;
  showModal?: boolean;
};

export type Action =
  | { type: 'CHAR_ADDED'; char: string }
  | { type: 'BACKSPACE' }
  | { type: 'GUESS_ACCEPTED'; score: number }
  | { type: 'WIN_REVEALED' }
  | { type: 'GAME_OVER_REVEALED' }
  | { type: 'GAME_LOADED'; payload: GameLoadedPayload }
  | { type: 'LANGUAGE_CHANGED'; language: Language }
  | { type: 'MODE_CHANGED'; mode: GameMode }
  | { type: 'MODAL_SET'; show: boolean };

// ── Reducer ────────────────────────────────────────────────────────────────

export function gameReducer(state: ReducerState, action: Action): ReducerState {
  switch (action.type) {

    case 'CHAR_ADDED': {
      if (state.board.gameOver) return state;
      const { language } = state.config;
      const { wordLength } = state.puzzle;
      const newGuess = state.board.currentGuess + action.char;
      if (language === 'es') {
        const tokens = tokenizeWord(newGuess, language);
        if (tokens.length > wordLength) return state;
        return { ...state, board: { ...state.board, currentGuess: newGuess, currentGuessTokens: tokens } };
      }
      if (newGuess.length > wordLength) return state;
      return { ...state, board: { ...state.board, currentGuess: newGuess, currentGuessTokens: newGuess.split('') } };
    }

    case 'BACKSPACE': {
      const { currentGuess, currentGuessTokens } = state.board;
      if (currentGuess.length === 0) return state;
      if (state.config.language === 'es' && currentGuessTokens.length > 0) {
        const last = currentGuessTokens[currentGuessTokens.length - 1];
        return { ...state, board: { ...state.board, currentGuess: currentGuess.slice(0, -last.length), currentGuessTokens: currentGuessTokens.slice(0, -1) } };
      }
      return { ...state, board: { ...state.board, currentGuess: currentGuess.slice(0, -1), currentGuessTokens: currentGuessTokens.slice(0, -1) } };
    }

    case 'GUESS_ACCEPTED': {
      const { currentGuess, currentGuessTokens, currentRow, guesses, guessTokens, guessScores } = state.board;
      const { targetWord, wordLength } = state.puzzle;

      const newGuesses = [...guesses]; newGuesses[currentRow] = currentGuess;
      const newGuessTokens = [...guessTokens]; newGuessTokens[currentRow] = currentGuessTokens;
      const newScores = [...guessScores]; newScores[currentRow] = action.score;

      const base: BoardState = {
        ...state.board,
        guesses: newGuesses,
        guessTokens: newGuessTokens,
        guessScores: newScores,
        currentGuess: '',
        currentGuessTokens: [],
        currentRow: currentRow + 1,
      };

      if (currentGuess === targetWord) {
        const breakdown = computeFinalScore(action.score, currentRow + 1, wordLength);
        return { ...state, board: { ...base, animatingRow: currentRow, scoreBreakdown: breakdown } };
      }

      return { ...state, board: base };
    }

    case 'WIN_REVEALED':
      return { ...state, board: { ...state.board, won: true, gameOver: true, animatingRow: null }, showModal: true };

    case 'GAME_OVER_REVEALED':
      return { ...state, board: { ...state.board, gameOver: true }, showModal: true };

    case 'GAME_LOADED': {
      const p = action.payload;
      const fresh = emptyBoard();
      return {
        puzzle: {
          targetWord: p.targetWord,
          targetTokens: p.targetTokens,
          wordLength: p.wordLength,
          boardRow: p.boardRow,
          startCol: p.startCol,
          hintPositions: new Set(p.hintPositions),
        },
        board: {
          guesses: p.guesses ?? fresh.guesses,
          guessTokens: p.guessTokens ?? fresh.guessTokens,
          currentGuess: p.currentGuess ?? '',
          currentGuessTokens: p.currentGuessTokens ?? [],
          currentRow: p.currentRow ?? 0,
          gameOver: p.gameOver ?? false,
          won: p.won ?? false,
          guessScores: p.guessScores ?? fresh.guessScores,
          animatingRow: null,
          scoreBreakdown: p.scoreBreakdown ?? null,
        },
        showModal: p.showModal ?? false,
        config: { ...state.config, loadedMode: p.mode, loadedLanguage: p.language },
      };
    }

    case 'LANGUAGE_CHANGED':
      return { ...state, config: { ...state.config, language: action.language } };

    case 'MODE_CHANGED':
      return { ...state, config: { ...state.config, gameMode: action.mode } };

    case 'MODAL_SET':
      return { ...state, showModal: action.show };

    default:
      return state;
  }
}

