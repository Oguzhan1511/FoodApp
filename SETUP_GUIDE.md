# Proje Kurulum ve Çalıştırma Rehberi

Bu rehber, FoodApp projesini (Frontend ve opsiyonel Backend) nasıl kurup çalıştıracağınızı step-by-step anlatır.

## 1. Ön Gereksinimler

*   **Node.js**: Frontend için gereklidir.
*   **Expo Go**: Mobil uygulamanın telefonda çalışması için (App Store / Play Store'dan indirin).
*   **Python**: Yapay zeka backend servisi için gereklidir (Opsiyonel).

---

## 2. Frontend (Mobil Uygulama) Kurulumu

Mobil uygulamayı çalıştırmak için terminalleri açın ve şu adımları izleyin:

1.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

2.  **Uygulamayı Başlatın:**
    ```bash
    npx expo start
    ```

3.  **Telefonda Açın:**
    *   Terminalde bir QR kod belirecektir.
    *   Telefonda **Expo Go** uygulamasını açın ve QR kodu taratın.
    *   (iOS için kamera uygulamasını kullanabilirsiniz).

---

## 3. Backend (Yapay Zeka Servisi) Kurulumu

> ℹ️ **Bilgi:** Disk alanı sorunu ve performans nedeniyle bu projede ağır `tensorflow` kütüphanesi yerine Google'ın hafif **`ai-edge-litert`** kütüphanesi kullanılmaktadır.

Yapay zeka servisini çalıştırmak için:

1.  **Gerekli Kütüphaneleri Yükleyin:**
    ```bash
    pip install fastapi uvicorn numpy pillow python-multipart ai-edge-litert
    ```

2.  **Sunucuyu Başlatın:**
    ```bash
    python main.py
    ```
    Sunucu `http://0.0.0.0:8000` adresinde çalışacaktır.

---

## 4. Sık Karşılaşılan Sorunlar

*   **"No space left on device"**: Bilgisayarınızın disk alanı dolmuş demektir. Gereksiz dosyaları silip tekrar deneyin veya backend kurulumunu atlayıp sadece frontend'i kullanın.
*   **Bağlantı Hatası**: Telefon ve bilgisayarın aynı WiFi ağında olduğundan emin olun.
