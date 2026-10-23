import { scrapeAllDistricts, DISTRICT_CONFIGS } from './scrapers';

async function testAll() {
  console.log('🚀 Çoklu İlçe Taziye Scraper Testi Başlatılıyor...\n');
  const startTime = Date.now();

  const results = await scrapeAllDistricts();

  let totalCount = 0;
  for (const [districtId, list] of Object.entries(results)) {
    const config = DISTRICT_CONFIGS[districtId];
    console.log(`\n========================================`);
    console.log(`📍 İlçe: ${config?.name || districtId.toUpperCase()} (${districtId})`);
    console.log(`🌐 URL: ${config?.url}`);
    console.log(`📊 Çekilen İlan Sayısı: ${list.length}`);
    console.log(`📢 FCM Topic: ${config?.fcmTopic}`);
    console.log(`========================================`);

    totalCount += list.length;

    // İlk 2 ilanı detaylı göster
    list.slice(0, 2).forEach((item, index) => {
      console.log(`\n  [Örnek İlan ${index + 1}]`);
      console.log(`  - ID: ${item.id}`);
      console.log(`  - Ad Soyad: ${item.adSoyad} (${item.yas ? item.yas + ' yaş' : 'Yaş belirtilmemiş'})`);
      console.log(`  - Vefat/Tarih: ${item.vefatTarihi}`);
      console.log(`  - Taziye Evi: ${item.taziyeEvi || item.taziyeAdresi || 'Belirtilmemiş'}`);
      console.log(`  - Defin Yeri: ${item.definYeri || 'Belirtilmemiş'}`);
      console.log(`  - Yakını: ${item.yakiniAdSoyad} (${item.yakinlik || '-'}) | Tel: ${item.yakiniGsm || '-'}`);
      if (item.taziyeGunu) {
        console.log(`  - Taziye Günü: ${item.taziyeGunu}`);
      }
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\n✅ TEST TAMAMLANDI!`);
  console.log(`⏱️ Toplam Süre: ${elapsed} saniye`);
  console.log(`📈 Toplam Çekilen Taziye: ${totalCount} adet`);
}

testAll().catch(console.error);
