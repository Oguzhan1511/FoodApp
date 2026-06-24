# 🥗 NutriVision

**AI-powered food recognition & nutrition tracking mobile application**

NutriVision is a cross-platform mobile app (iOS & Android) built with React Native and Expo. It uses a TensorFlow Lite model to identify food from photos, tracks daily nutrition, connects users with dietitians, and includes a social health community.

---

## 📱 Features

- 🤖 **AI Food Recognition** — Identify 2,023+ food categories from a photo via Google AIY Food V1 TFLite model
- 📊 **Nutrition Tracking** — Daily calorie balance, macro tracking (protein, fat, carbs), food & water log
- ⚖️ **Weight & Activity** — Weight history charts, step counter (pedometer), exercise log
- 👥 **Social Feed** — Posts, stories (24h), likes, comments, follow system, discover
- 💬 **Dietitian Chat** — Real-time messaging, diet plan creation & assignment
- 🏆 **Gamification** — Streaks, achievement badges, progress charts (7/30/90/180 days)
- 🔔 **Push Notifications** — Likes, comments, messages, diet reminders
- 💎 **Premium Subscription** — Extended history and advanced analytics
- 🖥️ **Admin Panel** — Web dashboard for managing users, AI logs, and dietitian approvals

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | React Native 0.81.5 + Expo SDK 54 |
| Language (Frontend) | TypeScript 5.9.2 |
| Routing | Expo Router 6 (file-based) |
| AI Backend | Python 3.10 + FastAPI + TFLite (`ai-edge-litert`) |
| AI Model | Google AIY Food V1 (2,023 food categories) |
| Database | Supabase (PostgreSQL + Realtime + Storage) |
| Authentication | Firebase Auth (email/password + Google OAuth) |
| Local Storage | AsyncStorage |
| Notifications | Expo Notifications |
| Tunnel (dev) | ngrok |
| Admin Panel | React + Vite (TypeScript) |

---

## 📂 Project Structure

```
foodapp/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Bottom tab screens
│   │   ├── home.tsx        # Social feed
│   │   ├── tracking.tsx    # Nutrition dashboard
│   │   ├── profile.tsx     # User profile
│   │   ├── dietitian.tsx   # Dietitian directory
│   │   └── discover.tsx    # Explore / trending
│   ├── camera.tsx          # AI food analysis
│   ├── chat.tsx            # Real-time messaging
│   ├── food-log.tsx        # Manual food entry
│   ├── weight-tracking.tsx # Weight history
│   ├── login.tsx           # Authentication screens
│   └── _layout.tsx         # Root layout & providers
├── context/
│   ├── AuthContext.tsx     # Firebase auth state
│   ├── ThemeContext.tsx    # Dark/light theme
│   └── StoryContext.tsx    # Story management
├── services/
│   ├── firebaseConfig.ts   # Firebase initialization
│   ├── supabaseConfig.ts   # Supabase client
│   ├── apiConfig.ts        # FastAPI base URL
│   ├── scraperService.ts   # Nutrition data fetcher
│   └── notificationService.ts
├── components/             # Reusable UI components
├── admin-panel/            # Web admin dashboard (Vite)
├── main.py                 # FastAPI AI inference server
├── model.tflite            # Lightweight TFLite model
├── aiy_food_v1.tflite      # Full AIY Food V1 model
├── aiy_food_labels.txt     # 2,023 food category labels
└── requirements.txt        # Python dependencies
```

---

## ⚙️ Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ LTS | https://nodejs.org |
| npm | 9+ | Comes with Node.js |
| Python | 3.10+ | https://python.org |
| Expo CLI | Latest | `npm install -g expo-cli` |
| ngrok | Latest | https://ngrok.com/download |
| Git | 2.38+ | https://git-scm.com |

**For iOS testing:**
- macOS with Xcode 15+ installed
- iOS Simulator or a physical iPhone (iOS 15+)

**For Android testing:**
- Android Studio with an emulator (API 29+) OR a physical Android device (Android 10+)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Oguzhan1511/FoodApp.git
cd FoodApp
```

---

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env   # if .env.example exists, otherwise create manually
```

Edit `.env` with your credentials:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id

# FastAPI (will be updated with ngrok URL at runtime)
EXPO_PUBLIC_API_URL=http://localhost:8000
```

> ⚠️ **Never commit `.env` to version control.** It is already listed in `.gitignore`.

---

### 3. Install Mobile App Dependencies

```bash
npm install
```

---

### 4. Set Up the Python AI Backend

#### 4a. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
```

#### 4b. Install Python dependencies

```bash
pip install fastapi uvicorn ai-edge-litert numpy Pillow python-multipart
```

Or if a `requirements.txt` exists:

```bash
pip install -r requirements.txt
```

#### 4c. Verify model files

Make sure these files exist in the project root:

```bash
ls -lh *.tflite aiy_food_labels.txt
```

