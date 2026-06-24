# 🥗 FoodApp

**Yapay Zeka Destekli Yemek Tanıma ve Beslenme Takip Mobil Uygulaması**

FoodApp; React Native ve Expo ile geliştirilmiş, iOS ve Android uyumlu çapraz platform bir mobil uygulamadır. TensorFlow Lite modeli kullanarak fotoğraflardan yemek tanımlama, günlük beslenme takibi, diyetisyen danışmanlığı ve sosyal sağlık topluluğu özelliklerini tek çatı altında sunar.

---

## 📱 Özellikler

- 🤖 **Yapay Zeka Yemek Tanıma** — Google AIY Food V1 TFLite modeli ile 2.023+ yemek kategorisini fotoğraftan tanımlama
- 📊 **Beslenme Takibi** — Günlük kalori dengesi, makro takibi (protein, yağ, karbonhidrat), yemek ve su günlüğü
- ⚖️ **Kilo ve Aktivite** — Kilo geçmişi grafikleri, adımsayar, egzersiz günlüğü
- 👥 **Sosyal Akış** — Gönderiler, hikâyeler (24 saat), beğeniler, yorumlar, takip sistemi, keşfet
- 💬 **Diyetisyen Sohbeti** — Gerçek zamanlı mesajlaşma, diyet planı oluşturma ve atama
- 🏆 **Oyunlaştırma** — Seri sayaçları, başarı rozetleri, ilerleme grafikleri (7/30/90/180 gün)
- 🔔 **Anlık Bildirimler** — Beğeni, yorum, mesaj ve diyet hatırlatıcıları
- 💎 **Premium Abonelik** — Genişletilmiş geçmiş ve gelişmiş analiz
- 🖥️ **Yönetici Paneli** — Kullanıcı, yapay zeka günlükleri ve diyetisyen onayı yönetimi

---

## 🏗️ Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Mobil Çerçeve | React Native 0.81.5 + Expo SDK 54 |
| Dil (Ön Uç) | TypeScript 5.9.2 |
| Yönlendirme | Expo Router 6 (dosya tabanlı) |
| Yapay Zeka Arka Ucu | Python 3.10 + FastAPI + TFLite (`ai-edge-litert`) |
| Yapay Zeka Modeli | Google AIY Food V1 (2.023 yemek kategorisi) |
| Veritabanı | Supabase (PostgreSQL + Realtime + Storage) |
| Kimlik Doğrulama | Firebase Auth (e-posta/parola + Google OAuth) |
| Yerel Depolama | AsyncStorage |
| Bildirimler | Expo Notifications |
| Tünel (Geliştirme) | ngrok |
| Yönetici Paneli | React + Vite (TypeScript) |

---

## 📂 Proje Yapısı

```
FoodApp/
├── app/                        # Expo Router ekranları
│   ├── (tabs)/                 # Alt sekme ekranları
│   │   ├── home.tsx            # Sosyal akış
│   │   ├── tracking.tsx        # Beslenme gösterge paneli
│   │   ├── profile.tsx         # Kullanıcı profili
│   │   ├── dietitian.tsx       # Diyetisyen dizini
│   │   └── discover.tsx        # Keşfet / Trend içerikler
│   ├── camera.tsx              # Yapay zeka yemek analizi
│   ├── chat.tsx                # Gerçek zamanlı mesajlaşma
│   ├── food-log.tsx            # Manuel yemek girişi
│   ├── weight-tracking.tsx     # Kilo geçmişi
│   ├── login.tsx               # Kimlik doğrulama ekranları
│   └── _layout.tsx             # Kök düzen ve sağlayıcılar
├── context/
│   ├── AuthContext.tsx         # Firebase kimlik doğrulama durumu
│   ├── ThemeContext.tsx        # Koyu/açık tema
│   └── StoryContext.tsx        # Hikâye yönetimi
├── services/
│   ├── firebaseConfig.ts       # Firebase başlatma
│   ├── supabaseConfig.ts       # Supabase istemcisi
│   ├── apiConfig.ts            # FastAPI temel URL'si
│   ├── scraperService.ts       # Besin değeri veri çekici
│   └── notificationService.ts  # Bildirim servisi
├── components/                 # Yeniden kullanılabilir UI bileşenleri
├── admin-panel/                # Web yönetici paneli (Vite)
├── main.py                     # FastAPI yapay zeka çıkarım sunucusu
├── model.tflite                # Hafif TFLite modeli
├── aiy_food_v1.tflite          # Tam AIY Food V1 modeli
├── aiy_food_labels.txt         # 2.023 yemek kategorisi etiketi
└── requirements.txt            # Python bağımlılıkları
```

---

## ⚙️ Ön Koşullar

Sisteminizde aşağıdakilerin kurulu olduğundan emin olun:

