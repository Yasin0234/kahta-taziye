import * as cheerio from 'cheerio';
import { TaziyeDetail } from '../types';
import { cleanText } from './utils';

const BASE_URL = 'https://adiyaman.bel.tr';

/**
 * Adıyaman Merkez Belediyesi Taziye sayfasından ilanları ve detaylarını çeker.
 */
export async function scrapeMerkez(): Promise<TaziyeDetail[]> {
  try {
    const res = await fetch(`${BASE_URL}/TAZIYE-ILANLARI`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      throw new Error(`Adıyaman Merkez sayfası yüklenemedi: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    interface CardSummary {
      id: string;
      adSoyad: string;
      tarih: string;
      taziyeEvi: string;
      taziyeGunu: string;
    }

    const cards: CardSummary[] = [];

    $('.card-taziye').each((_, el) => {
      const id = $(el).attr('data-id')?.trim() || $(el).attr('id')?.trim();
      if (!id) return;

      const taziyeEvi = cleanText($(el).find('h5').text());
      const pElements = $(el).find('p');
      const adSoyad = cleanText($(pElements[0]).text());
      const tarih = cleanText($(pElements[1]).text());
      const taziyeGunu = cleanText($(el).find('strong').text());

      if (id && !cards.some((c) => c.id === id)) {
        cards.push({ id, adSoyad, tarih, taziyeEvi, taziyeGunu });
      }
    });

    // Her ilan için detayları çek
    const detailPromises = cards.map(async (card) => {
      try {
        const detail = await fetchMerkezDetail(card.id);
        if (detail) {
          if (card.taziyeGunu) {
            detail.taziyeGunu = card.taziyeGunu;
          }
          return detail;
        }
      } catch (err) {
        console.warn(`Adıyaman Merkez modal çekme hatası (ID: ${card.id}), kart verisi kullanılıyor:`, err);
      }

      // Detay modalında sorun olursa kart üzerindeki verilerle fallback oluştur
      const fallbackRecord: TaziyeDetail = {
        id: `merkez_${card.id}`,
        ilce: 'merkez',
        ilceAdi: 'Adıyaman Merkez',
        belediyeId: card.id,
        adSoyad: card.adSoyad,
        yas: '',
        vefatTarihi: card.tarih,
        yakiniAdSoyad: '',
        yakinlik: '',
        yakiniGsm: '',
        cenazeNamazi: '',
        definYeri: '',
        definIlIlce: 'Adıyaman / Merkez',
        taziyeEvi: card.taziyeEvi,
        taziyeAdresi: card.taziyeEvi,
        ayrintiliYakinlik: '',
        taziyeGunu: card.taziyeGunu,
        kaynak: 'belediye_otomatik',
        olusturulmaTarihi: new Date().toISOString(),
        durum: 'aktif',
      };
      return fallbackRecord;
    });

    const results = await Promise.all(detailPromises);
    return results.filter((item): item is TaziyeDetail => item !== null && !!item.adSoyad);
  } catch (error) {
    console.error('Adıyaman Merkez scraper hatası:', error);
    throw error;
  }
}

/**
 * Adıyaman Merkez xgetData.php endpointinden taziye detayını çeker.
 */
export async function fetchMerkezDetail(taziyeId: string): Promise<TaziyeDetail | null> {
  const modalRes = await fetch(`${BASE_URL}/xgetData.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE_URL}/TAZIYE-ILANLARI`,
    },
    body: `id=${encodeURIComponent(taziyeId)}`,
  });

  if (!modalRes.ok) {
    throw new Error(`xgetData.php hatası (${taziyeId}): HTTP ${modalRes.status}`);
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

  // "OSMAN İZCİ [ YAŞ : 71 ]"
  const rawVefatEden = data['vefat eden'] || '';
  let adSoyad = rawVefatEden;
  let yas = '';
  const yasMatch = rawVefatEden.match(/\[\s*yaş\s*:\s*([0-9]+)\s*\]/i);
  if (yasMatch) {
    yas = yasMatch[1];
    adSoyad = rawVefatEden.replace(yasMatch[0], '').trim();
  }

  // Yakını ve Yakınlık: "CELAL (KARDEŞİ)"
  const rawYakini = data['yakını'] || '';
  let yakiniAdSoyad = rawYakini;
  let yakinlik = '';
  const yakinlikMatch = rawYakini.match(/\((.*?)\)/);
  if (yakinlikMatch) {
    yakinlik = yakinlikMatch[1].trim();
    yakiniAdSoyad = rawYakini.replace(yakinlikMatch[0], '').trim();
  }

  // Telefon
  const phone = $('a[href^="tel:"]').text().trim() || data['iletişim no'] || '';

  const record: TaziyeDetail = {
    id: `merkez_${taziyeId}`,
    ilce: 'merkez',
    ilceAdi: 'Adıyaman Merkez',
    belediyeId: taziyeId,
    adSoyad: cleanText(adSoyad),
    yas: cleanText(yas),
    vefatTarihi: data['ölüm tarihi'] || '',
    yakiniAdSoyad: cleanText(yakiniAdSoyad),
    yakinlik: cleanText(yakinlik),
    yakiniGsm: cleanText(phone),
    cenazeNamazi: data['cenaze namazı'] || '',
    definYeri: data['defin yeri'] || '',
    definIlIlce: 'Adıyaman / Merkez',
    taziyeEvi: data['taziye adresi'] || '',
    taziyeAdresi: data['taziye adresi'] || '',
    ayrintiliYakinlik: data['taziye yakınları'] || '',
    kaynak: 'belediye_otomatik',
    olusturulmaTarihi: new Date().toISOString(),
    durum: 'aktif',
  };

  return record;
}
