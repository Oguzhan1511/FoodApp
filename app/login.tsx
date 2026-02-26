import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './AuthContext';
import { auth } from './services/firebaseConfig';
import { supabase } from './services/supabaseConfig'; // Supabase eklendi

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hata", "Lütfen e-posta ve şifrenizi girin.");
      return;
    }

    setLoading(true);
    try {
      // 1. Firebase ile giriş yap
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log("Firebase Girişi Başarılı:", firebaseUser.email);

      // 2. Supabase'den gerçek 'username' bilgisini çek
      let finalUsername = firebaseUser.email || ''; // Varsayılan olarak email

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', firebaseUser.uid)
          .single();

        if (data?.username) {
          finalUsername = data.username;
          console.log("Supabase Profil Bulundu:", finalUsername);
        } else {
          console.log("Profil verisi çekilemedi veya username yok, email kullanılacak.");
        }

        if (error) {
          console.log("Supabase Profil Hatası (Önemsiz):", error.message);
        }

      } catch (dbError) {
        console.log("Veritabanı bağlantı hatası:", dbError);
      }

      // 3. Context'i güncelle
      login({
        id: firebaseUser.uid,
        username: finalUsername
      });

      router.replace('/(tabs)/home');

    } catch (error: any) {
      console.error("Giriş Hatası:", error);
      let errorMessage = "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.";

      if (error.code === 'auth/invalid-email') errorMessage = "Geçersiz e-posta adresi.";
      if (error.code === 'auth/user-not-found') errorMessage = "Kullanıcı bulunamadı.";
      if (error.code === 'auth/wrong-password') errorMessage = "Hatalı şifre.";
      if (error.code === 'auth/invalid-credential') errorMessage = "Hatalı e-posta veya şifre.";

      Alert.alert("Giriş Başarısız", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.innerContainer}>

        <Text style={styles.title}>Hoş Geldiniz</Text>
        <Text style={styles.subtitle}>Hesabınıza giriş yapın.</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>E-Posta</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@mail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="******"
            secureTextEntry={true}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Şifremi Unuttum */}
        <TouchableOpacity
          style={styles.forgotPasswordContainer}
          onPress={() => router.push('/forgot-password')}
        >
          <Text style={styles.forgotPasswordText}>Şifremi Unuttum?</Text>
        </TouchableOpacity>

        {/* Giriş Yap Butonu */}
        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </TouchableOpacity>

        {/* Alt Link: Kayıt Ol */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Hesabın yok mu? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>Kayıt Ol</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#800020',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#800020',
    fontWeight: '600',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#800020',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: "#800020",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // DİKKAT: Buradaki virgül çok önemli! ↓
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#666',
    fontSize: 15,
  },
  linkText: {
    color: '#800020',
    fontWeight: 'bold',
    fontSize: 15,
  }
});