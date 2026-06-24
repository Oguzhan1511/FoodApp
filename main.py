from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ai_edge_litert.interpreter import Interpreter
import numpy as np
from PIL import Image, ImageOps
import io
import json
import asyncio
import csv
import os

app = FastAPI()

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== MODEL DOSYA YOLLARI =====
MODEL_PATH = "aiy_food_v1.tflite"        # Google AIY Food V1 — 2.023 yemek kategorisi
LABEL_PATH = "aiy_food_labels.txt"        # 2.024 etiket (__background__ dahil)
FALLBACK_MODEL_PATH = "model.tflite"      # Eski Food-101 modeli (yedek)
FALLBACK_LABEL_PATH = "labels.txt"

# ===== GENEL BESİN DEĞERLERİ VERİTABANI =====
# Yaygın yemekler için 100g başına tahmini besin değerleri
# Model 2.023 kategori içerdiği için tümünü kapsamak zor;
# burada olmayanlar için varsayılan değerler kullanılır.
NUTRITION_DB = {
    # ---- Türk Mutfağı ----
    "Kebab":                    {"protein": 20.0, "fat": 15.0, "carbs": 5.0,   "cal": 240},
    "Lahmacun":                 {"protein": 10.0, "fat": 8.0,  "carbs": 30.0,  "cal": 230},
    "Pide":                     {"protein": 12.0, "fat": 10.0, "carbs": 35.0,  "cal": 275},
    "Baklava":                  {"protein": 5.0,  "fat": 22.0, "carbs": 55.0,  "cal": 430},
    "Dolma":                    {"protein": 3.0,  "fat": 5.0,  "carbs": 18.0,  "cal": 130},
    "Menemen":                  {"protein": 7.0,  "fat": 8.0,  "carbs": 6.0,   "cal": 120},
    "Börek":                    {"protein": 8.0,  "fat": 14.0, "carbs": 28.0,  "cal": 270},
    "Manti":                    {"protein": 10.0, "fat": 8.0,  "carbs": 25.0,  "cal": 210},
    "Pilav":                    {"protein": 3.0,  "fat": 2.0,  "carbs": 28.0,  "cal": 140},
    "İskender":                 {"protein": 18.0, "fat": 12.0, "carbs": 20.0,  "cal": 260},
    "Köfte":                    {"protein": 17.0, "fat": 12.0, "carbs": 8.0,   "cal": 210},

    # ---- Uluslararası Yemekler (Food-101 uyumlu) ----
    "Apple pie":                {"protein": 2.4,  "fat": 11.0, "carbs": 34.0,  "cal": 237},
    "Pizza":                    {"protein": 11.0, "fat": 10.0, "carbs": 33.0,  "cal": 266},
    "Hamburger":                {"protein": 15.0, "fat": 14.0, "carbs": 24.0,  "cal": 295},
    "Sushi":                    {"protein": 6.0,  "fat": 1.0,  "carbs": 18.0,  "cal": 143},
    "Steak":                    {"protein": 26.0, "fat": 17.0, "carbs": 0.0,   "cal": 271},
    "Ramen":                    {"protein": 10.0, "fat": 7.0,  "carbs": 26.0,  "cal": 206},
    "Pad thai":                 {"protein": 9.0,  "fat": 5.0,  "carbs": 26.0,  "cal": 185},
    "Paella":                   {"protein": 12.0, "fat": 6.0,  "carbs": 22.0,  "cal": 190},
    "Caesar salad":             {"protein": 8.0,  "fat": 13.0, "carbs": 7.0,   "cal": 180},
    "Fried rice":               {"protein": 5.0,  "fat": 5.0,  "carbs": 26.0,  "cal": 163},
    "French fries":             {"protein": 3.4,  "fat": 15.0, "carbs": 41.0,  "cal": 312},
    "Chicken curry":            {"protein": 12.0, "fat": 5.0,  "carbs": 8.0,   "cal": 125},
    "Ice cream":                {"protein": 3.5,  "fat": 11.0, "carbs": 24.0,  "cal": 207},
    "Chocolate cake":           {"protein": 5.0,  "fat": 18.0, "carbs": 50.0,  "cal": 371},
    "Pancakes":                 {"protein": 6.0,  "fat": 7.0,  "carbs": 36.0,  "cal": 227},
    "Hot dog":                  {"protein": 11.0, "fat": 14.0, "carbs": 22.0,  "cal": 260},
    "Tacos":                    {"protein": 11.0, "fat": 9.0,  "carbs": 22.0,  "cal": 210},
    "Lasagna":                  {"protein": 10.0, "fat": 8.0,  "carbs": 18.0,  "cal": 185},
    "Omelette":                 {"protein": 11.0, "fat": 10.0, "carbs": 1.0,   "cal": 154},
    "Waffles":                  {"protein": 7.0,  "fat": 11.0, "carbs": 38.0,  "cal": 291},
    "Donuts":                   {"protein": 5.0,  "fat": 22.0, "carbs": 58.0,  "cal": 452},
    "Cheesecake":               {"protein": 5.0,  "fat": 18.0, "carbs": 32.0,  "cal": 321},
    "Tiramisu":                 {"protein": 5.0,  "fat": 14.0, "carbs": 30.0,  "cal": 283},
    "Grilled salmon":           {"protein": 25.0, "fat": 12.0, "carbs": 0.0,   "cal": 208},
    "Fish and chips":           {"protein": 14.0, "fat": 12.0, "carbs": 28.0,  "cal": 275},
    "Hummus":                   {"protein": 8.0,  "fat": 9.0,  "carbs": 14.0,  "cal": 166},
    "Falafel":                  {"protein": 13.0, "fat": 17.0, "carbs": 32.0,  "cal": 333},
    "Bibimbap":                 {"protein": 8.0,  "fat": 3.0,  "carbs": 22.0,  "cal": 148},
    "Pho":                      {"protein": 10.0, "fat": 3.0,  "carbs": 18.0,  "cal": 140},
    "Croissant":                {"protein": 8.0,  "fat": 21.0, "carbs": 46.0,  "cal": 406},
    "Bruschetta":               {"protein": 5.0,  "fat": 6.0,  "carbs": 30.0,  "cal": 193},
    "Edamame":                  {"protein": 11.0, "fat": 5.0,  "carbs": 8.0,   "cal": 122},
    "Guacamole":                {"protein": 2.0,  "fat": 14.0, "carbs": 8.0,   "cal": 160},
    "Nachos":                   {"protein": 8.0,  "fat": 18.0, "carbs": 38.0,  "cal": 346},
    "Churros":                  {"protein": 5.0,  "fat": 20.0, "carbs": 58.0,  "cal": 440},
    "Miso soup":                {"protein": 3.0,  "fat": 1.0,  "carbs": 4.0,   "cal": 40},
    "Spring rolls":             {"protein": 5.0,  "fat": 6.0,  "carbs": 22.0,  "cal": 162},
    "Dumplings":                {"protein": 7.0,  "fat": 4.0,  "carbs": 18.0,  "cal": 136},
    "Risotto":                  {"protein": 5.0,  "fat": 6.0,  "carbs": 26.0,  "cal": 180},
    "Ceviche":                  {"protein": 14.0, "fat": 2.0,  "carbs": 6.0,   "cal": 97},
    "Samosa":                   {"protein": 5.0,  "fat": 12.0, "carbs": 26.0,  "cal": 230},
    "Gnocchi":                  {"protein": 3.0,  "fat": 1.0,  "carbs": 28.0,  "cal": 133},
    "Foie gras":                {"protein": 11.0, "fat": 43.0, "carbs": 4.0,   "cal": 462},
    "Escargots":                {"protein": 13.0, "fat": 5.0,  "carbs": 2.0,   "cal": 105},
}

