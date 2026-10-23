import { DistrictConfig, DistrictId, TaziyeDetail } from '../types';
import { scrapeKahta } from './kahta';
import { scrapeBesni } from './besni';
import { scrapeMerkez } from './merkez';

export { scrapeKahta, scrapeBesni, scrapeMerkez };

export const DISTRICT_CONFIGS: Record<string, DistrictConfig> = {
  kahta: {
    id: 'kahta',
    name: 'Kahta',
    url: 'https://taziye.kahta.bel.tr',
    fcmTopic: process.env.FCM_TOPIC_KAHTA || 'taziyeler_kahta',
    channelId: 'taziye_bildirimleri_kahta',
    enabled: true,
  },
  besni: {
    id: 'besni',
    name: 'Besni',
    url: 'https://besni.bel.tr/sayfa/VefatEdenler',
    fcmTopic: process.env.FCM_TOPIC_BESNI || 'taziyeler_besni',
    channelId: 'taziye_bildirimleri_besni',
    enabled: true,
  },
  merkez: {
    id: 'merkez',
    name: 'Adıyaman Merkez',
    url: 'https://adiyaman.bel.tr/TAZIYE-ILANLARI',
    fcmTopic: process.env.FCM_TOPIC_MERKEZ || 'taziyeler_merkez',
    channelId: 'taziye_bildirimleri_merkez',
    enabled: true,
  },
};

export type DistrictScraperFn = () => Promise<TaziyeDetail[]>;

export const DISTRICT_SCRAPERS: Record<string, DistrictScraperFn> = {
  kahta: scrapeKahta,
  besni: scrapeBesni,
  merkez: scrapeMerkez,
};

/**
 * Belirtilen ilçenin scraper'ını çalıştırır.
 */
export async function scrapeDistrict(districtId: DistrictId): Promise<TaziyeDetail[]> {
  const scraper = DISTRICT_SCRAPERS[districtId.toLowerCase()];
  if (!scraper) {
    throw new Error(`Desteklenmeyen ilçe scraper'ı: "${districtId}". Mevcut ilçeler: ${Object.keys(DISTRICT_SCRAPERS).join(', ')}`);
  }
  return await scraper();
}

/**
 * Tüm kayıtlı ilçelerin ilanlarını çeker. Bir ilçe hata verse bile diğerleri devam eder.
 */
export async function scrapeAllDistricts(): Promise<{ [districtId: string]: TaziyeDetail[] }> {
  const results: { [districtId: string]: TaziyeDetail[] } = {};

  const entries = Object.entries(DISTRICT_SCRAPERS);
  await Promise.all(
    entries.map(async ([id, scraper]) => {
      try {
        const data = await scraper();
        results[id] = data;
      } catch (err) {
        console.error(`İlçe scraper hatası (${id}):`, err);
        results[id] = [];
      }
    })
  );

  return results;
}

/**
 * Geriye dönük uyumluluk için ana scrape fonksiyonu.
 * İlçe verilmezse tüm ilçeleri tek bir dizi halinde döndürür.
 */
export async function scrapeTaziyeler(districtId?: DistrictId): Promise<TaziyeDetail[]> {
  if (districtId) {
    return await scrapeDistrict(districtId);
  }
  const all = await scrapeAllDistricts();
  return Object.values(all).flat();
}
