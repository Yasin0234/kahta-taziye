import admin from 'firebase-admin';
import {
  DISTRICT_CONFIGS,
  scrapeDistrict,
  scrapeAllDistricts,
} from './scrapers';
import { getFirestore, getMessaging } from './firebase';
import { DistrictId, DistrictSyncResult, SyncResult, TaziyeDetail } from './types';

const COLLECTION_NAME = process.env.FIRESTORE_COLLECTION || 'taziyeler';

/**
 * Belirli bir ilçenin taziye ilanlarını Firestore ve FCM ile senkronize eder.
 */
export async function syncDistrict(districtId: DistrictId): Promise<DistrictSyncResult> {
  const config = DISTRICT_CONFIGS[districtId];
  const ilceAdi = config ? config.name : districtId.toUpperCase();
  const fcmTopic = config ? config.fcmTopic : `taziyeler_${districtId}`;
  const channelId = config ? config.channelId : `taziye_bildirimleri_${districtId}`;

  const result: DistrictSyncResult = {
    ilce: districtId,
    ilceAdi,
    toplamBulunan: 0,
    yeniEklenenler: 0,
    atlananlar: 0,
    bildirimGonderilenler: 0,
    hatalar: [],
    eklenenTaziyeler: [],
  };

  console.log(`\n🔄 [${ilceAdi}] Taziye senkronizasyonu başlatılıyor...`);

  let scrapedList: TaziyeDetail[] = [];
  try {
    scrapedList = await scrapeDistrict(districtId);
  } catch (scrapeErr: any) {
    const errMsg = `Scraper hatası (${districtId}): ${scrapeErr?.message || scrapeErr}`;
    console.error(`❌ ${errMsg}`);
    result.hatalar.push(errMsg);
    return result;
  }

  result.toplamBulunan = scrapedList.length;
  console.log(`📋 [${ilceAdi}] ${scrapedList.length} adet ilan çekildi.`);

  const db = getFirestore();
  const messaging = getMessaging();

  for (const taziye of scrapedList) {
    const docId = taziye.id || `${districtId}_${taziye.belediyeId}`;

    try {
      const docRef = db.collection(COLLECTION_NAME).doc(docId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        // Kayıt önceden mevcut, atla
        result.atlananlar++;
        continue;
      }

      // Yeni kayıt: Firestore verisi hazırla
      const firestoreData: any = {
        ...taziye,
        id: docId,
        ilce: districtId,
        ilceAdi,
        fcmTopic,
        olusturulmaTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(firestoreData);
      result.yeniEklenenler++;
      result.eklenenTaziyeler.push(firestoreData);
      console.log(`✨ [${ilceAdi}] Yeni taziye eklendi: [${taziye.belediyeId}] ${taziye.adSoyad}`);

      // Push Bildirimi Gönder (İlçeye özel FCM Topic)
      try {
        const title = `🕊️ [${ilceAdi}] Vefat ve Taziye İlanı`;
        let body = `${taziye.adSoyad} vefat etmiştir.`;
        if (taziye.taziyeEvi || taziye.taziyeAdresi) {
          body += ` Taziye: ${taziye.taziyeEvi || taziye.taziyeAdresi}`;
        }

        const notificationPayload = {
          title,
          body,
        };

        const dataPayload: Record<string, string> = {
          taziyeId: docId,
          ilce: districtId,
          ilceAdi,
          belediyeId: taziye.belediyeId || '',
          adSoyad: taziye.adSoyad || '',
          yas: taziye.yas || '',
          vefatTarihi: taziye.vefatTarihi || '',
          taziyeEvi: taziye.taziyeEvi || taziye.taziyeAdresi || '',
          definYeri: taziye.definYeri || '',
          yakiniGsm: taziye.yakiniGsm || '',
          yakiniAdSoyad: taziye.yakiniAdSoyad || '',
          yakinlik: taziye.yakinlik || '',
          type: 'YENI_TAZIYE',
          click_action: 'OPEN_TAZIYE_DETAIL',
        };

        // İlçeye özel bildirim gönderimi
        const message: admin.messaging.Message = {
          topic: fcmTopic,
          notification: notificationPayload,
          data: dataPayload,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId,
            },
          },
        };

        const response = await messaging.send(message);
        result.bildirimGonderilenler++;
        console.log(`📢 [${ilceAdi}] FCM bildirimi yollandı (${taziye.adSoyad}) -> Topic: ${fcmTopic} [${response}]`);

        // Kahta için eski topic uyumluluğu (Eski Kahta Cepte kullanıcılarının bildirimi kaçırmaması için)
        if (districtId === 'kahta' && process.env.FCM_TOPIC_LEGACY !== 'false') {
          const legacyTopic = process.env.FCM_TOPIC || 'taziyeler';
          if (legacyTopic !== fcmTopic) {
            try {
              await messaging.send({
                ...message,
                topic: legacyTopic,
              });
              console.log(`📢 [Kahta] Eski topic'e bildirim iletildi (${legacyTopic})`);
            } catch (legacyErr) {
              // Kritik değil
            }
          }
        }

        // Genel Adıyaman topic'i açıksa (Adıyaman Güncel Cepte için)
        if (process.env.FCM_TOPIC_ALL) {
          try {
            await messaging.send({
              ...message,
              topic: process.env.FCM_TOPIC_ALL,
            });
            console.log(`📢 [${ilceAdi}] Genel Adıyaman topic'ine bildirim iletildi (${process.env.FCM_TOPIC_ALL})`);
          } catch (allTopicErr) {
            // Kritik değil
          }
        }
      } catch (fcmError: any) {
        console.error(`⚠️ [${ilceAdi}] Bildirim gönderme hatası (${taziye.adSoyad}):`, fcmError?.message || fcmError);
        result.hatalar.push(`FCM (${taziye.adSoyad}): ${fcmError?.message || 'Bilinmeyen hata'}`);
      }
    } catch (dbError: any) {
      console.error(`❌ [${ilceAdi}] Firestore kayıt hatası (${docId}):`, dbError?.message || dbError);
      result.hatalar.push(`Firestore (${docId}): ${dbError?.message || 'Bilinmeyen hata'}`);
    }
  }

  console.log(`✅ [${ilceAdi}] Senkronizasyon bitti: ${result.yeniEklenenler} yeni, ${result.atlananlar} mevcut.`);
  return result;
}

