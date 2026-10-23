export type DistrictId = 'kahta' | 'besni' | 'merkez' | string;

export interface DistrictConfig {
  id: DistrictId;
  name: string; // 'Kahta', 'Besni', 'Adıyaman Merkez'
  url: string;
  fcmTopic: string;
  channelId: string;
  enabled: boolean;
}

export interface TaziyeDetail {
  id?: string; // örn: kahta_123, besni_nursen-arslan-20-ekim-2026, merkez_13962
  ilce: DistrictId; // 'kahta' | 'besni' | 'merkez'
  ilceAdi: string; // 'Kahta' | 'Besni' | 'Adıyaman Merkez'
  belediyeId: string;
  adSoyad: string;
  yas: string;
  vefatTarihi: string;
  yakiniAdSoyad: string;
  yakinlik: string;
  yakiniGsm: string;
  cenazeNamazi: string;
  definYeri: string;
  definIlIlce: string;
  taziyeEvi: string;
  taziyeAdresi: string;
  ayrintiliYakinlik: string;
  taziyeGunu?: string; // örn: "İlk Gün", "2. Gün", "Son Gün" (Adıyaman Merkez'de yer alıyor)
  kaynak: 'belediye_otomatik' | 'admin_manuel';
  olusturulmaTarihi: string;
  durum: 'aktif' | 'arsiv';
  fcmTopic?: string;
}

export interface DistrictSyncResult {
  ilce: DistrictId;
  ilceAdi: string;
  toplamBulunan: number;
  yeniEklenenler: number;
  atlananlar: number;
  bildirimGonderilenler: number;
  hatalar: string[];
  eklenenTaziyeler: TaziyeDetail[];
}

export interface SyncResult {
  toplamBulunan: number;
  yeniEklenenler: number;
  atlananlar: number;
  bildirimGonderilenler: number;
  hatalar: string[];
  eklenenTaziyeler: TaziyeDetail[];
  ilceSonuclari?: Record<string, DistrictSyncResult>;
}
