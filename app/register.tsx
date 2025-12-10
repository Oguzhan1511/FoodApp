import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from './services/firebaseConfig'; // YOLU KONTROL ET
import { createUserWithEmailAndPassword } from 'firebase/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert("Eksik", "Lütfen e-posta ve şifre girin.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Zayıf Şifre", "Şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);
    try {
      // SADECE FIREBASE KAYDI YAPIYORUZ
      await createUserWithEmailAndPassword(auth, email, password);
      
      // Kayıt başarılıysa, detayları doldurması için yeni sayfaya gönderiyoruz
      console.log("Firebase hesabı oluştu, profil sayfasına gidiliyor...");
      router.replace('/onboarding'); 

    } catch (error: any) {
      Alert.alert("Hata", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.headerTitle}>Hızlı Kayıt</Text>
        <Text style={styles.subTitle}>Önce hesabınızı oluşturalım.</Text>

        <Text style={styles.label}>E-Posta</Text>
        <TextInput style={styles.input} placeholder="mail@ornek.com" onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>

        <Text style={styles.label}>Şifre</Text>
        <TextInput style={styles.input} placeholder="******" onChangeText={setPassword} secureTextEntry/>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Oluşturuluyor..." : "Devam Et →"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 20, justifyContent: 'center', height: '100%' },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#800020', marginBottom: 10 },
  subTitle: { fontSize: 16, color: '#666', marginBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 10, marginBottom: 20, backgroundColor: '#f9f9f9' },
  button: { backgroundColor: '#800020', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});