# Varsayılan besin değerleri (DB'de olmayanlar için)
DEFAULT_NUTRITION = {"protein": 8.0, "fat": 6.0, "carbs": 20.0, "cal": 165}

# ===== ETİKETLERİ YÜKLE =====
CATEGORIES = []
try:
    with open(LABEL_PATH, "r", encoding="utf-8") as f:
        CATEGORIES = [line.strip() for line in f.readlines() if line.strip()]
    print(f"✅ Yüklenen kategori sayısı: {len(CATEGORIES)} ({LABEL_PATH})")
except Exception as e:
    print(f"⚠️ Etiket yükleme hatası: {e}")

# ===== TFLITE MODELI YÜKLE =====
interpreter = Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_shape = input_details[0]['shape']
input_dtype = input_details[0]['dtype']
output_dtype = output_details[0]['dtype']

print(f"✅ Model yüklendi: {MODEL_PATH}")
print(f"   Input: {input_shape}, dtype={input_dtype}")
print(f"   Output: {output_details[0]['shape']}, dtype={output_dtype}")

# Eşzamanlı erişim kilidi – aynı anda sadece 1 istek modeli kullanabilir
model_lock = asyncio.Lock()


def get_nutrition(food_name: str) -> dict:
    """Yemek adına göre besin değerlerini döndürür. Bulamazsa varsayılan değer döner."""
    # Direkt eşleşme
    if food_name in NUTRITION_DB:
        return NUTRITION_DB[food_name]

    # Case-insensitive eşleşme
    for key, val in NUTRITION_DB.items():
        if key.lower() == food_name.lower():
            return val

    # Kısmi eşleşme (yemek adı içinde geçen DB anahtarı)
    food_lower = food_name.lower()
    for key, val in NUTRITION_DB.items():
        if key.lower() in food_lower or food_lower in key.lower():
            return val

    return DEFAULT_NUTRITION