/**
 * Tüm ilçeleri veya tek bir ilçeyi senkronize eder.
 * @param districtId Eğer verilirse sadece o ilçeyi, verilmezse tüm ilçeleri senkronize eder.
 */
export async function syncTaziyeler(districtId?: DistrictId): Promise<SyncResult> {
  const finalResult: SyncResult = {
    toplamBulunan: 0,
    yeniEklenenler: 0,
    atlananlar: 0,
    bildirimGonderilenler: 0,
    hatalar: [],
    eklenenTaziyeler: [],
    ilceSonuclari: {},
  };

  const targetDistricts = districtId
    ? [districtId.toLowerCase()]
    : Object.keys(DISTRICT_CONFIGS);

  console.log(`🚀 Taziye senkronizasyonu başlatılıyor. Hedef İlçeler: ${targetDistricts.join(', ')}`);

  for (const id of targetDistricts) {
    try {
      const districtRes = await syncDistrict(id);
      if (finalResult.ilceSonuclari) {
        finalResult.ilceSonuclari[id] = districtRes;
      }
      finalResult.toplamBulunan += districtRes.toplamBulunan;
      finalResult.yeniEklenenler += districtRes.yeniEklenenler;
      finalResult.atlananlar += districtRes.atlananlar;
      finalResult.bildirimGonderilenler += districtRes.bildirimGonderilenler;
      finalResult.hatalar.push(...districtRes.hatalar);
      finalResult.eklenenTaziyeler.push(...districtRes.eklenenTaziyeler);
    } catch (err: any) {
      const errMsg = `Genel ilçe senkronizasyon hatası (${id}): ${err?.message || err}`;
      console.error(`❌ ${errMsg}`);
      finalResult.hatalar.push(errMsg);
    }
  }

  console.log(`\n🎉 BÜTÜN SENKRONİZASYON TAMAMLANDI!`);
  console.log(`📊 Toplam Bulunan: ${finalResult.toplamBulunan}`);
  console.log(`✨ Yeni Eklenen: ${finalResult.yeniEklenenler}`);
  console.log(`⏭️ Önceden Ekli: ${finalResult.atlananlar}`);
  console.log(`📢 Bildirim Sayısı: ${finalResult.bildirimGonderilenler}`);
  if (finalResult.hatalar.length > 0) {
    console.warn(`⚠️ Karşılaşılan Hata Sayısı: ${finalResult.hatalar.length}`);
  }

  return finalResult;
}
