'use client';

import { useState, useEffect, useReducer, useCallback } from 'react';
import { MAX_ATTEMPTS, calculateScore, type ScoreBreakdown } from '@/lib/game';
import { tokenizeWord } from '@/lib/tokenize';
import { decryptWord } from '@/lib/cipher';
import {
  gameReducer, INITIAL_STATE,
  type Language, type GameMode,
} from '@/lib/gameReducer';

// ── Public interface (flat — matches previous API, page.tsx unchanged) ─────

export interface GameState {
  targetWord: string;
  targetTokens: string[];
  wordLength: number;
  boardRow: number;
  startCol: number;
  hintPositions: Set<number>;
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
  showModal: boolean;
  language: Language;
  gameMode: GameMode;
}

export interface GameActions {
  setLanguage(lang: Language): void;
  setGameMode(mode: GameMode): void;
  setShowModal(show: boolean): void;
  addChar(ch: string): void;
  backspace(): void;
  submitGuess(): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'network' }>;
  resetGame(): Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────


function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

const STORAGE_VERSION = 2;

function storageKey(mode: GameMode, language: Language): string {
  return mode === 'daily'
    ? `anagramle-daily-${language}-${getTodayUTC()}`
    : `anagramle-game-state-${language}`;
}

function generateHints(tokens: string[]): number[] {
  if (tokens.length <= 7) return [];
  const numHints = tokens.length - 7;
  const available = Array.from({ length: tokens.length }, (_, i) => i);
  const hints: number[] = [];
  for (let i = 0; i < numHints; i++) {
    const idx = Math.floor(Math.random() * available.length);
    hints.push(available[idx]);
    available.splice(idx, 1);
  }
  return hints;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useGameState(): { state: GameState; actions: GameActions } {
  const [gs, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  // Init guards live outside the reducer — they're not game state
  const [languageInitialized, setLanguageInitialized] = useState(false);
  const [gameModeInitialized, setGameModeInitialized] = useState(false);

  // ── Language init ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || languageInitialized) return;
    const saved = localStorage.getItem('anagramle-language');
    if (saved === 'en' || saved === 'en-world' || saved === 'es') {
      dispatch({ type: 'LANGUAGE_CHANGED', language: saved });
    } else if (navigator.language.toLowerCase().startsWith('es')) {
      dispatch({ type: 'LANGUAGE_CHANGED', language: 'es' });
    }
    setLanguageInitialized(true);
  }, [languageInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && languageInitialized) {
      localStorage.setItem('anagramle-language', gs.config.language);
    }
  }, [gs.config.language, languageInitialized]);

  // ── Mode init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || gameModeInitialized) return;
    const saved = localStorage.getItem('anagramle-mode');
    if (saved === 'daily' || saved === 'practice') {
      dispatch({ type: 'MODE_CHANGED', mode: saved });
    }
    setGameModeInitialized(true);
  }, [gameModeInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && gameModeInitialized) {
      localStorage.setItem('anagramle-mode', gs.config.gameMode);
    }
  }, [gs.config.gameMode, gameModeInitialized]);

  // ── Save game state ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !gs.puzzle.targetWord || !gameModeInitialized) return;
    const key = storageKey(gs.config.loadedMode, gs.config.loadedLanguage);
    const { puzzle, board, config } = gs;
    localStorage.setItem(key, JSON.stringify({
      targetWord: puzzle.targetWord,
      targetTokens: puzzle.targetTokens,
      wordLength: puzzle.wordLength,
      boardRow: puzzle.boardRow,
      startCol: puzzle.startCol,
      hintPositions: Array.from(puzzle.hintPositions),
      guesses: board.guesses,
      guessTokens: board.guessTokens,
      currentGuess: board.currentGuess,
      currentGuessTokens: board.currentGuessTokens,
      currentRow: board.currentRow,
      gameOver: board.gameOver,
      won: board.won,
      guessScores: board.guessScores,
      scoreBreakdown: board.scoreBreakdown,
      language: config.loadedLanguage,
      v: STORAGE_VERSION,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.puzzle, gs.board, gs.config.loadedLanguage, gs.config.loadedMode, gameModeInitialized]);

  // ── Load / fetch word ────────────────────────────────────────────────
  useEffect(() => {
    const loadOrFetch = async () => {
      if (typeof window === 'undefined' || !languageInitialized || !gameModeInitialized) return;
      const { language, gameMode } = gs.config;
      const key = storageKey(gameMode, language);
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.v === STORAGE_VERSION && s.language === language) {
            dispatch({
              type: 'GAME_LOADED',
              payload: {
                targetWord: s.targetWord, targetTokens: s.targetTokens,
                wordLength: s.wordLength, boardRow: s.boardRow, startCol: s.startCol,
                hintPositions: s.hintPositions,
                guesses: s.guesses, guessTokens: s.guessTokens,
                currentGuess: s.currentGuess, currentGuessTokens: s.currentGuessTokens,
                currentRow: s.currentRow, gameOver: s.gameOver, won: s.won,
                guessScores: s.guessScores,
                scoreBreakdown: s.scoreBreakdown ?? null,
                mode: gameMode, language, showModal: s.gameOver ?? false,
              },
            });
            return;
          }
        } catch { /* fall through */ }
      }
      try {
        const modeParam = gameMode === 'daily' ? '&mode=daily' : '';
        const response = await fetch(`/api/word?language=${language}${modeParam}`);
        const data = await response.json();
        const newWord = decryptWord(data.data, data.key);
        const tokens = tokenizeWord(newWord, language);
        dispatch({
          type: 'GAME_LOADED',
          payload: {
            targetWord: newWord, targetTokens: tokens,
            wordLength: data.length, boardRow: data.boardRow, startCol: data.startCol,
            hintPositions: generateHints(tokens),
            mode: gameMode, language,
          },
        });
      } catch (err) {
        console.error('Failed to fetch word:', err);
      }
    };
    loadOrFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.config.language, gs.config.gameMode, languageInitialized, gameModeInitialized]);

  // ── Stable actions ───────────────────────────────────────────────────

  const addChar = useCallback((ch: string) => {
    dispatch({ type: 'CHAR_ADDED', char: ch });
  }, []);

  const backspace = useCallback(() => {
    dispatch({ type: 'BACKSPACE' });
  }, []);

  const submitGuess = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'network' }> => {
    // Capture state snapshot before the async gap
    const { currentGuess, currentGuessTokens, currentRow } = gs.board;
    const { targetWord, wordLength, boardRow, startCol } = gs.puzzle;
    const { language } = gs.config;

    if (currentGuessTokens.length !== wordLength) return { ok: false, reason: 'invalid' };

    try {
      const res = await fetch(`/api/validate?word=${encodeURIComponent(currentGuess)}&language=${language}`);
      const data = await res.json();
      if (!data.valid) return { ok: false, reason: 'invalid' };
    } catch {
      return { ok: false, reason: 'network' };
    }

    const score = calculateScore(currentGuess, boardRow, startCol, language);
    const isWon = currentGuess === targetWord;
    const isLastRow = currentRow === MAX_ATTEMPTS - 1;

    dispatch({ type: 'GUESS_ACCEPTED', score });

    if (isWon) {
      setTimeout(() => dispatch({ type: 'WIN_REVEALED' }), 1500);
    } else if (isLastRow) {
      setTimeout(() => dispatch({ type: 'GAME_OVER_REVEALED' }), 500);
    }

    return { ok: true };
  // gs changes on every render — that's intentional; we capture a consistent snapshot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs]);

  const resetGame = useCallback(async () => {
    const { gameMode, language } = gs.config;
    localStorage.removeItem(storageKey('practice', language));
    if (gameMode === 'daily') {
      dispatch({ type: 'MODE_CHANGED', mode: 'practice' });
      return;
    }
    try {
      const res = await fetch(`/api/word?language=${language}`);
      const data = await res.json();
      const newWord = decryptWord(data.data, data.key);
      const tokens = tokenizeWord(newWord, language);
      dispatch({
        type: 'GAME_LOADED',
        payload: {
          targetWord: newWord, targetTokens: tokens,
          wordLength: data.length, boardRow: data.boardRow, startCol: data.startCol,
          hintPositions: generateHints(tokens),
          mode: 'practice', language,
        },
      });
    } catch (err) {
      console.error('Failed to fetch word:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.config]);

  // ── Flatten grouped state for public interface ───────────────────────

  const state: GameState = {
    targetWord: gs.puzzle.targetWord,
    targetTokens: gs.puzzle.targetTokens,
    wordLength: gs.puzzle.wordLength,
    boardRow: gs.puzzle.boardRow,
    startCol: gs.puzzle.startCol,
    hintPositions: gs.puzzle.hintPositions,
    guesses: gs.board.guesses,
    guessTokens: gs.board.guessTokens,
    currentGuess: gs.board.currentGuess,
    currentGuessTokens: gs.board.currentGuessTokens,
    currentRow: gs.board.currentRow,
    gameOver: gs.board.gameOver,
    won: gs.board.won,
    guessScores: gs.board.guessScores,
    animatingRow: gs.board.animatingRow,
    scoreBreakdown: gs.board.scoreBreakdown,
    showModal: gs.showModal,
    language: gs.config.language,
    gameMode: gs.config.gameMode,
  };

  const actions: GameActions = {
    setLanguage: (lang) => dispatch({ type: 'LANGUAGE_CHANGED', language: lang }),
    setGameMode: (mode) => dispatch({ type: 'MODE_CHANGED', mode }),
    setShowModal: (show) => dispatch({ type: 'MODAL_SET', show }),
    addChar,
    backspace,
    submitGuess,
    resetGame,
  };

  return { state, actions };
}
