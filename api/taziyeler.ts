import type { IncomingMessage, ServerResponse } from 'http';
import { scrapeTaziyeler } from '../src/scrapers';

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] | undefined };
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (body: any) => VercelResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const rawIlce = (req.query?.ilce || req.query?.district) as string | undefined;

  try {
    const list = await scrapeTaziyeler(rawIlce);
    res.status(200).json({
      success: true,
      ilce: rawIlce || 'tumu',
      count: list.length,
      data: list,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Veri çekme hatası',
      error: error?.message || 'Bilinmeyen hata',
    });
  }
}
