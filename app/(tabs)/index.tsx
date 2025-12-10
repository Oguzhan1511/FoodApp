import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Üst Kısım: Logo veya Başlık */}
      <View style={styles.header}>
        <Text style={styles.title}>FoodApp</Text>
        <Text style={styles.subtitle}>Lezzetli ve sağlıklı seçimler.</Text>
      </View>

      {/* Orta Kısım: Butonlar */}
      <View style={styles.buttonContainer}>
        
        {/* Giriş Yap Butonu */}
        <TouchableOpacity 
          style={[styles.button, styles.loginButton]} 
          onPress={() => router.push('/login')}
        >
          <Text style={[styles.buttonText, styles.loginButtonText]}>Giriş Yap</Text>
        </TouchableOpacity>

        {/* Kayıt Ol Butonu */}
        <TouchableOpacity 
          style={[styles.button, styles.registerButton]} 
          onPress={() => router.push('/register')} 
        >
          <Text style={styles.buttonText}>Kayıt Ol</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 80,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#800020', // <-- BORDO RENK
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#800020', // <-- Çerçeve Rengi BORDO
  },
  loginButtonText: {
    color: '#800020', // <-- Yazı Rengi BORDO
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#800020', // <-- Arka Plan BORDO
    borderWidth: 2,
    borderColor: '#800020',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});