import crypto from 'crypto';

export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Türkçe karakterleri ASCII karşılıklarına dönüştürerek URL / ID uyumlu hale getirir.
 */
export function slugify(text: string): string {
  const trMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u',
  };

  const converted = text
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => trMap[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return converted || 'item';
}

/**
 * Bir metinden deterministik kısa benzersiz hash üretir.
 */
export function createShortHash(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 10);
}
