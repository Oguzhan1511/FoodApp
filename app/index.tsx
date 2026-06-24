import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.content}>
        {/* Simple Branding Section */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: isDark ? '#1a1a1a' : '#fff5f7' }]}>
            <Text style={[styles.logoText, { color: '#800020' }]}>F</Text>
          </View>
          <Text style={[styles.brandName, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>FoodApp</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>
            Sağlıklı seçimler, mutlu yaşam.
          </Text>
        </View>

        {/* Action Section */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, !isDark && styles.shadow]}
            onPress={() => router.push('/login' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Giriş Yap</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, { borderColor: isDark ? '#333' : '#E0E0E0' }]}
            onPress={() => router.push('/register' as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: isDark ? '#FFFFFF' : '#333' }]}>Kayıt Ol</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'flex-start',
    paddingTop: height * 0.12,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: height * 0.12,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
  },
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.8,
  },
  footer: {
    width: '100%',
    gap: 16,
  },
  button: {
    height: 60,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#800020',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  shadow: {
    shadowColor: '#800020',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  versionText: {
    textAlign: 'center',
    color: '#BBB',
    fontSize: 12,
    marginTop: 24,
  },
});