Expected output:
```
-rw-r--r--  aiy_food_labels.txt   (~45 KB)
-rw-r--r--  aiy_food_v1.tflite    (~21 MB)
-rw-r--r--  model.tflite           (~2.6 MB)
```

> The TFLite model files are **not included in the repository** (too large). Contact the project maintainer or download from the [Google AIY Food V1 model page](https://www.tensorflow.org/lite/models).

---

## ▶️ Running the Project

You need **3 terminals** running simultaneously:

---

### Terminal 1 — Start the AI Backend Server

```bash
cd FoodApp
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Test the server is working:
```bash
curl http://localhost:8000
# Expected: {"message":"NutriVision API running"}
```

---

### Terminal 2 — Start ngrok Tunnel

The mobile app cannot reach `localhost` directly. ngrok creates a public HTTPS tunnel:

```bash
ngrok http 8000
```

Expected output:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8000
```

**Copy the `https://` URL** and update your `.env`:

```env
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

> ⚠️ The ngrok URL changes every time you restart ngrok (free plan). Update `.env` and restart the Expo app when this happens.

---

### Terminal 3 — Start the Mobile App

```bash
cd FoodApp
npx expo start
```

Then choose how to run:

| Key | Action |
|---|---|
| `i` | Open in iOS Simulator |
| `a` | Open in Android Emulator |
| Scan QR | Open in Expo Go app on physical device |

**Using Expo Go (physical device):**
1. Download **Expo Go** from App Store or Google Play
2. Make sure your phone and computer are on the **same Wi-Fi network**
3. Scan the QR code shown in the terminal

---

## 🖥️ Running the Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

**Admin credentials** are managed via Firebase Authentication. Create an admin user in your Firebase console and set `role = 'admin'` in the Supabase `users` table.

---

## 🔥 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Sign-in methods:
   - Email/Password ✅
   - Google ✅
4. Go to Project Settings → Your apps → Add a **Web app**
5. Copy the config values to your `.env` file
6. In the Firebase console, go to **Authentication → Settings → Authorized domains** and add your ngrok domain

---

## 🗄️ Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the schema to create all tables:
   - `users`, `posts`, `comments`, `likes`, `followers`
   - `stories`, `story_views`, `conversations`, `messages`
   - `diet_plans`, `weight_entries`, `water_entries`
   - `analysis_logs`, `analysis_feedback`, `notifications`
3. Enable **Row Level Security (RLS)** on all tables
4. Copy your **Project URL** and **anon public key** to `.env`
5. Go to **Storage** → Create a bucket named `media` (set to public)

---

## 🧪 Testing the AI Endpoint

Once the FastAPI server and ngrok are running, test the `/predict` endpoint:

```bash
# Test with a food image
curl -X POST https://your-ngrok-url.ngrok-free.app/predict \
  -F "file=@/path/to/food-image.jpg"
```

Expected response:
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

## 🐛 Common Issues & Fixes

### ❌ `Error: Port 8000 already in use`

```bash
lsof -ti:8000 | xargs kill -9
```

Then restart the FastAPI server.

---

### ❌ `AI analysis returns "Server Error"` in the app

The ngrok session has expired. Restart ngrok and update `EXPO_PUBLIC_API_URL` in `.env`, then restart the Expo app.

---

### ❌ `Cannot parse server response` / `Unexpected token '<'`

The app received an HTML error page instead of JSON. This means the ngrok URL is wrong or the FastAPI server is not running. Check:
1. Is `uvicorn` running? (`Terminal 1`)
2. Is the ngrok URL in `.env` correct? (`Terminal 2`)
3. Did you restart Expo after updating `.env`?

---

### ❌ `Firebase: Error (auth/invalid-api-key)`

Your Firebase API key in `.env` is incorrect or missing. Double-check `EXPO_PUBLIC_FIREBASE_API_KEY`.

---

### ❌ Stories not showing on Android

This is a known URI encoding issue on Android. Make sure you are using the latest version of `create-story.tsx` which includes URI normalization.

---

### ❌ `ModuleNotFoundError: No module named 'ai_edge_litert'`

```bash
source venv/bin/activate
pip install ai-edge-litert
```

---

## 📦 Building for Production

### iOS

```bash
npx eas build --platform ios
```

### Android

```bash
npx eas build --platform android
```

> Requires an [Expo EAS account](https://expo.dev/eas). Run `npm install -g eas-cli` first.

---

## 🌍 Sustainable Development Goals

This project contributes to:
- **SDG 4.4** — Enabling dietitians to work remotely as independent professionals
- **SDG 8.2** — Applying AI and mobile technology to increase economic productivity in the health sector

---

## 📄 License

This project was developed as a graduation thesis project at [University Name], 2025–2026.  
All rights reserved © Oğuzhan Özdemir.

---

## 👤 Author

**Oğuzhan Özdemir**  
GitHub: [@Oguzhan1511](https://github.com/Oguzhan1511)