| Araç | Sürüm | Kurulum |
|---|---|---|
| Node.js | 18+ LTS | https://nodejs.org |
| npm | 9+ | Node.js ile birlikte gelir |
| Python | 3.10+ | https://python.org |
| Expo CLI | En Son | `npm install -g expo-cli` |
| ngrok | En Son | https://ngrok.com/download |
| Git | 2.38+ | https://git-scm.com |

**iOS testi için:**
- Xcode 15+ yüklü macOS
- iOS Simülatör veya fiziksel iPhone (iOS 15+)

**Android testi için:**
- Android Studio (API 29+ emülatör) VEYA fiziksel Android cihaz (Android 10+)

---

## 🚀 Kurulum ve Başlangıç

### 1. Depoyu Klonla

```bash
git clone https://github.com/Oguzhan1511/FoodApp.git
cd FoodApp
```

---

### 2. Ortam Değişkenlerini Ayarla

Proje kök dizininde `.env` dosyası oluştur:

```bash
# .env dosyasını manuel olarak oluştur
touch .env
```

Aşağıdaki içeriği kendi bilgilerinle doldur:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://proje-adiniz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=supabase-anon-key

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=proje-adiniz.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=firebase-proje-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=proje-adiniz.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=firebase-app-id

# FastAPI (ngrok başlatıldıktan sonra güncellenecek)
EXPO_PUBLIC_API_URL=http://localhost:8000
```

> ⚠️ `.env` dosyasını asla Git'e yükleme. `.gitignore` tarafından zaten hariç tutulmaktadır.

---

### 3. Mobil Uygulama Bağımlılıklarını Kur

```bash
npm install
```

---

### 4. Python Yapay Zeka Arka Ucunu Ayarla

#### 4a. Sanal ortam oluştur

```bash
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
```

#### 4b. Python bağımlılıklarını kur

```bash
pip install fastapi uvicorn ai-edge-litert numpy Pillow python-multipart
```

Veya `requirements.txt` varsa:

```bash
pip install -r requirements.txt
```

#### 4c. Model dosyalarını kontrol et

Proje kök dizininde şu dosyaların bulunduğunu doğrula:

```bash
ls -lh *.tflite aiy_food_labels.txt
```

Beklenen çıktı:
```
-rw-r--r--  aiy_food_labels.txt   (~45 KB)
-rw-r--r--  aiy_food_v1.tflite    (~21 MB)
-rw-r--r--  model.tflite          (~2.6 MB)
```

> TFLite model dosyaları depoya dahil edilmemiştir (boyut nedeniyle). Proje sahibiyle iletişime geçin veya [Google AIY Food V1 model sayfasından](https://www.tensorflow.org/lite/models) indirin.

---

## ▶️ Projeyi Çalıştırma

Projeyi çalıştırmak için **3 ayrı terminal** açman gerekir:

---

### Terminal 1 — Yapay Zeka Arka Uç Sunucusunu Başlat

```bash
cd FoodApp
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Beklenen çıktı:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Sunucunun çalıştığını test et:
```bash
curl http://localhost:8000
# Beklenen: {"message":"NutriVision API running"}
```

---

### Terminal 2 — ngrok Tüneli Başlat

Mobil uygulama `localhost`'a doğrudan erişemez. ngrok kamuya açık bir HTTPS tüneli oluşturur:

```bash
ngrok http 8000
```

Beklenen çıktı:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8000
```

**`https://` URL'sini kopyala** ve `.env` dosyasını güncelle:

