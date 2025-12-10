import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleResetPassword = () => {
    // 1. Boş Alan Kontrolü
    if (!email) {
      Alert.alert("Uyarı", "Lütfen e-posta adresinizi girin.");
      return;
    }

    // 2. Simülasyon (Backend'e istek atılacak yer burası)
    console.log("Şifre sıfırlama maili şuraya gönderildi:", email);

    // 3. Başarı Mesajı ve Yönlendirme
    Alert.alert(
      "E-Posta Gönderildi",
      "Lütfen e-posta kutunuzu kontrol edin. Şifre sıfırlama talimatlarını gönderdik.",
      [
        { 
          text: "Giriş Ekranına Dön", 
          onPress: () => router.back() // Bir önceki sayfaya (Login) geri döner
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        
        {/* Başlık */}
        <Text style={styles.title}>Şifremi Unuttum</Text>
        <Text style={styles.subtitle}>
          Endişelenmeyin! E-posta adresinizi girin, size şifrenizi sıfırlamanız için bir bağlantı gönderelim.
        </Text>

        {/* E-Posta Input */}
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

        {/* Gönder Butonu */}
        <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
          <Text style={styles.buttonText}>Bağlantı Gönder</Text>
        </TouchableOpacity>

        {/* Geri Dön Butonu */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Giriş Ekranına Dön</Text>
        </TouchableOpacity>

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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#800020', // Bordo Tema
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    lineHeight: 22, // Okunabilirliği artırmak için satır aralığı
  },
  inputContainer: {
    marginBottom: 20,
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
  button: {
    backgroundColor: '#800020', // Bordo Tema
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
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
  backButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 10,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});