import * as cheerio from 'cheerio';
import { TaziyeDetail } from './types';

const BASE_URL = 'https://taziye.kahta.bel.tr';

function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kahta Belediyesi Taziye Portalından ilanları ve detaylarını paralel/hızlı çeker.
 */
export async function scrapeTaziyeler(): Promise<TaziyeDetail[]> {
  try {
    const res = await fetch(`${BASE_URL}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      throw new Error(`Ana sayfa yüklenemedi: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const cards = $('.card[data-id]');
    const ids: string[] = [];

    cards.each((_, el) => {
      const id = $(el).attr('data-id')?.trim();
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    });

    // Paralel olarak tüm ilan detaylarını çek (Hızlı & Timeout korumalı)
    const detailPromises = ids.map(async (id) => {
      try {
        return await fetchTaziyeDetail(id);
      } catch (err) {
        console.error(`Taziye ID ${id} detay çekme hatası:`, err);
        return null;
      }
    });

    const results = await Promise.all(detailPromises);
    const taziyeList: TaziyeDetail[] = results.filter((item): item is TaziyeDetail => item !== null);

    return taziyeList;
  } catch (error) {
    console.error('Taziye scraper hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir taziye_id için modal.php'den tam detayları çeker.
 */
export async function fetchTaziyeDetail(taziyeId: string): Promise<TaziyeDetail | null> {
  const modalRes = await fetch(`${BASE_URL}/modal.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `taziye_id=${encodeURIComponent(taziyeId)}`,
  });

  if (!modalRes.ok) {
    throw new Error(`modal.php hatası (${taziyeId}): HTTP ${modalRes.status}`);
  }

  const modalHtml = await modalRes.text();
  const $ = cheerio.load(modalHtml);

  // Tablodaki satırları anahtar-değer olarak eşle
  const data: Record<string, string> = {};

  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 2) {
      const key = cleanText($(tds[0]).text()).toLowerCase();
      const val = cleanText($(tds[1]).text());
      data[key] = val;
    }
  });

  // Telefon numarasını tel linkinden veya metinden çıkar
  const phone = $('a[href^="tel:"]').text().trim() || data['yakını gsm'] || '';

  const record: TaziyeDetail = {
    belediyeId: taziyeId,
    adSoyad: data['ad soyad'] || '',
    yas: data['yaşı'] || data['yas'] || '',
    vefatTarihi: data['vefat tarihi'] || '',
    yakiniAdSoyad: data['yakını ad soyad'] || '',
    yakinlik: data['yakınlığı'] || '',
    yakiniGsm: cleanText(phone),
    cenazeNamazi: data['cenaze namazı'] || '',
    definYeri: data['defin yeri'] || '',
    definIlIlce: data['defin il ilçe'] || '',
    taziyeEvi: data['taziye evi'] || '',
    taziyeAdresi: data['taziye adresi'] || '',
    ayrintiliYakinlik: data['ayrıntılı yakınlık'] || '',
    kaynak: 'belediye_otomatik',
    olusturulmaTarihi: new Date().toISOString(),
    durum: 'aktif',
  };

  return record;
}
