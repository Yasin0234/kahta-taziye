import * as cheerio from 'cheerio';
import { TaziyeDetail } from '../types';
import { cleanText } from './utils';

const BASE_URL = 'https://taziye.kahta.bel.tr';

/**
 * Kahta Belediyesi Taziye Portalından ilanları ve detaylarını çeker.
 */
export async function scrapeKahta(): Promise<TaziyeDetail[]> {
  try {
    const res = await fetch(`${BASE_URL}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      throw new Error(`Kahta ana sayfası yüklenemedi: HTTP ${res.status}`);
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

    // Paralel olarak tüm ilan detaylarını çek
    const detailPromises = ids.map(async (id) => {
      try {
        return await fetchKahtaDetail(id);
      } catch (err) {
        console.error(`Kahta Taziye ID ${id} detay çekme hatası:`, err);
        return null;
      }
    });

    const results = await Promise.all(detailPromises);
    return results.filter((item): item is TaziyeDetail => item !== null);
  } catch (error) {
    console.error('Kahta scraper hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir Kahta taziye_id için modal.php'den tam detayları çeker.
 */
export async function fetchKahtaDetail(taziyeId: string): Promise<TaziyeDetail | null> {
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
    throw new Error(`Kahta modal.php hatası (${taziyeId}): HTTP ${modalRes.status}`);
  }

  const modalHtml = await modalRes.text();
  const $ = cheerio.load(modalHtml);

  const data: Record<string, string> = {};

  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 2) {
      const key = cleanText($(tds[0]).text()).toLowerCase();
      const val = cleanText($(tds[1]).text());
      data[key] = val;
    }
  });

  const phone = $('a[href^="tel:"]').text().trim() || data['yakını gsm'] || '';

  const record: TaziyeDetail = {
    id: `kahta_${taziyeId}`,
    ilce: 'kahta',
    ilceAdi: 'Kahta',
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
