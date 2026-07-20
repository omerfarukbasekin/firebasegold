# [TR] GoldX | Live Gold Price Dashboard 🪙📈

Bu proje, Cloud Firestore veritabanını gerçek zamanlı (real-time) dinleyen ve canlı altın fiyatı değişimlerini parıldayan grafiklerle görselleştiren modern bir web kontrol panelidir (dashboard).

---

## 🎨 Özellikler ve Teknolojiler

- **Canlı Güncellemeler:** Firebase Firestore SDK entegrasyonu sayesinde sayfa yenilenmeden, arka plandaki servis veri yazdığı anda fiyat kartları yeşil (artış) veya kırmızı (azalış) efektle parlar.
- **Modern Arayüz (UI):** Tailwind CSS ve glassmorphism efekti kullanılarak finans terminalleri tarzında şık, koyu renkli (dark mode) arayüz tasarlandı.
- **Parıldayan Grafikler:** Chart.js kütüphanesi kullanılarak alış ve satış fiyatları degrade (gradient) dolgu rengiyle çizgi grafik olarak görselleştirilir.
- **Tarih Filtreleri:** 24 Saat, 1 Hafta, 1 Ay ve Tüm Geçmiş verileri anlık olarak Firestore sorgularıyla çekilir.
- **Özet İstatistikler:** Seçili aralığa göre makas oranı (spread), günün en düşüğü, en yükseği ve ortalama fiyat değerleri anında hesaplanır.

---

## 📁 Proje Dosya Düzeni

```text
firebase_gold/
├── .firebase/            # Firebase yerel önbellek dizini (Git'e atılmaz)
├── .firebaserc           # Firebase hedef proje eşleşme dosyası
├── firebase.json         # Firebase Hosting kuralları ve yönlendirme ayarları
└── public/
    ├── app.js            # Firestore'u dinleyen ve grafikleri güncelleyen lojik dosya
    └── index.html        # Tailwind CSS ve Chart.js entegreli HTML5 arayüzü
```

---

## 🚀 Yayına Alma (Deployment)

Projeniz **Firebase Hosting** üzerinde çalışacak şekilde yapılandırılmıştır.

### 1. Firebase CLI Yükleme ve Giriş
Terminalinizde Firebase komut satırı aracının kurulu olduğundan ve giriş yaptığınızdan emin olun:
```bash
# Firebase CLI kurulu değilse:
brew install node
npm install -g firebase-tools

# Firebase hesabınıza giriş yapın:
firebase login
```

---

## 🔒 Firebase Security Rules (Güvenlik Kuralları)

Web sitesinin Firestore veritabanındaki verileri dışarıdan başarıyla okuyabilmesi (ve grafik oluşturabilmesi), ancak kötü niyetli kişilerin verileri değiştirememesi için aşağıdaki güvenlik kurallarını (Security Rules) kurmanız gerekmektedir:

### Kuralların Kurulumu:
1. **[Firebase Console](https://console.firebase.google.com/)**'a girin.
2. Projenizi seçip sol menüden **Firestore Database** seçeneğine tıklayın.
3. Üst menüden **Rules (Kurallar)** sekmesine gidin.
4. Mevcut kodu silip aşağıdaki kuralları yapıştırın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;    // Herkes okuyabilsin (Web sitesinin çalışması için)
      allow write: if false;  // Sadece arka plandaki güvenli API/Python yazabilsin
    }
  }
}
```
5. Sağ üstteki **Publish (Yayınla)** butonuna basarak kuralları canlıya alın.

---

## 📊 Firestore Veri Yapısı (Schema)

Proje verileri Firestore üzerinde son derece verimli, tekil (idempotent) ve iki aşamalı bir koleksiyon yapısıyla saklanır:

```text
/gold_prices (Koleksiyon)
  ├── {GOLD_CODE} (Belge - Örn: "GA" veya "C")
        ├── code: "GA" (String)
        ├── description: "Gram Altın" (String)
        ├── price_buy: 2450.50 (Number / Double)
        ├── price_sell: 2470.80 (Number / Double)
        ├── source_updated_at: July 20, 2026 at 9:53:18 AM UTC+3 (Timestamp)
        ├── updated_at: July 20, 2026 at 9:53:18 AM UTC+3 (Timestamp)
        └── /history (Alt Koleksiyon)
              └── {doc_id} (Belge - Örn: "2026-07-20_06-53-17")
                    ├── price_buy: 2450.50 (Number)
                    ├── price_sell: 2470.80 (Number)
                    ├── source_updated_at: July 20, 2026 at 9:53:18 AM (Timestamp)
                    └── created_at: July 20, 2026 at 9:53:18 AM (Timestamp)
