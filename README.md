# 🕊️ Kahta Taziye Otomasyonu, Firestore Senkronizasyonu & Mobil Bildirim Sistemi

Bu proje, [taziye.kahta.bel.tr](https://taziye.kahta.bel.tr/) sitesindeki taziye ilanlarını periyodik olarak tarayan, **Cloud Firestore** veritabanına otomatik aktaran ve Google Play'deki **Android (Java)** uygulamanıza **Firebase Cloud Messaging (FCM)** üzerinden anlık bildirim gönderen uçtan uca otomasyon sistemidir.

---

## 📋 Genel Özellikler

- **Akıllı Web Scraper:** Belediye portalındaki taziye kartlarını ve `modal.php` üzerinden detaylı defin, taziye evi ve akrabalık bilgilerini çeker.
- **Mükerrer Kontrolü:** Her taziye ilanının belediye ID'sini (`kahta_809` vb.) baz alarak Firestore'da sadece yeni eklenen kayıtları tespit eder.
- **FCM Topic Bildirimi:** Yeni bir ilan düştüğü anda kayıtlı tüm kullanıcılara başlık, özet ve taziye evi bilgilerini içeren bildirim iletir.
- **Admin App ile %100 Uyum:** Admin uygulamanızdan elle girdiğiniz ilanlar bozulmaz. Belediye ilanları `kaynak: "belediye_otomatik"`, admin ilanları `kaynak: "admin_manuel"` olarak etiketlenir.
- **GitHub & Vercel Dağıtımı:** Vercel üzerinde sıfır sunucu maliyetiyle serverless çalışır; GitHub Actions ile 10-15 dakikada bir otomatik tetiklenir.

---

## 🛠️ Kurulum ve Dağıtım Adımları

### 1. Firebase Hizmet Hesabı Anahtarını (Service Account) Alma
1. [Firebase Console](https://console.firebase.google.com/)'a gidin ve projenizi açın.
2. ⚙️ **Proje Ayarları** > **Hizmet Hesapları (Service accounts)** sekmesine gelin.
3. **Yeni özel anahtar oluştur (Generate new private key)** butonuna tıklayın.
4. İnen `.json` dosyasını açın. Bu dosyadaki tüm içeriği kopyalayın (tek satır string veya Base64 olarak saklayabilirsiniz).

---

### 2. GitHub Deposu Oluşturma ve Kodu Yükleme
Proje klasörünüzde terminali açın:

```bash
git init
git add .
git commit -m "feat: Kahta taziye scraper and fcm notification service"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/kahta-taziye-sync.git
git push -u origin main
```

---

### 3. Vercel Dağıtımı ve Ortam Değişkenleri (Environment Variables)
1. [Vercel](https://vercel.com/) paneline giriş yapın ve **Add New Project** diyerek GitHub deponuzu seçin.
2. **Environment Variables** bölümüne şunları ekleyin:
   - `FIREBASE_SERVICE_ACCOUNT`: Firebase'den indirdiğiniz JSON metninin tamamı.
   - `FIRESTORE_COLLECTION`: `taziyeler` (veya uygulamanızın kullandığı koleksiyon adı).
   - `FCM_TOPIC`: `taziyeler` (Android uygulamanızın abone olduğu konu).
   - `CRON_SECRET`: Güçlü bir şifre (örnek: `kahta_guvenli_taziye_token_2026`).
3. **Deploy** butonuna basın. Projeniz dağıtılacak ve size bir URL verilecektir (örnek: `https://kahta-taziye-sync.vercel.app`).

---

### 4. GitHub Actions ile 24/7 Ücretsiz Otomatik Tetikleme
Vercel Hobby planında cron kısıtlamalarına takılmamak için GitHub Actions workflow'u hazırlandı:
1. GitHub deponuzda **Settings** > **Secrets and variables** > **Actions** sayfasına gidin.
2. **New repository secret** butonuna tıklayarak şu iki değişkeni ekleyin:
   - `VERCEL_PROJECT_URL`: `https://kahta-taziye-sync.vercel.app` (Vercel adresiniz, sonunda `/` olmadan).
   - `CRON_SECRET`: Vercel'e girdiğiniz `CRON_SECRET` şifresinin aynısı.
3. Artık `.github/workflows/cron.yml` dosyası her 15 dakikada bir otomatik çalışarak Vercel'i tetikleyecektir.
4. Ayrıca GitHub **Actions** sekmesinden istediğiniz zaman **Run workflow** diyerek testi hemen başlatabilirsiniz.

---

## 📱 Android Uygulamanız (Java) İçin Entegrasyon Notları

### 1. FCM Konu Aboneliği (Topic Subscription)
Uygulamanız açıldığında (örneğin `MainActivity.java` içinde) kullanıcıları bildirim konusuna abone edin:

```java
import com.google.firebase.messaging.FirebaseMessaging;

// MainActivity onCreate içinde:
FirebaseMessaging.getInstance().subscribeToTopic("taziyeler")
    .addOnCompleteListener(task -> {
        if (task.isSuccessful()) {
            Log.d("FCM", "Taziyeler konusuna abone olundu");
        }
    });
```

### 2. Firestore'dan Veri Çekme (Java)
Verileri en yeni eklenen en üstte olacak şekilde dinleyin:

```java
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;

FirebaseFirestore db = FirebaseFirestore.getInstance();
db.collection("taziyeler")
    .orderBy("olusturulmaTimestamp", Query.Direction.DESCENDING)
    .addSnapshotListener((value, error) -> {
        if (error != null) {
            return;
        }
        // Listenizi güncelleyin
    });
```

### 3. Firestore Belge Şeması
Otomasyonun Firestore'a yazdığı belge yapısı:

```json
{
  "id": "kahta_809",
  "belediyeId": "809",
  "adSoyad": "HALİME YANAK",
  "yas": "76",
  "vefatTarihi": "18.10.2026",
  "yakiniAdSoyad": "H. OSMAN YANAK",
  "yakinlik": "EŞİ",
  "yakiniGsm": "0535 510 13 35",
  "cenazeNamazi": "SAAT 10:00'DA AKKUŞ KÖYÜ",
  "definYeri": "AKKUŞ KÖYÜ ĞIREWE",
  "definIlIlce": "KAHTA / ADIYAMAN",
  "taziyeEvi": "AKKUŞ KÖYÜ TAZİYE EVİ",
  "taziyeAdresi": "",
  "ayrintiliYakinlik": "MAHMUT, İHSAN,RAMAZAN, İSMAİL VE ŞUAYİP YANAK'IN ANNESİ",
  "kaynak": "belediye_otomatik",
  "durum": "aktif",
  "olusturulmaTarihi": "2026-10-18T22:11:46.954Z",
  "olusturulmaTimestamp": "(Firestore ServerTimestamp)"
}
```

---

## 🧪 Yerel Ortamda Test Etme

1. `.env.example` dosyasını kopyalayıp `.env` adıyla kaydedin ve bilgilerinizi doldurun.
2. Yalnızca scraper çıktısını test etmek için:
   ```bash
   npm run test:scrape
   ```
3. Firestore ve FCM entegrasyonuyla beraber yerel test çalıştırmak için:
   ```bash
   npm run dev
   ```