@app.get("/")
def home():
    return {
        "message": "Foodapp API Aktif",
        "model": "Google AIY Food V1",
        "categories": len(CATEGORIES),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")

        target_size = (input_shape[1], input_shape[2])  # 192x192
        img = ImageOps.fit(img, target_size, Image.LANCZOS)
        img.save("debug_view.jpg")

        # Model uint8 bekliyorsa normalizasyon yapmıyoruz
        img_array = np.array(img, dtype=np.uint8)
        input_data = np.expand_dims(img_array, axis=0)

        if input_dtype == np.float32:
            input_data = input_data.astype(np.float32) / 255.0

        # Kilit ile modeli koruyoruz — eşzamanlı isteklerde veri karışması önlenir
        async with model_lock:
            interpreter.set_tensor(input_details[0]['index'], input_data)
            interpreter.invoke()
            output_data = interpreter.get_tensor(output_details[0]['index'])
            results = np.squeeze(output_data)

        # uint8 çıktıyı float'a dönüştür (0-1 arası)
        if output_dtype == np.uint8:
            results = results.astype(np.float32) / 255.0

        # --- YEMEK / YEMEK DEĞİL TESPİTİ ---
        # 2024 sınıflı modelde güven puanları doğal olarak düşük olur
        # (olasılık 2024'e dağıldığı için 0.05-0.15 arası normal)
        CONFIDENCE_THRESHOLD = 0.03

        # __background__ sınıfı kontrolü (index 0)
        background_score = float(results[0]) if len(results) > 0 else 0.0
        # Yemek sınıfları arasındaki en yüksek skor (index 1'den başla)
        food_results = results[1:] if len(results) > 1 else results
        top_food_confidence = float(np.max(food_results))

        # Top-5 toplam güven skoru — yemekse genellikle top-5 toplamı yüksek olur
        top5_indices = food_results.argsort()[-5:][::-1]
        top5_total = float(sum(food_results[i] for i in top5_indices))

        # Entropi hesaplama
        food_probs = food_results.copy()
        food_probs = food_probs / (food_probs.sum() + 1e-10)
        entropy = -np.sum(food_probs * np.log(food_probs + 1e-10))
        max_entropy = np.log(len(food_results))
        normalized_entropy = entropy / max_entropy if max_entropy > 0 else 1.0

        print(f"[DEBUG] Background: {background_score:.4f}, Top food: {top_food_confidence:.4f}, Top5 total: {top5_total:.4f}, Entropy: {normalized_entropy:.4f}")

        # Yemek olmadığına karar ver — sadece kesin durumlarda:
        # 1) Background skoru tüm yemek skorlarından yüksekse
        # 2) En yüksek güven puanı bile %3'ün altındaysa (2024 sınıf için çok düşük)
        # 3) Entropi neredeyse tamamen rastgele (model hiçbirine benzemiyor)
        if (background_score > top_food_confidence * 2) or \
           (top_food_confidence < CONFIDENCE_THRESHOLD and normalized_entropy > 0.90):
            return {
                "status": "not_food",
                "message": "Bu görsel bir yemek olarak algılanamadı.",
                "confidence": round(top_food_confidence, 4),
                "entropy": round(normalized_entropy, 4)
            }
        # --- YEMEK / YEMEK DEĞİL TESPİTİ SONU ---

        # Top-K tahminler (yemek sınıfları içinden, +1 offset for background)
        top_k = 5
        top_indices = food_results.argsort()[-top_k:][::-1]

        predictions = []
        for idx in top_indices:
            actual_idx = idx + 1  # +1 çünkü index 0 = __background__
            food_name = CATEGORIES[actual_idx] if actual_idx < len(CATEGORIES) else "Bilinmiyor"
            nutrition = get_nutrition(food_name)
            predictions.append({
                "food_name": food_name,
                "confidence": round(float(food_results[idx]), 4),
                "calories": nutrition.get("cal", DEFAULT_NUTRITION["cal"]),
                "protein": nutrition.get("protein", DEFAULT_NUTRITION["protein"]),
                "fat": nutrition.get("fat", DEFAULT_NUTRITION["fat"]),
                "carbs": nutrition.get("carbs", DEFAULT_NUTRITION["carbs"]),
            })

        top = predictions[0]
        return {
            "status": "success",
            "food_name": top["food_name"],
            "calories_per_100g": top["calories"],
            "protein_per_100g": top["protein"],
            "fat_per_100g": top["fat"],
            "carbs_per_100g": top["carbs"],
            "confidence": top["confidence"],
            "all_predictions": predictions
        }

    except Exception as e:
        print(f"Tahmin Hatası: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)