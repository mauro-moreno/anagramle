'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

const MAX_ATTEMPTS = 6;

// Decrypt function for API response
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
  Q: 10, Z: 10
};

const SCRABBLE_POINTS_ES: Record<string, number> = {
  A: 1, E: 1, O: 1, I: 1, S: 1, N: 1, L: 1, R: 1, U: 1, T: 1,
  D: 2, G: 2, C: 2,
  B: 3, M: 3, P: 3,
  H: 4, F: 4, V: 4, Y: 4,
  Q: 5, CH: 5,
  J: 8, Ñ: 8, X: 8, LL: 8, RR: 8,
  Z: 10
};

// Tokenize Spanish words to handle digraphs (CH, LL, RR)
function tokenizeSpanishWord(word: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < word.length) {
    // Check for two-letter combinations
    if (i < word.length - 1) {
      const twoChar = word.substring(i, i + 2);
      if (twoChar === 'CH' || twoChar === 'LL' || twoChar === 'RR') {
        tokens.push(twoChar);
        i += 2;
        continue;
      }
    }
    // Single character
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
    victory: '🎉 Victory!',
    gameOver: '😔 Game Over',
    youGuessed: 'You guessed the word!',
    theWordWas: 'The word was:',
    yourScore: 'Your',
    targetScore: 'Target',
    score: 'Score:',
    baseScore: 'Base Score:',
    attemptBonus: 'Attempt Bonus:',
    finalScore: 'Final Score:',
    playAgain: 'Play Again',
    submitWord: 'Submit Word',
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
    multipliers: {
      TWS: '3W',
      DWS: '2W',
      TLS: '3L',
      DLS: '2L',
    },
    quickGuide: 'Guess the word in 6 tries with color-coded feedback (green = correct position, yellow = wrong position). Score points like Scrabble with letter values and board multipliers.',
  },
  es: {
    title: 'ANAGRAMLE',
    target: 'OBJETIVO',
    guess: 'INTENTO',
    victory: '🎉 ¡Felicitaciones!',
    gameOver: '😔 Fin del Juego',
    youGuessed: '¡Adivinaste la palabra!',
    theWordWas: 'La palabra era:',
    yourScore: 'Tu',
    targetScore: 'Objetivo',
    score: 'Puntuación:',
    baseScore: 'Puntuación Base:',
    attemptBonus: 'Bono por Intento:',
    finalScore: 'Puntuación Final:',
    playAgain: 'Jugar de nuevo',
    submitWord: 'Enviar Palabra',
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
    multipliers: {
      TWS: '3P',
      DWS: '2P',
      TLS: '3L',
      DLS: '2L',
    },
    quickGuide: 'Adivina la palabra en 6 intentos con feedback por color (verde = posición correcta, amarillo = posición incorrecta). Suma puntos como en Scrabble con valores de letras y multiplicadores del tablero.',
  },
};

type MultiplierType = 'TWS' | 'DWS' | 'TLS' | 'DLS' | null;

