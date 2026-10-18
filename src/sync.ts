import admin from 'firebase-admin';
import { scrapeTaziyeler } from './scraper';
import { getFirestore, getMessaging } from './firebase';
import { SyncResult, TaziyeDetail } from './types';

const COLLECTION_NAME = process.env.FIRESTORE_COLLECTION || 'taziyeler';
const FCM_TOPIC = process.env.FCM_TOPIC || 'taziyeler';

/**
 * Kahta sitesindeki taziye verilerini Firestore ile eşitler ve yeni kayıtlar için bildirim gönderir.
 */
export async function syncTaziyeler(): Promise<SyncResult> {
  const result: SyncResult = {
    toplamBulunan: 0,
    yeniEklenenler: 0,
    atlananlar: 0,
    bildirimGonderilenler: 0,
    hatalar: [],
    eklenenTaziyeler: [],
  };

  console.log('🔄 Taziye senkronizasyonu başlatılıyor...');
  const scrapedList = await scrapeTaziyeler();
  result.toplamBulunan = scrapedList.length;

  const db = getFirestore();
  const messaging = getMessaging();

  for (const taziye of scrapedList) {
    try {
      const docId = `kahta_${taziye.belediyeId}`;
      const docRef = db.collection(COLLECTION_NAME).doc(docId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        // Kayıt zaten mevcut, atla
        result.atlananlar++;
        continue;
      }

      // Yeni kayıt: Firestore'a ekle
      const firestoreData = {
        ...taziye,
        id: docId,
        olusturulmaTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(firestoreData);
      result.yeniEklenenler++;
      result.eklenenTaziyeler.push(taziye);
      console.log(`✨ Yeni taziye eklendi: [${taziye.belediyeId}] ${taziye.adSoyad}`);

      // Push Bildirimi Gönder (FCM Topic)
      try {
        const title = '🕊️ Vefat ve Taziye İlanı';
        let body = `${taziye.adSoyad} vefat etmiştir.`;
        if (taziye.taziyeEvi) {
          body += ` Taziye Yeri: ${taziye.taziyeEvi}`;
        }

        const message: admin.messaging.Message = {
          topic: FCM_TOPIC,
          notification: {
            title,
            body,
          },
          data: {
            taziyeId: docId,
            belediyeId: taziye.belediyeId,
            adSoyad: taziye.adSoyad || '',
            vefatTarihi: taziye.vefatTarihi || '',
            taziyeEvi: taziye.taziyeEvi || '',
            definYeri: taziye.definYeri || '',
            yakiniGsm: taziye.yakiniGsm || '',
            type: 'YENI_TAZIYE',
            click_action: 'OPEN_TAZIYE_DETAIL',
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'taziye_bildirimleri',
            },
          },
        };

        const response = await messaging.send(message);
        result.bildirimGonderilenler++;
        console.log(`📢 Bildirim gönderildi (${taziye.adSoyad}): ${response}`);
      } catch (fcmError: any) {
        console.error(`⚠️ Bildirim gönderme hatası (${taziye.adSoyad}):`, fcmError?.message || fcmError);
        result.hatalar.push(`FCM (${taziye.adSoyad}): ${fcmError?.message || 'Bilinmeyen hata'}`);
      }
    } catch (dbError: any) {
      console.error(`❌ Firestore kayıt hatası (${taziye.belediyeId}):`, dbError?.message || dbError);
      result.hatalar.push(`Firestore (${taziye.belediyeId}): ${dbError?.message || 'Bilinmeyen hata'}`);
    }
  }

  console.log(`✅ Senkronizasyon tamamlandı: ${result.yeniEklenenler} yeni eklendi, ${result.atlananlar} önceden mevcuttu.`);
  return result;
}
