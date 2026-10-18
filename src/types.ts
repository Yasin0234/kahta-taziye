export interface TaziyeDetail {
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
  kaynak: 'belediye_otomatik' | 'admin_manuel';
  olusturulmaTarihi: string;
  durum: 'aktif' | 'arsiv';
}

export interface SyncResult {
  toplamBulunan: number;
  yeniEklenenler: number;
  atlananlar: number;
  bildirimGonderilenler: number;
  hatalar: string[];
  eklenenTaziyeler: TaziyeDetail[];
}
