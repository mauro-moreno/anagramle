import fs from 'fs';
import path from 'path';
import { tokenizeSpanishWord, tokenizeWord } from './tokenize';

interface DictionaryCache {
  words: Set<string>;
  wordsByLength: Map<number, string[]>;
  loaded: boolean;
}

const dictionaries: {
  'en': DictionaryCache;
  'en-world': DictionaryCache;
  'es': DictionaryCache;
} = {
  'en': { words: new Set(), wordsByLength: new Map(), loaded: false },
  'en-world': { words: new Set(), wordsByLength: new Map(), loaded: false },
  'es': { words: new Set(), wordsByLength: new Map(), loaded: false },
};

const DICT_FILES = {
  'en': 'twl06.txt',
  'en-world': 'sowpods.txt',
  'es': 'fise-2.txt',
};

function loadDictionary(language: 'en' | 'en-world' | 'es'): void {
  if (dictionaries[language].loaded) return;

  const dictPath = path.join(process.cwd(), 'dict', DICT_FILES[language]);
  const content = fs.readFileSync(dictPath, 'utf-8');
  const words = content.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);

  const wordsByLength = new Map<number, string[]>();

  for (const word of words) {
    // Calculate token length for Spanish (CH, LL, RR count as 1)
    const tokenLength = language === 'es' ? tokenizeSpanishWord(word).length : word.length;

    // Only include words with 2-15 tokens
    if (tokenLength >= 2 && tokenLength <= 15) {
      dictionaries[language].words.add(word);

      if (!wordsByLength.has(tokenLength)) {
        wordsByLength.set(tokenLength, []);
      }
      wordsByLength.get(tokenLength)!.push(word);
    }
  }

  dictionaries[language].wordsByLength = wordsByLength;
  dictionaries[language].loaded = true;

  console.log(`Loaded ${dictionaries[language].words.size} words for ${language}`);
}

export function validateWord(word: string, language: 'en' | 'en-world' | 'es'): boolean {
  if (!dictionaries[language].loaded) {
    loadDictionary(language);
  }
  return dictionaries[language].words.has(word.toUpperCase());
}

export function getRandomWord(language: 'en' | 'en-world' | 'es'): string {
  if (!dictionaries[language].loaded) {
    loadDictionary(language);
  }

  const wordsByLength = dictionaries[language].wordsByLength;
  const lengths = Array.from(wordsByLength.keys());

  // Pick a random length
  const randomLength = lengths[Math.floor(Math.random() * lengths.length)];
  const wordsOfLength = wordsByLength.get(randomLength)!;

  // Pick a random word of that length
  return wordsOfLength[Math.floor(Math.random() * wordsOfLength.length)];
}

export function getTokenLength(word: string, language: 'en' | 'en-world' | 'es'): number {
  if (language === 'es') {
    return tokenizeSpanishWord(word).length;
  }
  return word.length;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(language: string, dateStr: string): number {
  const str = `${language}:${dateStr}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getDailyWordWithParams(
  language: 'en' | 'en-world' | 'es',
  dateStr: string
): { word: string; boardRow: number; startCol: number } {
  if (!dictionaries[language].loaded) loadDictionary(language);
  const wordsByLength = dictionaries[language].wordsByLength;
  const lengths = Array.from(wordsByLength.keys()).sort((a, b) => a - b);
  const rand = mulberry32(dateSeed(language, dateStr));
  const randomLength = lengths[Math.floor(rand() * lengths.length)];
  const wordsOfLength = wordsByLength.get(randomLength)!;
  const word = wordsOfLength[Math.floor(rand() * wordsOfLength.length)];
  const boardRow = Math.floor(rand() * 15);
  const maxStartCol = Math.max(0, 15 - randomLength);
  const startCol = Math.floor(rand() * (maxStartCol + 1));
  return { word, boardRow, startCol };
}
