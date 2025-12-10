import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert("Hata", "Lütfen e-posta ve şifrenizi girin.");
      return;
    }
    console.log("Giriş Yapılıyor:", email);
    router.replace('/(tabs)');
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
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Giriş Yap</Text>
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