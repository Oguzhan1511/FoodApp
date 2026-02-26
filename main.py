from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ai_edge_litert.interpreter import Interpreter
import numpy as np
from PIL import Image, ImageOps  # ImageOps ekledik
import io
import json

app = FastAPI()

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dosya Yolları
MODEL_PATH = "model.tflite"
LABEL_PATH = "labels.txt"
JSON_PATH = "calories.json"

# Dosyaları Yükle
try:
    with open(LABEL_PATH, "r") as f:
        CATEGORIES = [line.strip() for line in f.readlines()]
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        CALORIE_DB = json.load(f)
except Exception as e:
    print(f"Başlatma Hatası: {e}")
    CATEGORIES = []
    CALORIE_DB = {}

# TFLite Kurulumu
interpreter = Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_shape = input_details[0]['shape']

@app.get("/")
def home():
    return {"message": "Foodap API Aktif - IP: 192.168.1.21"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # 1. DOĞRULUK İÇİN: Center Crop (Kırpma) ve Resize
        target_size = (input_shape[1], input_shape[2])
        # ImageOps.fit, resmi bozmadan (ezmeden) ortadan kırpar ve boyutlandırır
        img = ImageOps.fit(img, target_size, Image.LANCZOS)
        
        # 2. DEBUG: AI ne görüyor? (Klasörüne bakmayı unutma)
        img.save("debug_view.jpg")
        
        # 3. Veriyi Hazırla
        input_data = np.expand_dims(np.array(img, dtype=np.float32), axis=0)
        
        # Normalizasyon: Eğer sonuçlar hala saçmaysa burayı 'input_data' olarak bırak (bölme yapma)
        input_data = input_data / 255.0  

        # 4. Tahmin
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]['index'])
        results = np.squeeze(output_data)
        
        # 5. MÜHENDİSLİK DOKUNUŞU: En İyi 3 Tahmini Bul (Top-3)
        top_k = 3
        top_indices = results.argsort()[-top_k:][::-1]
        
        predictions = []
        for idx in top_indices:
            food_name = CATEGORIES[idx] if idx < len(CATEGORIES) else "Bilinmiyor"
            predictions.append({
                "food_name": food_name,
                "confidence": round(float(results[idx]), 4),
                "calories": CALORIE_DB.get(food_name, 0)
            })

        # Ana sonucu (en yüksek olanı) kolaylık olsun diye ayrıca dönüyoruz
        return {
            "status": "success",
            "food_name": predictions[0]["food_name"],
            "calories_per_100g": predictions[0]["calories"],
            "confidence": predictions[0]["confidence"],
            "all_predictions": predictions # Diğer olasılıklar
        }

    except Exception as e:
        print(f"Tahmin Hatası: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)