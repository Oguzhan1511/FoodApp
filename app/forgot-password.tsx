import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { fetchSignInMethodsForEmail, sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth } from './services/firebaseConfig';
import { useTheme } from './ThemeContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isDark = theme === 'dark';

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Uyarı", "Lütfen e-posta adresinizi girin.");
      return;
    }

    setLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length === 0) {
        Alert.alert("Hata", "Bu e-posta adresine kayıtlı bir kullanıcı bulunamadı.");
        setLoading(false);
        return;
      }

      await sendPasswordResetEmail(auth, email);

      Alert.alert(
        "E-Posta Gönderildi",
        "Lütfen e-posta kutunuzu kontrol edin. Şifre sıfırlama talimatlarını gönderdik.",
        [
          {
            text: "Tamam",
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      console.error("Şifre sıfırlama hatası:", error);
      let errorMessage = "Bir hata oluştu. Lütfen tekrar deneyin.";

      if (error.code === 'auth/user-not-found') {
        errorMessage = "Bu e-posta adresine kayıtlı bir kullanıcı bulunamadı.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Geçersiz bir e-posta adresi girdiniz.";
      }

      Alert.alert("Hata", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#800020' }]}>Şifremi Unuttum</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>
              E-posta adresinizi girin, size bir bağlantı gönderelim.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, {
                  backgroundColor: isDark ? '#111' : '#F9F9F9',
                  borderColor: isDark ? '#333' : '#F0F0F0',
                  color: isDark ? '#FFF' : '#000'
                }]}
                placeholder="E-Posta"
                placeholderTextColor={isDark ? '#555' : '#AAA'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Bağlantı Gönder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.6}
            >
              <Text style={[styles.backButtonText, { color: isDark ? '#888' : '#666' }]}>
                Geri Dön
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    height: 64,
    borderRadius: 20,
    paddingHorizontal: 20,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#800020',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