```

- **`gold_prices` ana dokümanı:** Dashboard'un sol sidebarındaki güncel anlık fiyat listesini doldurmak için gerçek zamanlı dinlenir. Arka plan servisimiz burayı her güncellemede üstüne yazar (overwrites).
- **`history` alt koleksiyonu:** Grafiklerin çizilmesi için tarihsel veriyi saklar. `doc_id` olarak veri çekilme saati (`YYYY-MM-DD_HH-MM-SS`) atandığı için, ağ hatalarında veya çakışmalarda **mükerrer (duplicate) kayıt oluşması kesin olarak engellenir**.

---

## 2. Canlıya Dağıtma (Deploy)
Değişiklikleri yayına almak için `firebase_gold` dizininde şu komutu çalıştırın:
```bash
firebase deploy --only hosting
```

Bu işlemden sonra projeniz otomatik olarak canlıya alınacak ve size benzersiz bir alt alan adı sunacaktır (örn: `https://projectgold-6b3bf.web.app`).

---
---

# [EN] GoldX | Live Gold Price Dashboard 🪙📈

This project is a modern web control panel (dashboard) that listens to a Cloud Firestore database in real-time and visualizes live gold price updates using beautiful, interactive charts.

---

## 🎨 Features & Tech Stack

- **Real-Time Updates:** Integrates with the Firebase Firestore SDK so that the price cards glow with green (increase) or red (decrease) indicators instantly without requiring page reloads.
- **Modern UI:** Styled using Tailwind CSS and glassmorphism elements to create a sleek, premium dark-themed layout matching traditional finance trading terminals.
- **Vibrant Charts:** Uses Chart.js to render buy and sell prices as clean line graphs with elegant gradient backgrounds.
- **Historical Timeframes:** Instant Firestore queries allow switching data viewpoints between 24 Hours, 1 Week, 1 Month, and All Timeframes.
- **Dynamic Stats:** Automatically calculates real-time buy-sell spreads, daily low/high margins, and averages based on the active timeframe.

---

## 📁 Project Directory Tree

```text
firebase_gold/
├── .firebase/            # Firebase local cache directory (ignored by Git)
├── .firebaserc           # Mapping config for target Firebase project
├── firebase.json         # Firebase Hosting configurations and rewrites
└── public/
    ├── app.js            # Main JS logic subscribing to Firestore and updating UI/Charts
    └── index.html        # Beautiful dark-mode user interface with Tailwind and Chart.js
```

---

## 🚀 Deployment

The project is preconfigured to be served globally using **Firebase Hosting**.

### 1. Install & Login using Firebase CLI
Make sure you have Node.js and the Firebase CLI installed, and are successfully authenticated:
```bash
# If Firebase CLI is not installed:
brew install node
npm install -g firebase-tools

# Authenticate into your Firebase account:
firebase login
```

### 2. Deploy to Production
Run the deployment command within the `firebase_gold` directory:
```bash
firebase deploy --only hosting
```

Upon completion, your live site will be deployed and accessible through your unique sub-domain (e.g., `https://projectgold-6b3bf.web.app`).
