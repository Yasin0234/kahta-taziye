import dotenv from 'dotenv';
dotenv.config();

import { syncTaziyeler } from './sync';

async function run() {
  console.log('🚀 Kahta Taziye Otomasyonu (Manuel Çalıştırma)');
  try {
    const result = await syncTaziyeler();
    console.log('📊 Sonuç:', result);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

run();
