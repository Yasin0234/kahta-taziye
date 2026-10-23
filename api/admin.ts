import type { IncomingMessage, ServerResponse } from 'http';
import admin from 'firebase-admin';
import { getFirestore, getMessaging } from '../src/firebase';
import { DISTRICT_CONFIGS } from '../src/scrapers';

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] | undefined };
  body: any;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (body: any) => VercelResponse;
}

const COLLECTION_NAME = process.env.FIRESTORE_COLLECTION || 'taziyeler';

/**
 * Adıyaman Güncel Admin Yönetim API'si
 * - POST: Manuel taziye ekleme ve isteğe bağlı bildirim tetikleme
 * - PUT / PATCH: Taziye durumunu güncelleme (örn: 'aktif' -> 'arsiv')
 * - DELETE: Taziye silme
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Admin Güvenlik Anahtarı
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (adminSecret) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');
    if (token !== adminSecret) {
      res.status(401).json({ success: false, message: 'Yetkisiz erişim. Geçerli ADMIN_SECRET gereklidir.' });
      return;
    }
  }

  const db = getFirestore();
  const messaging = getMessaging();

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  // 1. POST: Yeni manuel taziye ekle
  if (req.method === 'POST') {
    const {
      ilce = 'merkez',
      adSoyad,
      yas = '',
      vefatTarihi = new Date().toLocaleDateString('tr-TR'),
      yakiniAdSoyad = '',
      yakinlik = '',
      yakiniGsm = '',
      cenazeNamazi = '',
      definYeri = '',
      taziyeEvi = '',
      taziyeAdresi = '',
      ayrintiliYakinlik = '',
      bildirimGonder = true,
    } = body || {};

    if (!adSoyad) {
      res.status(400).json({ success: false, message: 'adSoyad alanı zorunludur.' });
      return;
    }

    const ilceKey = (ilce as string).toLowerCase();
    const config = DISTRICT_CONFIGS[ilceKey];
    const ilceAdi = config?.name || ilceKey.toUpperCase();
    const fcmTopic = config?.fcmTopic || `taziyeler_${ilceKey}`;
    const channelId = config?.channelId || `taziye_bildirimleri_${ilceKey}`;

    const timestampId = Date.now().toString();
    const docId = `manual_${ilceKey}_${timestampId}`;

    const newRecord = {
      id: docId,
      belediyeId: `manual_${timestampId}`,
      ilce: ilceKey,
      ilceAdi,
      adSoyad,
      yas,
      vefatTarihi,
      yakiniAdSoyad,
      yakinlik,
      yakiniGsm,
      cenazeNamazi,
      definYeri,
      definIlIlce: `Adıyaman / ${ilceAdi}`,
      taziyeEvi: taziyeEvi || taziyeAdresi,
      taziyeAdresi: taziyeAdresi || taziyeEvi,
      ayrintiliYakinlik,
      kaynak: 'admin_manuel',
      durum: 'aktif',
      olusturulmaTarihi: new Date().toISOString(),
      olusturulmaTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      fcmTopic,
    };

    await db.collection(COLLECTION_NAME).doc(docId).set(newRecord);

    let notificationSent = false;
    if (bildirimGonder) {
      try {
        await messaging.send({
          topic: fcmTopic,
          notification: {
            title: `🕊️ [${ilceAdi}] Vefat ve Taziye İlanı`,
            body: `${adSoyad} vefat etmiştir.${taziyeEvi ? ` Taziye: ${taziyeEvi}` : ''}`,
          },
          data: {
            taziyeId: docId,
            ilce: ilceKey,
            ilceAdi,
            adSoyad,
            vefatTarihi,
            taziyeEvi: taziyeEvi || taziyeAdresi,
            type: 'YENI_TAZIYE',
          },
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId },
          },
        });
        notificationSent = true;
      } catch (err: any) {
        console.error('Admin manuel bildirim hatası:', err);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Taziye başarıyla eklendi',
      docId,
      notificationSent,
      data: newRecord,
    });
    return;
  }

  // 2. PUT / PATCH: Güncelleme (örneğin durumu arşiv yapma)
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { id, durum } = body || {};
    if (!id) {
      res.status(400).json({ success: false, message: 'Güncellenecek taziye "id" alanı zorunludur.' });
      return;
    }

    const updatePayload: Record<string, any> = {};
    if (durum) updatePayload.durum = durum;

    await db.collection(COLLECTION_NAME).doc(id).update(updatePayload);
    res.status(200).json({ success: true, message: 'Kayıt güncellendi', id, updatePayload });
    return;
  }

  // 3. DELETE: Kayıt silme
  if (req.method === 'DELETE') {
    const id = (req.query?.id as string) || body?.id;
    if (!id) {
      res.status(400).json({ success: false, message: 'Silinecek "id" parametresi zorunludur.' });
      return;
    }

    await db.collection(COLLECTION_NAME).doc(id).delete();
    res.status(200).json({ success: true, message: 'Kayıt başarıyla silindi', id });
    return;
  }

  res.status(405).json({ success: false, message: 'Desteklenmeyen HTTP metodu.' });
}
