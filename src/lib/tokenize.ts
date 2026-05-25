export function tokenizeSpanishWord(word: string): string[] {
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

export function tokenizeWord(word: string, language: 'en' | 'en-world' | 'es'): string[] {
  return language === 'es' ? tokenizeSpanishWord(word) : word.split('');
}
