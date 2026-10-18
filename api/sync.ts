import type { IncomingMessage, ServerResponse } from 'http';
import { syncTaziyeler } from '../src/sync';

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] | undefined };
  body: any;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (body: any) => VercelResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Başlıkları
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Güvenlik Doğrulaması (CRON_SECRET)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    const queryKey = req.query?.key;
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` || queryKey === cronSecret;

    if (!isAuthorized) {
      res.status(401).json({
        success: false,
        message: 'Yetkisiz erişim. Geçerli bir CRON_SECRET sağlayın.',
      });
      return;
    }
  }

  try {
    const result = await syncTaziyeler();
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error: any) {
    console.error('API Sync Hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Senkronizasyon sırasında hata oluştu',
      error: error?.message || 'Bilinmeyen hata',
    });
  }
}
