import { NextResponse } from 'next/server';
import { getRandomWord, getTokenLength, getDailyWordWithParams } from '@/lib/dictionary';
import { encryptWord, generateKey } from '@/lib/cipher';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get('language') || 'en';
  const mode = searchParams.get('mode') || 'practice';

  let word: string;
  let boardRow: number;
  let startCol: number;
  let dateStr: string | undefined;

  if (mode === 'daily') {
    dateStr = new Date().toISOString().split('T')[0];
    const params = getDailyWordWithParams(language as 'en' | 'en-world' | 'es', dateStr);
    word = params.word;
    boardRow = params.boardRow;
    startCol = params.startCol;
  } else {
    word = getRandomWord(language as 'en' | 'en-world' | 'es');
    const tokenLength = getTokenLength(word, language as 'en' | 'en-world' | 'es');
    boardRow = Math.floor(Math.random() * 15);
    const maxStartCol = Math.max(0, 15 - tokenLength);
    startCol = Math.floor(Math.random() * (maxStartCol + 1));
  }

  const tokenLength = getTokenLength(word, language as 'en' | 'en-world' | 'es');
  const encryptionKey = generateKey();
  const encryptedWord = encryptWord(word, encryptionKey);

  return NextResponse.json({
    data: encryptedWord,
    key: encryptionKey,
    boardRow,
    startCol,
    length: tokenLength,
    ...(dateStr ? { date: dateStr } : {}),
  });
}
