'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateScore, MAX_ATTEMPTS } from '@/lib/game';
import { tokenizeWord } from '@/lib/tokenize';

function decrypt(encryptedBase64: string, key: string): string {
  const encrypted = Buffer.from(encryptedBase64, 'base64').toString();
  let result = '';
  for (let i = 0; i < encrypted.length; i++) {
    result += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function generateHints(tokens: string[]): Set<number> {
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
  return hints;
}

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
  finalScore: number;
  attemptMultiplier: number;
  showModal: boolean;
  language: 'en' | 'en-world' | 'es';
  gameMode: 'daily' | 'practice';
}

export interface GameActions {
  setLanguage(lang: 'en' | 'en-world' | 'es'): void;
  setGameMode(mode: 'daily' | 'practice'): void;
  setShowModal(show: boolean): void;
  addChar(ch: string): void;
  backspace(): void;
  submitGuess(): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'network' }>;
  resetGame(): Promise<void>;
}

export function useGameState(): { state: GameState; actions: GameActions } {
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
  const [language, setLanguageState] = useState<'en' | 'en-world' | 'es'>('en');
  const [gameMode, setGameModeState] = useState<'daily' | 'practice'>('daily');
  const [finalScore, setFinalScore] = useState(0);
  const [attemptMultiplier, setAttemptMultiplier] = useState(1);
  const [languageInitialized, setLanguageInitialized] = useState(false);
  const [gameModeInitialized, setGameModeInitialized] = useState(false);
  const [loadedMode, setLoadedMode] = useState<'daily' | 'practice'>('daily');

  // Refs for action functions so they stay stable across renders
  const currentGuessRef = useRef('');
  const currentGuessTokensRef = useRef<string[]>([]);
  const wordLengthRef = useRef(0);
  const languageRef = useRef<'en' | 'en-world' | 'es'>('en');
  const gameOverRef = useRef(false);
  const currentRowRef = useRef(0);
  const guessesRef = useRef<string[]>(Array(MAX_ATTEMPTS).fill(''));
  const guessTokensRef = useRef<string[][]>(Array.from({ length: MAX_ATTEMPTS }, () => []));
  const guessScoresRef = useRef<number[]>(Array(MAX_ATTEMPTS).fill(0));
  const boardRowRef = useRef(0);
  const startColRef = useRef(0);
  const targetWordRef = useRef('');
  const gameModeRef = useRef<'daily' | 'practice'>('daily');

  currentGuessRef.current = currentGuess;
  currentGuessTokensRef.current = currentGuessTokens;
  wordLengthRef.current = wordLength;
  languageRef.current = language;
  gameOverRef.current = gameOver;
  currentRowRef.current = currentRow;
  guessesRef.current = guesses;
  guessTokensRef.current = guessTokens;
  guessScoresRef.current = guessScores;
  boardRowRef.current = boardRow;
  startColRef.current = startCol;
  targetWordRef.current = targetWord;
  gameModeRef.current = gameMode;

  // ── Language init ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !languageInitialized) {
      const saved = localStorage.getItem('anagramle-language');
      if (saved && (saved === 'en' || saved === 'en-world' || saved === 'es')) {
        setLanguageState(saved as 'en' | 'en-world' | 'es');
      } else if (navigator.language.toLowerCase().startsWith('es')) {
        setLanguageState('es');
      }
      setLanguageInitialized(true);
    }
  }, [languageInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && languageInitialized) {
      localStorage.setItem('anagramle-language', language);
    }
  }, [language, languageInitialized]);

  // ── Mode init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !gameModeInitialized) {
      const saved = localStorage.getItem('anagramle-mode');
      if (saved === 'daily' || saved === 'practice') setGameModeState(saved);
      setGameModeInitialized(true);
    }
  }, [gameModeInitialized]);

  useEffect(() => {
    if (typeof window !== 'undefined' && gameModeInitialized) {
      localStorage.setItem('anagramle-mode', gameMode);
    }
  }, [gameMode, gameModeInitialized]);

  // ── Save game state ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && targetWord && gameModeInitialized) {
      const key = loadedMode === 'daily'
        ? `anagramle-daily-${language}-${getTodayUTC()}`
        : 'anagramle-game-state';
      const gameState = {
        targetWord, targetTokens, wordLength, boardRow, startCol,
        hintPositions: Array.from(hintPositions),
        guesses, guessTokens, currentGuess, currentGuessTokens,
        currentRow, gameOver, won, guessScores, language, finalScore, attemptMultiplier,
      };
      localStorage.setItem(key, JSON.stringify(gameState));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWord, targetTokens, wordLength, boardRow, startCol, hintPositions, guesses, guessTokens, currentGuess, currentGuessTokens, currentRow, gameOver, won, guessScores, language, finalScore, attemptMultiplier, loadedMode, gameModeInitialized]);

  // ── Load / fetch word ──────────────────────────────────────────────
  useEffect(() => {
    const loadOrFetch = async () => {
      if (typeof window === 'undefined' || !languageInitialized || !gameModeInitialized) return;
      const key = gameMode === 'daily'
        ? `anagramle-daily-${language}-${getTodayUTC()}`
        : 'anagramle-game-state';
      const savedState = localStorage.getItem(key);
      if (savedState) {
        try {
          const s = JSON.parse(savedState);
          if (s.language === language) {
            setTargetWord(s.targetWord);
            setTargetTokens(s.targetTokens);
            setWordLength(s.wordLength);
            setBoardRow(s.boardRow);
            setStartCol(s.startCol);
            setHintPositions(new Set(s.hintPositions));
            setGuesses(s.guesses);
            setGuessTokens(s.guessTokens);
            setCurrentGuess(s.currentGuess);
            setCurrentGuessTokens(s.currentGuessTokens);
            setCurrentRow(s.currentRow);
            setGameOver(s.gameOver);
            setWon(s.won);
            setGuessScores(s.guessScores);
            setFinalScore(s.finalScore || 0);
            setAttemptMultiplier(s.attemptMultiplier || 1);
            setLoadedMode(gameMode);
            if (s.gameOver) setShowModal(true);
            return;
          }
        } catch {
          // fall through to fetch
        }
      }
      try {
        const modeParam = gameMode === 'daily' ? '&mode=daily' : '';
        const response = await fetch(`/api/word?language=${language}${modeParam}`);
        const data = await response.json();
        const newWord = decrypt(data.data, data.key);
        const tokens = tokenizeWord(newWord, language);
        setTargetWord(newWord);
        setTargetTokens(tokens);
        setWordLength(data.length);
        setBoardRow(data.boardRow);
        setStartCol(data.startCol);
        setHintPositions(generateHints(tokens));
        setGuesses(Array(MAX_ATTEMPTS).fill(''));
        setGuessTokens(Array.from({ length: MAX_ATTEMPTS }, () => []));
        setCurrentGuess('');
        setCurrentGuessTokens([]);
        setCurrentRow(0);
        setGameOver(false);
        setWon(false);
        setGuessScores(Array(MAX_ATTEMPTS).fill(0));
        setFinalScore(0);
        setAttemptMultiplier(1);
        setAnimatingRow(null);
        setShowModal(false);
        setLoadedMode(gameMode);
      } catch (err) {
        console.error('Failed to fetch word:', err);
      }
    };
    loadOrFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, languageInitialized, gameMode, gameModeInitialized]);

  // ── Actions (stable via useCallback + refs) ────────────────────────
  const addChar = useCallback((ch: string) => {
    if (gameOverRef.current) return;
    const lang = languageRef.current;
    const wl = wordLengthRef.current;
    const newGuess = currentGuessRef.current + ch;
    if (lang === 'es') {
      const tokens = tokenizeWord(newGuess, lang);
      if (tokens.length <= wl) {
        setCurrentGuess(newGuess);
        setCurrentGuessTokens(tokens);
      }
    } else {
      if (newGuess.length <= wl) {
        setCurrentGuess(newGuess);
        setCurrentGuessTokens(newGuess.split(''));
      }
    }
  }, []);

  const backspace = useCallback(() => {
    const lang = languageRef.current;
    const tokens = currentGuessTokensRef.current;
    if (currentGuessRef.current.length === 0) return;
    if (lang === 'es' && tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      setCurrentGuess(prev => prev.slice(0, -last.length));
      setCurrentGuessTokens(prev => prev.slice(0, -1));
    } else {
      setCurrentGuess(prev => prev.slice(0, -1));
      setCurrentGuessTokens(prev => prev.slice(0, -1));
    }
  }, []);

  const submitGuess = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'network' }> => {
    const tokens = currentGuessTokensRef.current;
    const guess = currentGuessRef.current;
    const lang = languageRef.current;
    const wl = wordLengthRef.current;
    const row = currentRowRef.current;

    if (tokens.length !== wl) return { ok: false, reason: 'invalid' };

    try {
      const response = await fetch(`/api/validate?word=${encodeURIComponent(guess)}&language=${lang}`);
      const data = await response.json();
      if (!data.valid) return { ok: false, reason: 'invalid' };
    } catch {
      return { ok: false, reason: 'network' };
    }

    const newGuesses = [...guessesRef.current];
    newGuesses[row] = guess;
    setGuesses(newGuesses);

    const newGuessTokensList = [...guessTokensRef.current];
    newGuessTokensList[row] = tokens;
    setGuessTokens(newGuessTokensList);

    const score = calculateScore(guess, boardRowRef.current, startColRef.current, lang);
    const newScores = [...guessScoresRef.current];
    newScores[row] = score;
    setGuessScores(newScores);

    setCurrentGuess('');
    setCurrentGuessTokens([]);

    if (guess === targetWordRef.current) {
      setAnimatingRow(row);
      const attemptNumber = row + 1;
      const multiplier = 3.5 - attemptNumber * 0.5;
      let finalScoreValue = Math.round(score * multiplier);
      if (wl >= 7) finalScoreValue += 50;
      setAttemptMultiplier(multiplier);
      setFinalScore(finalScoreValue);
      setCurrentRow(row + 1);
      setTimeout(() => {
        setWon(true);
        setGameOver(true);
        setAnimatingRow(null);
        setShowModal(true);
      }, 1500);
    } else if (row === MAX_ATTEMPTS - 1) {
      setCurrentRow(row + 1);
      setTimeout(() => { setGameOver(true); setShowModal(true); }, 500);
    } else {
      setCurrentRow(row + 1);
    }

    return { ok: true };
  }, []);

  const resetGame = useCallback(async () => {
    const lang = languageRef.current;
    const mode = gameModeRef.current;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('anagramle-game-state');
      if (mode === 'daily') {
        setGameModeState('practice');
        return;
      }
    }

    try {
      const response = await fetch(`/api/word?language=${lang}`);
      const data = await response.json();
      const newWord = decrypt(data.data, data.key);
      const tokens = tokenizeWord(newWord, lang);
      setTargetWord(newWord);
      setTargetTokens(tokens);
      setWordLength(data.length);
      setBoardRow(data.boardRow);
      setStartCol(data.startCol);
      setHintPositions(generateHints(tokens));
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
      setLoadedMode('practice');
    } catch (err) {
      console.error('Failed to fetch word:', err);
    }
  }, []);

  const state: GameState = {
    targetWord, targetTokens, wordLength, boardRow, startCol, hintPositions,
    guesses, guessTokens, currentGuess, currentGuessTokens, currentRow,
    gameOver, won, guessScores, animatingRow, finalScore, attemptMultiplier,
    showModal, language, gameMode,
  };

  const actions: GameActions = {
    setLanguage: setLanguageState,
    setGameMode: setGameModeState,
    setShowModal,
    addChar,
    backspace,
    submitGuess,
    resetGame,
  };

  return { state, actions };
}
