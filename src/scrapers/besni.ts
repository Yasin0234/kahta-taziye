import * as cheerio from 'cheerio';
import { TaziyeDetail } from '../types';
import { cleanText, slugify, createShortHash } from './utils';

const BASE_URL = 'https://besni.bel.tr/sayfa/VefatEdenler';

/**
 * Besni Belediyesi Vefat Edenler sayfasını çeker ve TaziyeDetail listesine dönüştürür.
 */
export async function scrapeBesni(): Promise<TaziyeDetail[]> {
  try {
    const res = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      throw new Error(`Besni sayfası yüklenemedi: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const items: TaziyeDetail[] = [];

    $('.vefat').each((_, el) => {
      const adSoyad = cleanText($(el).find('.vefattitlesol').text());
      const vefatTarihi = cleanText($(el).find('.vefattitlesag').text());

      if (!adSoyad) {
        return;
      }

      // .vefatcontent içindeki alanları ayrıştır
      const contentEl = $(el).find('.vefatcontent');
      const data: Record<string, string> = {};

      contentEl.find('b').each((_, bEl) => {
        const keyRaw = cleanText($(bEl).text()).replace(/[:\s]+$/, '').toLowerCase();
        // b etiketinin hemen ardından gelen metni al
        let val = '';
        let node = bEl.nextSibling;
        while (node && (node as any).tagName !== 'b') {
          if ((node as any).type === 'text') {
            val += (node as any).data;
          }
          node = node.nextSibling;
        }
        data[keyRaw] = cleanText(val);
      });

      // Telefon bilgisini ayrıştır (İsim ve Numara içerebilir: "Ufuk ARSLAN 0505 417 98 02")
      const rawPhone = data['telefon'] || '';
      const phoneMatch = rawPhone.match(/(0?5[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2})/);
      const yakiniGsm = phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : cleanText(rawPhone);

      // Yakını Ad Soyad telefon metninden veya yakını alanından çıkarılabilir
      let yakiniAdSoyad = data['yakını'] || '';
      if (phoneMatch && rawPhone.replace(phoneMatch[0], '').trim()) {
        const phoneContactName = cleanText(rawPhone.replace(phoneMatch[0], ''));
        if (phoneContactName) {
          yakiniAdSoyad = phoneContactName;
        }
      }

      // Benzersiz ID oluştur
      const baseSlug = slugify(`${adSoyad}-${vefatTarihi}`);
      const hash = createShortHash(`${adSoyad}_${vefatTarihi}_${data['taziye adresi'] || ''}_${data['yaş'] || ''}`);
      const belediyeId = `${baseSlug}-${hash}`;

      const taziye: TaziyeDetail = {
        id: `besni_${belediyeId}`,
        ilce: 'besni',
        ilceAdi: 'Besni',
        belediyeId,
        adSoyad,
        yas: data['yaş'] || data['yas'] || '',
        vefatTarihi,
        yakiniAdSoyad,
        yakinlik: data['yakınlığı'] || '',
        yakiniGsm,
        cenazeNamazi: '',
        definYeri: data['defin yeri'] || '',
        definIlIlce: 'Adıyaman / Besni',
        taziyeEvi: data['taziye adresi'] || '',
        taziyeAdresi: data['taziye adresi'] || '',
        ayrintiliYakinlik: [data['yakını'], data['yakınları']].filter(Boolean).join(' | '),
        kaynak: 'belediye_otomatik',
        olusturulmaTarihi: new Date().toISOString(),
        durum: 'aktif',
      };

      items.push(taziye);
    });

    return items;
  } catch (error) {
    console.error('Besni scraper hatası:', error);
    throw error;
  }
}
