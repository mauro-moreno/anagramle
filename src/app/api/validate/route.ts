import { NextResponse } from 'next/server';
import { validateWord } from '@/lib/dictionary';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word');
  const language = searchParams.get('language') || 'en';

  if (!word) {
    return NextResponse.json({ valid: false, error: 'No word provided' }, { status: 400 });
  }

  const isValid = validateWord(word, language as 'en' | 'en-world' | 'es');

  return NextResponse.json({ valid: isValid });
}
