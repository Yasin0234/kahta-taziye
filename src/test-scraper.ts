import { scrapeTaziyeler } from './scraper';

async function main() {
  console.log('🔍 Kahta Taziye scraper başlatılıyor...');
  const start = Date.now();
  const taziyeler = await scrapeTaziyeler();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`✅ Toplam ${taziyeler.length} adet taziye ilanı çekildi (${elapsed} saniye):\n`);
  console.log(JSON.stringify(taziyeler.slice(0, 3), null, 2));
}

main().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
