import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: 'EXPO_PUBLIC_', // React Native'den gelen .env değişkenlerini tanısın diye
})
