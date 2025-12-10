import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto'; // Bunu eklemeyi unutma

const supabaseUrl = 'https://avfedtsttlzmzztxkhjb.supabase.co'

// BURAYA DİKKAT: process.env kullanma, anahtarı direkt tırnak içine yapıştır.
// Bu anahtar 'anon' key olmalı ('service_role' değil).
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2ZmVkdHN0dGx6bXp6dHhraGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODQ5OTYsImV4cCI6MjA4MDk2MDk5Nn0.oT2BoCcL9Umy2ZiHL9KMuQpUCZDqeXV0qfOFbwBi4zY'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Biz Firebase Auth kullanıyoruz, Supabase Auth çakışmasın diye bunları kapatıyoruz:
    storage: null,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})