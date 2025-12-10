// app/services/firebaseConfig.ts
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';

// Senin google-services.json dosyanın içinden aldığımız veriler:
const firebaseConfig = {
  apiKey: "AIzaSyDGaeSM3eRU5LSRYoZ4RCFWjZsZNR4gM8Q", //
  authDomain: "foodapp-fb860.firebaseapp.com", // Proje ID'den türetildi
  projectId: "foodapp-fb860", //
  storageBucket: "foodapp-fb860.firebasestorage.app", //
  messagingSenderId: "819263804918", //
  appId: "1:819263804918:android:6c3d08fc56fe9f886da3d7" //
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Auth servisini React Native için kalıcı hafıza ile başlat
// (Böylece uygulamayı kapatıp açınca kullanıcı çıkış yapmaz)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});