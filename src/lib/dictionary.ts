import fs from 'fs';
import path from 'path';

// Tokenize Spanish words to handle digraphs (CH, LL, RR)
function tokenizeSpanishWord(word: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < word.length) {
    if (i < word.length - 1) {
      const twoChar = word.substring(i, i + 2).toUpperCase();
      if (twoChar === 'CH' || twoChar === 'LL' || twoChar === 'RR') {
        tokens.push(twoChar);
        i += 2;
        continue;
      }
    }
    tokens.push(word[i].toUpperCase());
    i++;
  }
  return tokens;
}

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
