export function generateKey(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function encryptWord(word: string, key: string): string {
  let result = '';
  for (let i = 0; i < word.length; i++) {
    result += String.fromCharCode(word.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

export function decryptWord(encryptedBase64: string, key: string): string {
  const encrypted = Buffer.from(encryptedBase64, 'base64').toString();
  let result = '';
  for (let i = 0; i < encrypted.length; i++) {
    result += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}