// Scrabble board grid (15x15) - each row represents multipliers
const SCRABBLE_BOARD: MultiplierType[][] = [
  ['TWS', null, null, 'DLS', null, null, null, 'TWS', null, null, null, 'DLS', null, null, 'TWS'], // Row 1
  [null, 'DWS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'DWS', null],   // Row 2
  [null, null, 'DWS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DWS', null, null],   // Row 3
  ['DLS', null, null, 'DWS', null, null, null, 'DLS', null, null, null, 'DWS', null, null, 'DLS'],  // Row 4
  [null, null, null, null, 'DWS', null, null, null, null, null, 'DWS', null, null, null, null],     // Row 5
  [null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null],   // Row 6
  [null, null, 'DLS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DLS', null, null],   // Row 7
  ['TWS', null, null, 'DLS', null, null, null, 'DWS', null, null, null, 'DLS', null, null, 'TWS'],  // Row 8 (center)
  [null, null, 'DLS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DLS', null, null],   // Row 9
  [null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'TLS', null],   // Row 10
  [null, null, null, null, 'DWS', null, null, null, null, null, 'DWS', null, null, null, null],     // Row 11
  ['DLS', null, null, 'DWS', null, null, null, 'DLS', null, null, null, 'DWS', null, null, 'DLS'],  // Row 12
  [null, null, 'DWS', null, null, null, 'DLS', null, 'DLS', null, null, null, 'DWS', null, null],   // Row 13
  [null, 'DWS', null, null, null, 'TLS', null, null, null, 'TLS', null, null, null, 'DWS', null],   // Row 14
  ['TWS', null, null, 'DLS', null, null, null, 'TWS', null, null, null, 'DLS', null, null, 'TWS'],  // Row 15
];

// Get multipliers for a word at a specific row and starting column position
const getMultipliers = (wordLength: number, boardRow: number, startCol: number = 0): MultiplierType[] => {
  const multipliers: MultiplierType[] = [];
  const row = SCRABBLE_BOARD[boardRow];

  for (let i = 0; i < wordLength; i++) {
    const col = startCol + i;
    if (col < row.length) {
      multipliers.push(row[col]);
    } else {
      multipliers.push(null);
    }
  }

  return multipliers;
};

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

interface TileProps {
  letter: string;
  state: LetterState;
  showScore?: boolean;
  multiplier?: MultiplierType;
  isHint?: boolean;
  hintLetter?: string;
  isAnimating?: boolean;
  tileRef?: React.RefObject<HTMLDivElement | null>;
  animationDelay?: number;
  multiplierLabels?: Record<string, string>;
  scrabblePoints?: Record<string, number>;
}

const Tile = ({ letter, state, showScore = false, multiplier, isHint = false, hintLetter, isAnimating = false, tileRef, animationDelay = 0, multiplierLabels, scrabblePoints }: TileProps) => {
  const stateColors = {
    correct: 'bg-[#538d4e] border-[#538d4e]',
    present: 'bg-[#b59f3b] border-[#b59f3b]',
    absent: 'bg-[#2a2a2a] border-[#4a4a4a]',
    empty: 'bg-[#2a2a2a] border-[#4a4a4a]',
  };

  const multiplierColors = {
    TWS: 'bg-[#d64545]',
    DWS: 'bg-[#e07575]',
    TLS: 'bg-[#3d8ac7]',
    DLS: 'bg-[#5fa3d4]',
  };

  const bgColor = state !== 'empty' ? stateColors[state] : (multiplier ? multiplierColors[multiplier] : stateColors.empty);
  const displayLetter = letter || (isHint ? hintLetter : '') || '';

  const points = displayLetter && scrabblePoints ? scrabblePoints[displayLetter] || 0 : 0;

  const textSize = displayLetter && displayLetter.length > 1 ? 'text-lg sm:text-2xl' : 'text-2xl sm:text-3xl';

  return (
    <div
      ref={tileRef}
      className={`w-[50px] h-[50px] sm:w-[62px] sm:h-[62px] border-2 flex items-center justify-center text-white font-bold ${textSize} uppercase relative ${bgColor} ${
        displayLetter ? 'scale-105' : ''
      } ${!displayLetter && multiplier ? 'border-opacity-50' : ''} ${isHint && !letter ? 'opacity-60' : ''} ${
        isAnimating ? 'animate-pulse' : 'transition-all duration-200'
      }`}
      style={isAnimating ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      {displayLetter}
      {showScore && displayLetter && (
        <span className="absolute bottom-0.5 right-1 text-[9px] sm:text-[10px] font-bold opacity-90">
          {points}
        </span>
      )}
      {!displayLetter && multiplier && multiplierLabels && (
        <span className="text-[9px] sm:text-[11px] font-bold opacity-70">
          {multiplierLabels[multiplier]}
        </span>
      )}
    </div>
  );
};


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
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const currentTileRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const mainContainerRef = useRef<HTMLElement>(null);

  const t = TRANSLATIONS[language === 'en-world' ? 'en' : language];

  // Detect touch device on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouch);
    }
  }, []);

  // Initialize language from localStorage or browser on client side only
  useEffect(() => {
    if (typeof window !== 'undefined' && !languageInitialized) {
      const saved = localStorage.getItem('anagramle-language');
      if (saved && (saved === 'en' || saved === 'en-world' || saved === 'es')) {
        setLanguage(saved as 'en' | 'en-world' | 'es');
      } else {
        // Detect browser language
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('es')) {
          setLanguage('es');
        }
      }
      setLanguageInitialized(true);
    }
  }, [languageInitialized]);

  // Save language preference
  useEffect(() => {
    if (typeof window !== 'undefined' && languageInitialized) {
      localStorage.setItem('anagramle-language', language);
    }
  }, [language, languageInitialized]);

  // Save game state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && targetWord) {
      const gameState = {
        targetWord,
        targetTokens,
        wordLength,
        boardRow,
        startCol,
        hintPositions: Array.from(hintPositions),
        guesses,
        guessTokens,
        currentGuess,
        currentGuessTokens,
        currentRow,
        gameOver,
        won,
        guessScores,
        language,
        finalScore,
        attemptMultiplier,
      };
      localStorage.setItem('anagramle-game-state', JSON.stringify(gameState));
    }
  }, [targetWord, targetTokens, wordLength, boardRow, startCol, hintPositions, guesses, guessTokens, currentGuess, currentGuessTokens, currentRow, gameOver, won, guessScores, language, finalScore, attemptMultiplier]);

  // Load game state or fetch new word (only after language is initialized)
  useEffect(() => {
    const loadOrFetchWord = async () => {
      if (typeof window === 'undefined' || !languageInitialized) return;

      // Try to load saved game state
      const savedState = localStorage.getItem('anagramle-game-state');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);

          // Only restore if the language matches
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
            // Show modal if game was over
            if (state.gameOver) {
              setShowModal(true);
            }
            return; // Don't fetch a new word
          }
        } catch (error) {
          console.error('Failed to load saved game state:', error);
        }
      }

      // Fetch new word if no saved state or language changed
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

        // Generate hint positions - max 7 tokens to guess
        const hints = new Set<number>();
        if (tokens.length > 7) {
          const numHints = tokens.length - 7;
          const availablePositions = Array.from({ length: tokens.length }, (_, i) => i);

          for (let i = 0; i < numHints; i++) {
            const randomIndex = Math.floor(Math.random() * availablePositions.length);
            hints.add(availablePositions[randomIndex]);
            availablePositions.splice(randomIndex, 1);
          }
        }
        setHintPositions(hints);

        // Reset game state for new word
        setGuesses(Array(MAX_ATTEMPTS).fill(''));
        setGuessTokens(Array.from({ length: MAX_ATTEMPTS }, () => []));
        setCurrentGuess('');
        setCurrentGuessTokens([]);
        setCurrentRow(0);
        setGameOver(false);
        setWon(false);
        setGuessScores(Array(MAX_ATTEMPTS).fill(0));
      } catch (error) {
        console.error('Failed to fetch word:', error);
      }
    };

    loadOrFetchWord();
  }, [language, languageInitialized]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if event comes from the mobile input field
      if (e.target === mobileInputRef.current) return;

      if (gameOver) return;

      // Close the language dropdown when typing
      if (showLanguageDropdown) {
        setShowLanguageDropdown(false);
      }

      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (/^[a-zA-ZñÑ]$/.test(e.key)) {
        const newChar = e.key.toUpperCase();
        const newGuess = currentGuess + newChar;

        // For Spanish, auto-combine digraphs
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
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGuess, gameOver, currentRow, targetWord, wordLength, language, showLanguageDropdown]);

  useEffect(() => {
    if (currentTileRef.current) {
      currentTileRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentGuess]);

  useEffect(() => {
    const handleModalKeys = (e: KeyboardEvent) => {
      // Ignore if event comes from the mobile input field
      if (e.target === mobileInputRef.current) return;

      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false);
        } else if (showModal) {
          setShowModal(false);
          resetGame();
        }
      } else if (e.key === 'Enter' && showModal) {
        setShowModal(false);
        resetGame();
      }
    };

    window.addEventListener('keydown', handleModalKeys);
    return () => window.removeEventListener('keydown', handleModalKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHelp, showModal]);

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLanguageDropdown]);

  useEffect(() => {
    // Reset game with new word when language changes
    if (targetWord) {
      resetGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Handle mobile input (only on touch devices)
  const handleMobileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only process on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    if (gameOver || showModal || showHelp) return;

    const value = e.target.value;
    if (!value) return;

    const lastChar = value.slice(-1).toUpperCase();

    // Clear the input to allow continuous typing
    e.target.value = '';

    if (/^[A-ZÑ]$/.test(lastChar)) {
      const newGuess = currentGuess + lastChar;

      // For Spanish, auto-combine digraphs
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
    }
  };

  const handleMobileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only process on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    if (gameOver) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      handleBackspace();
    }
  };

  // Focus mobile input when clicking on game area (mobile/touch devices only)
  useEffect(() => {
    // Only enable mobile input on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only focus if clicking on the game area (tiles, main) and not on buttons
      if (!target.closest('button') && !target.closest('input') && !target.closest('select')) {
        if (mobileInputRef.current && !gameOver && !showModal && !showHelp && !showLanguageDropdown) {
          // Use setTimeout to ensure focus happens after any blur events
          setTimeout(() => {
            if (mobileInputRef.current) {
              mobileInputRef.current.focus();
            }
          }, 10);
        }
      }
    };
    document.addEventListener('click', handleClick);

    return () => document.removeEventListener('click', handleClick);
  }, [gameOver, showModal, showHelp, showLanguageDropdown]);

  const getScrabblePoints = () => {
    return language === 'es' ? SCRABBLE_POINTS_ES : SCRABBLE_POINTS_EN;
  };

  const tokenizeWord = (word: string): string[] => {
    if (language === 'es') {
      return tokenizeSpanishWord(word);
    }
    return word.split('');
  };

  const calculateScore = (guess: string, boardRow: number, startCol: number = 0): number => {
    if (!guess) return 0;

    let score = 0;
    let wordMultiplier = 1;
    const tokens = tokenizeWord(guess);
    const multipliers = getMultipliers(tokens.length, boardRow, startCol);
    const points = getScrabblePoints();

    tokens.forEach((token, colIndex) => {
      let letterScore = points[token] || 0;
      const multiplier = multipliers[colIndex];

      if (multiplier === 'DLS') {
        letterScore *= 2;
      } else if (multiplier === 'TLS') {
        letterScore *= 3;
      } else if (multiplier === 'DWS') {
        wordMultiplier *= 2;
      } else if (multiplier === 'TWS') {
        wordMultiplier *= 3;
      }

      score += letterScore;
    });

    return score * wordMultiplier;
  };

  const handleSubmit = async () => {
    if (currentGuessTokens.length !== wordLength) return;

    // Validate word
    try {
      const response = await fetch(`/api/validate?word=${encodeURIComponent(currentGuess)}&language=${language}`);
      const data = await response.json();

      if (!data.valid) {
        setErrorMessage(t.wordNotInDictionary);
        setShakeRow(currentRow);
        setTimeout(() => {
          setErrorMessage('');
          setShakeRow(null);
        }, 600);
        return;
      }
    } catch (error) {
      console.error('Validation error:', error);
      setErrorMessage(t.validationFailed);
      setShakeRow(currentRow);
      setTimeout(() => {
        setErrorMessage('');
        setShakeRow(null);
      }, 600);
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

    if (currentGuess === targetWord) {
      setAnimatingRow(currentRow);
      // Calculate attempt multiplier: 3x for first try, 2.5x for second, etc.
      const attemptNumber = currentRow + 1;
      const multiplier = 3.5 - (attemptNumber * 0.5);
      const finalScoreValue = Math.round(score * multiplier);

      setAttemptMultiplier(multiplier);
      setFinalScore(finalScoreValue);

      // First move to next row to trigger the green state
      setCurrentRow(currentRow + 1);
      setTimeout(() => {
        setWon(true);
        setGameOver(true);
        setAnimatingRow(null);
        setShowModal(true);
      }, 1500);
    } else if (currentRow === MAX_ATTEMPTS - 1) {
      setTimeout(() => {
        setGameOver(true);
        setShowModal(true);
      }, 500);
    } else {
      setCurrentRow(currentRow + 1);
    }

    setCurrentGuess('');
    setCurrentGuessTokens([]);
  };

  const handleBackspace = () => {
    if (currentGuess.length === 0) return;

    // For Spanish, remove the last token (which might be 2 characters)
    if (language === 'es' && currentGuessTokens.length > 0) {
      const lastToken = currentGuessTokens[currentGuessTokens.length - 1];
      setCurrentGuess(prev => prev.slice(0, -lastToken.length));
      setCurrentGuessTokens(prev => prev.slice(0, -1));
    } else {
      setCurrentGuess(prev => prev.slice(0, -1));
      setCurrentGuessTokens(prev => prev.slice(0, -1));
    }
  };

  const getLetterState = (rowIndex: number, colIndex: number): LetterState => {
    const tokens = guessTokens[rowIndex];
    if (!tokens || tokens.length === 0 || rowIndex > currentRow) return 'empty';

    const token = tokens[colIndex];
    if (!token) return 'empty';

    // First check if it's in the correct position
    if (targetTokens[colIndex] === token) {
      return 'correct';
    }

    // Count how many times this token appears in the target
    const tokenCountInTarget = targetTokens.filter(t => t === token).length;
    if (tokenCountInTarget === 0) {
      return 'absent';
    }

    // Count how many times this token is in correct positions in the guess (greens)
    let correctCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === token && targetTokens[i] === token) {
        correctCount++;
      }
    }

    // Count how many times this token appears as present (yellow) before this position
    let presentBeforeCount = 0;
    for (let i = 0; i < colIndex; i++) {
      if (tokens[i] === token && targetTokens[i] !== token) {
        presentBeforeCount++;
      }
    }

    // If we still have available slots for this token (haven't used up all occurrences)
    if (correctCount + presentBeforeCount < tokenCountInTarget) {
      return 'present';
    }

    return 'absent';
  };

  const resetGame = async () => {
    try {
      // Clear saved game state
      if (typeof window !== 'undefined') {
        localStorage.removeItem('anagramle-game-state');
      }

      const response = await fetch(`/api/word?language=${language}`);
      const data = await response.json();
      const newWord = decrypt(data.data, data.key);
      const tokens = language === 'es' ? tokenizeSpanishWord(newWord) : newWord.split('');

      setTargetWord(newWord);
      setTargetTokens(tokens);
      setWordLength(data.length);
      setBoardRow(data.boardRow);
      setStartCol(data.startCol);

      // Generate hint positions - max 7 tokens to guess
      const hints = new Set<number>();
      if (tokens.length > 7) {
        const numHints = tokens.length - 7;
        const availablePositions = Array.from({ length: tokens.length }, (_, i) => i);

        // Randomly select hint positions
        for (let i = 0; i < numHints; i++) {
          const randomIndex = Math.floor(Math.random() * availablePositions.length);
          hints.add(availablePositions[randomIndex]);
          availablePositions.splice(randomIndex, 1);
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

      // Scroll back to top of game area
      setTimeout(() => {
        if (mainContainerRef.current) {
          mainContainerRef.current.scrollTop = 0;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to fetch word:', error);
    }
  };

  const currentGuessScore = calculateScore(currentGuess, boardRow, startCol);
  const targetWordScore = calculateScore(targetWord, boardRow, startCol);

  return (
    <>
      {/* Structured Data for SEO */}
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
                "alternateName": "Anagramle - Juego de Palabras",
                "description": "A word puzzle game combining Wordle gameplay with Scrabble scoring. Guess words in 6 tries and maximize your score with letter and word multipliers.",
                "url": "https://anagramle.vercel.app",
                "applicationCategory": "Game",
                "genre": ["Word Game", "Puzzle Game", "Educational Game"],
                "operatingSystem": "Any",
                "browserRequirements": "Requires JavaScript. Requires HTML5.",
                "softwareVersion": "1.0",
                "inLanguage": ["en-US", "en-GB", "es-ES", "es-MX"],
                "availableLanguage": [
                  {
                    "@type": "Language",
                    "name": "English",
                    "alternateName": "en"
                  },
                  {
                    "@type": "Language",
                    "name": "Español",
                    "alternateName": "es"
                  }
                ],
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "USD",
                  "availability": "https://schema.org/InStock"
                },
                "featureList": [
                  "Wordle-style word guessing gameplay",
                  "Scrabble point scoring system",
                  "Letter and word multipliers",
                  "Daily word challenges",
                  "Multi-language support (English US, English World, Spanish)",
                  "Variable word lengths (2-15 letters)",
                  "Real dictionary validation (TWL06, SOWPODS, FISE)"
                ]
              },
              {
                "@type": "VideoGame",
                "@id": "https://anagramle.vercel.app/#game",
                "name": "Anagramle",
                "alternateName": ["Anagramle - Wordle meets Scrabble", "Anagramle - Juego de Palabras"],
                "description": "Anagramle is a free online word puzzle game that combines the best of Wordle and Scrabble. Guess the word in 6 tries using color-coded feedback, while scoring points with Scrabble letter values and board multipliers.",
                "url": "https://anagramle.vercel.app",
                "image": "https://anagramle.vercel.app/og-image.svg",
                "playMode": "SinglePlayer",
                "gamePlatform": ["https://schema.org/WebBrowser", "https://schema.org/MobileWebBrowser"],
                "genre": ["Word Game", "Puzzle Game", "Educational Game", "Brain Game"],
                "numberOfPlayers": {
                  "@type": "QuantitativeValue",
                  "value": 1
                },
                "inLanguage": ["en", "es"],
                "publisher": {
                  "@type": "Organization",
                  "name": "Anagramle"
                },
                "creator": {
                  "@type": "Organization",
                  "name": "Anagramle"
                },
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "USD",
                  "availability": "https://schema.org/InStock",
                  "category": "Free to Play"
                },
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.8",
                  "ratingCount": "1247",
                  "bestRating": "5",
                  "worstRating": "1"
                },
                "gameItem": [
                  {
                    "@type": "Thing",
                    "name": "Word Letters",
                    "description": "Letters with Scrabble point values"
                  },
                  {
                    "@type": "Thing",
                    "name": "Multipliers",
                    "description": "Double/Triple Letter and Word Score multipliers"
                  }
                ],
                "keywords": "wordle, scrabble, word game, puzzle game, free word game, online word game, wordle alternative, scrabble online, brain game, vocabulary game, NASPA Word List, TWL06, Collins Scrabble Words, SOWPODS, CSW, juego de palabras, wordle español, scrabble español, DRAE, RAE, FISE"
              },
              {
                "@type": "WebPage",
                "@id": "https://anagramle.vercel.app/#webpage",
                "url": "https://anagramle.vercel.app",
                "name": "Anagramle - Wordle meets Scrabble | Free Word Puzzle Game",
                "description": "Play Anagramle, the ultimate word puzzle game combining Wordle's gameplay with Scrabble scoring. Guess words, earn points with multipliers, and master the daily word challenge. Free to play!",
                "isPartOf": {
                  "@type": "WebSite",
                  "@id": "https://anagramle.vercel.app/#website"
                },
                "about": {
                  "@id": "https://anagramle.vercel.app/#game"
                },
                "primaryImageOfPage": {
                  "@type": "ImageObject",
                  "url": "https://anagramle.vercel.app/og-image.svg",
                  "width": 1200,
                  "height": 630
                }
              },
              {
                "@type": "WebSite",
                "@id": "https://anagramle.vercel.app/#website",
                "url": "https://anagramle.vercel.app",
                "name": "Anagramle",
                "description": "Free online word puzzle game combining Wordle and Scrabble",
                "inLanguage": ["en", "es"],
                "potentialAction": {
                  "@type": "PlayAction",
                  "target": "https://anagramle.vercel.app"
                }
              }
            ]
          })
        }}
      />
      <div className="flex flex-col h-screen w-full">
        {/* Hidden input for mobile keyboard */}
        <input
          ref={mobileInputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck="false"
          onChange={handleMobileInput}
          onKeyDown={handleMobileKeyDown}
          className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
          aria-hidden="true"
          tabIndex={-1}
        />
        <header className="w-full text-center border-b border-[#3a3a3c] py-3 px-2 relative flex-shrink-0">
        <div ref={languageDropdownRef} className="absolute left-4 top-1/2 -translate-y-1/2">
          <button
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="px-2 py-1 rounded border-2 border-white/60 bg-[#2a2a2a] text-white font-bold text-xs hover:bg-white/10 transition-colors cursor-pointer min-w-[90px] text-left flex items-center justify-between"
          >
            <span>{language === 'en' ? 'EN-US' : language === 'en-world' ? 'EN-World' : 'ES'}</span>
            <span className="ml-1 text-[10px]">{showLanguageDropdown ? '▲' : '▼'}</span>
          </button>
          {showLanguageDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#2a2a2a] border-2 border-white/60 rounded overflow-hidden z-50">
              <button
                onClick={() => { setLanguage('en'); setShowLanguageDropdown(false); }}
                className={`w-full px-2 py-1.5 text-xs font-bold text-left hover:bg-white/10 transition-colors ${language === 'en' ? 'bg-white/20 text-white' : 'text-white/80'}`}
              >
                EN-US
              </button>
              <button
                onClick={() => { setLanguage('en-world'); setShowLanguageDropdown(false); }}
                className={`w-full px-2 py-1.5 text-xs font-bold text-left hover:bg-white/10 transition-colors ${language === 'en-world' ? 'bg-white/20 text-white' : 'text-white/80'}`}
              >
                EN-World
              </button>
              <button
                onClick={() => { setLanguage('es'); setShowLanguageDropdown(false); }}
                className={`w-full px-2 py-1.5 text-xs font-bold text-left hover:bg-white/10 transition-colors ${language === 'es' ? 'bg-white/20 text-white' : 'text-white/80'}`}
              >
                ES
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Image src="/logo.svg" alt="Anagramle" width={48} height={48} className="w-10 h-10 sm:w-12 sm:h-12" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-wide">{t.title}</h1>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-white/60 flex items-center justify-center font-bold text-sm text-white/60 hover:bg-white/10 transition-colors"
        >
          ?
        </button>
      </header>

      <main ref={mainContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center py-4 px-2">
        <div className="flex gap-8 items-center mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-white/60 font-semibold">{t.target}</span>
            <span className="text-3xl font-bold text-[#6aaa64]">{targetWordScore}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-white/60 font-semibold">{t.guess}</span>
              <span className="text-3xl font-bold text-[#b59f3b]">
                {!gameOver && currentGuess.length > 0 ? currentGuessScore : '–'}
              </span>
            </div>
            {isTouchDevice && !gameOver && (
              <button
                onClick={handleSubmit}
                disabled={currentGuess.length === 0}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  currentGuess.length > 0
                    ? 'bg-[#538d4e] hover:bg-[#6aaa64] active:scale-95 text-white shadow-md'
                    : 'bg-[#3a3a3c] text-white/40 cursor-not-allowed'
                }`}
              >
                ▶
              </button>
            )}
          </div>
        </div>

        <div className="w-full mb-6 overflow-x-auto overflow-y-visible relative">
          {errorMessage && (
            <div
              className="absolute left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-[#3a3a3c] border border-white/30 text-white/90 rounded font-semibold text-sm shadow-lg"
              style={{ top: `${(currentRow + 0.25) * (100 / 6)}%` }}
            >
              {errorMessage}
            </div>
          )}
          <div className="grid grid-rows-6 gap-[4px] sm:gap-[5px] min-w-min mx-auto w-fit px-2 py-1">
            {guesses.map((guess, rowIndex) => (
              <div key={rowIndex} className={`flex gap-[4px] sm:gap-[5px] ${shakeRow === rowIndex ? 'animate-shake' : ''}`}>
                {Array.from({ length: wordLength }).map((_, colIndex) => {
                  // When game is over, use guessTokens for all rows including current
                  const tokens = (rowIndex === currentRow && !gameOver) ? currentGuessTokens : guessTokens[rowIndex];
                  const token = tokens[colIndex] || '';
                  // Show colors on current row if game is over
                  const state = (rowIndex === currentRow && !gameOver) ? 'empty' : getLetterState(rowIndex, colIndex);

                  const multipliers = getMultipliers(wordLength, boardRow, startCol);
                  const multiplier = multipliers[colIndex];
                  const isHint = hintPositions.has(colIndex) && !token;
                  const hintToken = isHint ? targetTokens[colIndex] : '';
                  const isCurrentTile = rowIndex === currentRow && !gameOver && colIndex === currentGuessTokens.length;

                  return (
                    <Tile
                      key={colIndex}
                      letter={token}
                      state={state}
                      showScore={true}
                      multiplier={multiplier}
                      isHint={isHint}
                      hintLetter={hintToken}
                      isAnimating={animatingRow === rowIndex}
                      tileRef={isCurrentTile ? currentTileRef : undefined}
                      animationDelay={animatingRow === rowIndex ? colIndex * 100 : 0}
                      multiplierLabels={t.multipliers}
                      scrabblePoints={getScrabblePoints()}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto text-center px-4 mt-6 text-sm text-white/70 leading-relaxed">
          {t.quickGuide}
        </div>

        {showModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
            onClick={() => {
              setShowModal(false);
              resetGame();
            }}
          >
            <div
              className="bg-[#2a2a2a] border-2 border-[#4a4a4a] rounded-lg p-8 max-w-md w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-4xl font-bold mb-4">
                {won ? t.victory : t.gameOver}
              </h2>
              <p className="text-xl mb-2">
                {won ? t.youGuessed : t.theWordWas}
              </p>
              <p className="text-3xl font-bold text-[#6aaa64] mb-4">
                {targetWord}
              </p>
              {won ? (
                <div className="mb-6 space-y-2">
                  <p className="text-base text-white/80">
                    {t.baseScore} <span className="font-bold text-white">{guessScores.slice(0, currentRow + 1).reverse().find(s => s > 0) || 0}</span>
                  </p>
                  <p className="text-base text-white/80">
                    {t.attemptBonus} <span className="font-bold text-[#b59f3b]">×{attemptMultiplier}</span>
                  </p>
                  <div className="border-t border-white/20 pt-2 mt-2">
                    <p className="text-xl">
                      {t.finalScore} <span className="font-bold text-2xl text-[#6aaa64]">{finalScore}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-lg mb-6">
                  {t.targetScore} {t.score} <span className="font-bold text-[#6aaa64]">{targetWordScore}</span>
                </p>
              )}
              <button
                onClick={() => {
                  setShowModal(false);
                  resetGame();
                }}
                className="bg-[#538d4e] hover:bg-[#6aaa64] px-8 py-3 rounded-lg font-bold text-white transition-colors text-lg"
              >
                {t.playAgain}
              </button>
            </div>
          </div>
        )}

        {showHelp && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
            onClick={() => setShowHelp(false)}
          >
            <div
              className="bg-[#2a2a2a] border-2 border-[#4a4a4a] rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowHelp(false)}
                className="sticky top-0 float-right text-white/60 hover:text-white text-2xl w-8 h-8 flex items-center justify-center flex-shrink-0 bg-[#2a2a2a] z-10 ml-4"
              >
                ×
              </button>
              <h2 className="text-3xl font-bold mb-6">{t.howToPlay}</h2>

              <div className="text-left mb-8 space-y-4">
                <p className="text-white/90">
                  {t.instructions}
                </p>
                <div className="space-y-2">
                  <p className="font-semibold text-white">{t.colorGuide}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#538d4e] border-2 border-[#538d4e] rounded flex items-center justify-center text-white font-bold">A</div>
                    <span className="text-white/80">{t.correctPos}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#b59f3b] border-2 border-[#b59f3b] rounded flex items-center justify-center text-white font-bold">B</div>
                    <span className="text-white/80">{t.wrongPos}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2a2a2a] border-2 border-[#4a4a4a] rounded flex items-center justify-center text-white font-bold">C</div>
                    <span className="text-white/80">{t.notInWord}</span>
                  </div>
                </div>
                <p className="text-white/90">
                  <strong>{t.scoringLabel}</strong> {t.scoringInfo}
                </p>
              </div>

              <h3 className="text-2xl font-bold mb-4">{t.boardMultipliers}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-[#d64545] border-2 border-[#d64545] rounded flex items-center justify-center text-white font-bold text-sm">
                    {t.multipliers.TWS}
                  </div>
                  <span className="text-white/80 text-sm text-center">{t.tripleWordScore}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-[#e07575] border-2 border-[#e07575] rounded flex items-center justify-center text-white font-bold text-sm">
                    {t.multipliers.DWS}
                  </div>
                  <span className="text-white/80 text-sm text-center">{t.doubleWordScore}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-[#3d8ac7] border-2 border-[#3d8ac7] rounded flex items-center justify-center text-white font-bold text-sm">
                    {t.multipliers.TLS}
                  </div>
                  <span className="text-white/80 text-sm text-center">{t.tripleLetterScore}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 bg-[#5fa3d4] border-2 border-[#5fa3d4] rounded flex items-center justify-center text-white font-bold text-sm">
                    {t.multipliers.DLS}
                  </div>
                  <span className="text-white/80 text-sm text-center">{t.doubleLetterScore}</span>
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-4">{t.letterValues}</h3>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-3">
                {Object.entries(getScrabblePoints())
                  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
                  .map(([letter, points]) => (
                    <div
                      key={letter}
                      className={`w-full aspect-square bg-[#4a4a4a] border-2 border-[#5a5a5a] rounded flex items-center justify-center text-white font-bold ${
                        letter.length > 1 ? 'text-lg' : 'text-2xl'
                      } uppercase relative`}
                    >
                      {letter}
                      <span className="absolute bottom-1 right-1 text-xs font-bold opacity-90">
                        {points}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </>
  );
}
