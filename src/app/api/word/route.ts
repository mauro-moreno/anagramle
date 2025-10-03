import { NextResponse } from 'next/server';
import { getRandomWord, getTokenLength } from '@/lib/dictionary';

// Simple XOR encryption/decryption
function encrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get('language') || 'en';

  const word = getRandomWord(language as 'en' | 'en-world' | 'es');
  const tokenLength = getTokenLength(word, language as 'en' | 'en-world' | 'es');

  const boardRow = Math.floor(Math.random() * 15);
  const maxStartCol = Math.max(0, 15 - tokenLength);
  const startCol = Math.floor(Math.random() * (maxStartCol + 1));

  // Generate a random encryption key for this session
  const encryptionKey = Math.random().toString(36).substring(2, 15);

  // Encrypt the word
  const encryptedWord = encrypt(word, encryptionKey);

  return NextResponse.json({
    data: encryptedWord,
    key: encryptionKey,
    boardRow,
    startCol,
    length: tokenLength,
  });
}
