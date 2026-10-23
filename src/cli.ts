import { syncTaziyeler } from './sync';

async function main() {
  const args = process.argv.slice(2);
  let targetIlce: string | undefined = undefined;

  for (const arg of args) {
    if (arg.startsWith('--ilce=')) {
      targetIlce = arg.split('=')[1];
    } else if (arg === '-i' || arg === '--ilce') {
      const idx = args.indexOf(arg);
      if (idx !== -1 && args[idx + 1]) {
        targetIlce = args[idx + 1];
      }
    }
  }

  if (targetIlce) {
    console.log(`🎯 Tekil ilçe senkronizasyonu seçildi: "${targetIlce}"`);
  } else {
    console.log('🌍 Tüm Adıyaman ilçeleri (Kahta, Besni, Merkez...) senkronize edilecek.');
  }

  try {
    const result = await syncTaziyeler(targetIlce);
    console.log('\n========================================');
    console.log('📌 ÖZET SONUÇ:');
    console.log(`- Toplam Taranan: ${result.toplamBulunan}`);
    console.log(`- Yeni Kaydedilen: ${result.yeniEklenenler}`);
    console.log(`- Önceden Ekli (Atlanan): ${result.atlananlar}`);
    console.log(`- Bildirim Gönderilen: ${result.bildirimGonderilenler}`);
    console.log(`- Hatalar: ${result.hatalar.length}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Kritik CLI Hatası:', error);
    process.exit(1);
  }
}

main();