```env
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

Ardından Expo uygulamasını yeniden başlat.

> ⚠️ ngrok ücretsiz planda her yeniden başlatmada URL değişir. Bu durumda `.env`'i güncelleyip Expo'yu yeniden başlatman gerekir.

---

### Terminal 3 — Mobil Uygulamayı Başlat

```bash
cd FoodApp
npx expo start
```

Ardından nasıl çalıştırmak istediğini seç:

| Tuş | İşlem |
|---|---|
| `i` | iOS Simülatörde aç |
| `a` | Android Emülatörde aç |
| QR Tara | Fiziksel cihazda Expo Go ile aç |

**Expo Go ile (Fiziksel Cihaz):**
1. App Store veya Google Play'den **Expo Go** uygulamasını indir
2. Telefonun ve bilgisayarın **aynı Wi-Fi ağında** olduğundan emin ol
3. Terminalde görünen QR kodu tara

---

## 🖥️ Yönetici Panelini Çalıştırma

```bash
cd admin-panel
npm install
npm run dev
```

Tarayıcıda http://localhost:5173 adresini aç.

**Yönetici hesabı:** Firebase Authentication üzerinden kullanıcı oluştur ve Supabase `users` tablosunda `role = 'admin'` olarak ayarla.

---

## 🔥 Firebase Kurulumu

1. [Firebase Console](https://console.firebase.google.com)'a git
2. Yeni bir proje oluştur
3. **Authentication → Oturum açma yöntemleri** altında şunları etkinleştir:
   - E-posta/Parola ✅
   - Google ✅
4. Proje Ayarları → Uygulamalar → **Web uygulaması ekle**
5. Yapılandırma değerlerini `.env` dosyasına kopyala
6. **Authentication → Ayarlar → Yetkili alan adları** kısmına ngrok alan adını ekle

---

## 🗄️ Supabase Kurulumu

1. [Supabase](https://supabase.com)'e git ve yeni proje oluştur
2. **SQL Editör**'ü açarak aşağıdaki tabloları oluşturan şemayı çalıştır:
   - `users`, `posts`, `comments`, `likes`, `followers`
   - `stories`, `story_views`, `conversations`, `messages`
   - `diet_plans`, `weight_entries`, `water_entries`
   - `analysis_logs`, `analysis_feedback`, `notifications`
3. Tüm tablolarda **Row Level Security (RLS)** aktif et
4. **Proje URL'si** ve **anon public key**'i `.env` dosyasına kopyala
5. **Storage** → `media` adında yeni bir bucket oluştur (public olarak ayarla)

---

## 🧪 Yapay Zeka Uç Noktasını Test Etme

FastAPI sunucusu ve ngrok çalışırken `/predict` uç noktasını şu şekilde test edebilirsin:

```bash
curl -X POST https://ngrok-url.ngrok-free.app/predict \
  -F "file=@/path/to/yemek-fotografi.jpg"
```

Beklenen yanıt:
```json
{
  "status": "success",
  "predictions": [
    {
      "rank": 1,
      "food_name": "pizza",
      "confidence": 0.8923,
      "nutrition": {
        "calories_per_100g": 266,
        "protein_per_100g": 11.0,
        "fat_per_100g": 10.4,
        "carbs_per_100g": 33.0
      }
    }
  ],
  "top_prediction": "pizza"
}
```

---

## 🐛 Sık Karşılaşılan Sorunlar ve Çözümleri

### ❌ `Error: Port 8000 already in use` (Port zaten kullanımda)

```bash
lsof -ti:8000 | xargs kill -9
```

Ardından FastAPI sunucusunu yeniden başlat.

---

### ❌ Uygulamada yapay zeka analizi "Sunucu Hatası" veriyor

ngrok oturumunun süresi dolmuştur. ngrok'u yeniden başlat, `.env` dosyasındaki `EXPO_PUBLIC_API_URL`'yi güncelle ve Expo'yu yeniden başlat.

---

### ❌ `Sunucu JSON yanıtı döndürmedi` hatası

Uygulama JSON yerine HTML hata sayfası aldı. Şunları kontrol et:
1. `uvicorn` çalışıyor mu? (Terminal 1)
2. `.env` dosyasındaki ngrok URL'si doğru mu? (Terminal 2)
3. `.env` güncellendikten sonra Expo yeniden başlatıldı mı?

---

### ❌ `Firebase: Error (auth/invalid-api-key)`

`.env` dosyasındaki Firebase API anahtarı hatalı veya eksik. `EXPO_PUBLIC_FIREBASE_API_KEY` değerini kontrol et.

---

### ❌ Android'de hikâyeler görüntülenmiyor

Bu, Android'de URI kodlama farklılığından kaynaklanan bilinen bir sorundur. `create-story.tsx` dosyasının URI normalleştirmesi içeren en güncel sürümünü kullandığından emin ol.

---

### ❌ `ModuleNotFoundError: No module named 'ai_edge_litert'`

```bash
source venv/bin/activate
pip install ai-edge-litert
```

---

## 📦 Üretim Derlemesi (Production Build)

### iOS

```bash
npx eas build --platform ios
```

### Android

```bash
npx eas build --platform android
```

> [Expo EAS hesabı](https://expo.dev/eas) gereklidir. Önce `npm install -g eas-cli` komutunu çalıştır.

---

## 🌍 Sürdürülebilir Kalkınma Amaçları

Bu proje aşağıdaki BM Sürdürülebilir Kalkınma Amaçları ile örtüşmektedir:

- **SKA 4.4** — Diyetisyenlerin bağımsız profesyoneller olarak uzaktan çalışabilmesini sağlama
- **SKA 8.2** — Sağlık sektöründe ekonomik verimliliği artırmak için yapay zeka ve mobil teknoloji kullanımı

---

## 📄 Lisans

Bu proje [Üniversite Adı] mezuniyet tezi kapsamında 2025–2026 döneminde geliştirilmiştir.  
Tüm hakları saklıdır © Oğuzhan Özdemir.

---

## 👤 Geliştirici

**Oğuzhan Özdemir**  
GitHub: [@Oguzhan1511](https://github.com/Oguzhan1511)
**Mert Oruç**
