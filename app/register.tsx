import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Linking, Modal, Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

import { auth } from '../services/firebaseConfig';
import { supabase } from '../services/supabaseConfig';

import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'user' | 'dietitian'>('user');
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // 1. Supabase Profilini Kontrol Et
      let { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.uid)
        .single();

      if (!profile) {
        const autoUsername = (user.email?.split('@')[0] || 'user') + Math.floor(Math.random() * 1000);
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: user.uid, email: user.email, username: autoUsername, role: 'user' }])
          .select()
          .single();

        if (insertError) throw insertError;
        profile = newProfile;
      }

      // 2. AuthContext'e bildir
      login({
        id: user.uid,
        username: profile?.username || (user.email?.split('@')[0] || 'user'),
        avatar_url: user.photoURL,
        role: profile?.role || 'user'
      });

      router.replace('/(tabs)/home' as any);
    } catch (err: any) {
      console.error("Google Login İşlem Hatası:", err.message);
      Alert.alert("Hata", "Google ile giriş yapılırken bir hata oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
      return;
    }

    setLoading(true);
    let firebaseUser = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      firebaseUser = userCredential.user;

      const { error: sbError } = await supabase
        .from('profiles')
        .insert([{
          id: firebaseUser.uid,
          email: email.toLowerCase().trim(),
          username: username.toLowerCase().trim(),
          role: role,
          account_type: accountType
        }]);

      if (sbError) {
        if (firebaseUser) await deleteUser(firebaseUser);
        throw sbError;
      }

      login({
        id: firebaseUser.uid,
        username: username.toLowerCase().trim(),
        role: role
      });

      if (role === 'user') router.replace('/onboarding' as any);
      else router.push({ pathname: '/DietitianDetailsScreen' as any, params: { uid: firebaseUser.uid, email, username } });

    } catch (error: any) {
      console.error("Kayıt Hatası Detayı:", error);
      let errorMessage = "Bir ağ hatası oluştu.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "Bu e-posta adresi zaten kullanımda.";
      if (error.code === 'auth/invalid-email') errorMessage = "Geçersiz e-posta adresi.";
      if (error.code === 'auth/weak-password') errorMessage = "Şifre çok zayıf (en az 6 karakter olmalı).";

      Alert.alert("Kayıt Başarısız", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: '223657657680-5mrcbn0gimnb3udt3156ov9p04o5ll04.apps.googleusercontent.com',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleLogin(response.params.id_token);
    } else if (response?.type === 'error') {
      console.error("Google Auth Hatası:", response.error);
    }
  }, [response]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={28} color={isDark ? '#FFF' : '#333'} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: isDark ? '#1a1a1a' : '#fff5f7' }]}>
              <Ionicons name="person-add" size={32} color="#800020" />
            </View>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>Hesap Oluştur</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>FoodApp topluluğuna katılın.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, {
                  backgroundColor: isDark ? '#111' : '#F9F9F9',
                  borderColor: isDark ? '#333' : '#F0F0F0',
                  color: isDark ? '#FFF' : '#000'
                }]}
                placeholder="Kullanıcı Adı"
                placeholderTextColor={isDark ? '#555' : '#AAA'}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, {
                  backgroundColor: isDark ? '#111' : '#F9F9F9',
                  borderColor: isDark ? '#333' : '#F0F0F0',
                  color: isDark ? '#FFF' : '#000'
                }]}
                placeholder="E-posta"
                placeholderTextColor={isDark ? '#555' : '#AAA'}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, {
                  backgroundColor: isDark ? '#111' : '#F9F9F9',
                  borderColor: isDark ? '#333' : '#F0F0F0',
                  color: isDark ? '#FFF' : '#000'
                }]}
                placeholder="Şifre"
                placeholderTextColor={isDark ? '#555' : '#AAA'}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleBtn, { flex: 0.32, borderColor: isDark ? '#333' : '#F0F0F0' }, role === 'user' && accountType === 'personal' && styles.activeBtn]}
                onPress={() => { setRole('user'); setAccountType('personal'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnText, { color: role === 'user' && accountType === 'personal' ? '#FFF' : (isDark ? '#888' : '#444') }]}>Bireysel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, { flex: 0.32, borderColor: isDark ? '#333' : '#F0F0F0' }, role === 'user' && accountType === 'business' && styles.activeBtn]}
                onPress={() => { setRole('user'); setAccountType('business'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnText, { color: role === 'user' && accountType === 'business' ? '#FFF' : (isDark ? '#888' : '#444') }]}>İşletme</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, { flex: 0.32, borderColor: isDark ? '#333' : '#F0F0F0' }, role === 'dietitian' && styles.activeBtn]}
                onPress={() => { setRole('dietitian'); setAccountType('personal'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnText, { color: role === 'dietitian' ? '#FFF' : (isDark ? '#888' : '#444') }]}>Diyetisyen</Text>
              </TouchableOpacity>
            </View>

            {/* Gizlilik Politikası Onay Checkbox */}
            <TouchableOpacity
              style={styles.privacyRow}
              onPress={() => setPrivacyAccepted(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                { borderColor: isDark ? '#555' : '#800020' },
                privacyAccepted && { backgroundColor: '#800020', borderColor: '#800020' }
              ]}>
                {privacyAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.privacyText, { color: isDark ? '#aaa' : '#555' }]}>
                {'Okudum, '}
                <Text
                  style={[styles.privacyLink, { color: isDark ? '#ff6b8a' : '#800020' }]}
                  onPress={() => setShowPrivacyModal(true)}
                >
                  Gizlilik Politikasını
                </Text>
                {' kabul ediyorum.'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, !isDark && styles.shadow, (loading || !privacyAccepted) && { opacity: 0.5 }]}
              onPress={handleRegister}
              disabled={loading || !privacyAccepted}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Hesap Oluştur</Text>}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? '#222' : '#EEE' }]} />
              <Text style={[styles.dividerText, { color: isDark ? '#444' : '#BBB' }]}>veya</Text>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? '#222' : '#EEE' }]} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, {
                backgroundColor: isDark ? '#111' : '#FFF',
                borderColor: isDark ? '#333' : '#EEE',
                opacity: (!request || loading || !privacyAccepted) ? 0.5 : 1
              }]}
              onPress={() => {
                if (!privacyAccepted) {
                  Alert.alert('Gizlilik Politikası', 'Devam etmek için gizlilik politikasını kabul etmelisiniz.');
                  return;
                }
                promptAsync();
              }}
              disabled={!request || loading}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={20} color={isDark ? '#FFF' : '#DB4437'} />
              <Text style={[styles.googleBtnText, { color: isDark ? '#FFF' : '#555' }]}>Google ile Devam Et</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: isDark ? '#666' : '#999' }]}>Zaten hesabın var mı? </Text>
              <TouchableOpacity onPress={() => router.push('/login' as any)}>
                <Text style={[styles.linkText, { color: isDark ? '#FFF' : '#800020' }]}>Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Modal
          visible={showPrivacyModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPrivacyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? '#111' : '#FFF' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : '#1A1A1A' }]}>Gizlilik Politikası</Text>
                <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                  <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#333'} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.policyText, { color: isDark ? '#AAA' : '#444' }]}>
                  {`FoodApp Gizlilik Politikası\n\nSon güncelleme: 30 Nisan 2025\n\n1. Topladığımız Veriler\n- Hesap Bilgileri: Ad, soyad, e-posta adresi.\n- Google ile Giriş: Sadece ad ve e-posta adresinizi alırız.\n- Sağlık Verileri: Girdiğiniz kalori ve besin değerleri sadece size özel saklanır.\n\n2. Verileri Nasıl Kullanırız\n- Hesabınızı yönetmek.\n- Diyetisyen iletişimini sağlamak.\n- Uygulama performansını iyileştirmek.\n\n3. Veri Güvenliği\nVerileriniz şifreli bağlantılar üzerinden iletilir ve endüstri standartlarında korunur.\n\n4. Haklarınız\nİstediğiniz zaman verilerinizin silinmesini talep edebilirsiniz.\n\nİletişim: oguzhan@gmail.com`}
                </Text>
              </ScrollView>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#800020' }]}
                onPress={() => {
                  setPrivacyAccepted(true);
                  setShowPrivacyModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Okudum, Kabul Ediyorum</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContainer: { paddingHorizontal: 40, paddingBottom: 60, paddingTop: 100, flexGrow: 1, justifyContent: 'flex-start' },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    opacity: 0.7,
  },
  form: { width: '100%' },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    height: 60,
    borderRadius: 20,
    paddingHorizontal: 20,
    fontSize: 16,
    borderWidth: 1.5,
  },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, marginTop: 12 },
  roleBtn: {
    flex: 0.48,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeBtn: { backgroundColor: '#800020', borderColor: '#800020' },
  btnText: { fontSize: 15, fontWeight: '700' },
  button: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#800020',
  },
  shadow: {
    shadowColor: '#800020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  googleBtn: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  googleBtnText: { marginLeft: 12, fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 15,
  },
  linkText: {
    fontWeight: '700',
    fontSize: 15,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  privacyText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  privacyLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalBody: {
    marginBottom: 20,
  },
  policyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
