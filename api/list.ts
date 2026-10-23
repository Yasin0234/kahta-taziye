import type { IncomingMessage, ServerResponse } from 'http';
import { getFirestore } from '../src/firebase';

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] | undefined };
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (body: any) => VercelResponse;
}

const COLLECTION_NAME = process.env.FIRESTORE_COLLECTION || 'taziyeler';

/**
 * Adıyaman Güncel Admin ve Mobil Uygulamalar için Firestore Taziye Listeleme API'si.
 * Filtreler:
 *  - ?ilce=besni | kahta | merkez
 *  - ?durum=aktif | arsiv
 *  - ?limit=50 (varsayılan: 50, maks: 100)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const db = getFirestore();
    const ilce = req.query?.ilce as string | undefined;
    const durum = req.query?.durum as string | undefined;
    const limitNum = Math.min(Math.max(parseInt((req.query?.limit as string) || '50', 10) || 50, 1), 100);

    let query: FirebaseFirestore.Query = db.collection(COLLECTION_NAME);

    if (ilce && ilce !== 'tumu' && ilce !== 'all') {
      query = query.where('ilce', '==', ilce.toLowerCase());
    }

    if (durum) {
      query = query.where('durum', '==', durum);
    }

    query = query.orderBy('olusturulmaTimestamp', 'desc').limit(limitNum);

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      count: items.length,
      ilce: ilce || 'tum_ilceler',
      data: items,
    });
  } catch (error: any) {
    console.error('Firestore listeleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Taziye kayıtları listelenirken hata oluştu',
      error: error?.message || 'Bilinmeyen hata',
    });
  }
}
