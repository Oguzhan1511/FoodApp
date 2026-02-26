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
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';

// DOSYA YOLLARINI KONTROL ET!
import { auth } from './services/firebaseConfig';
import { supabase } from './services/supabaseConfig';

import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const THEME_COLOR = '#800020';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'user' | 'dietitian'>('user');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Google Auth Yapılandırması
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: 'GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com',
    redirectUri: AuthSession.makeRedirectUri({
      scheme: 'foodapp', 
    }),
  });

  // Başarılı/Hatalı Yanıtları Dinle
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleLogin(response.params.id_token);
    } else if (response?.type === 'error') {
      console.error("Google Auth Hatası:", response.error);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // Supabase Bağlantı Kontrolü ve Kayıt
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.uid)
        .single();

      if (!profile) {
        const autoUsername = (user.email?.split('@')[0] || 'user') + Math.floor(Math.random() * 1000);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: user.uid, email: user.email, username: autoUsername, role: 'user' }]);
        
        if (insertError) throw insertError;
      }
      router.replace('/home');
    } catch (err: any) {
      console.error("Google Login İşlem Hatası:", err.message);
      Alert.alert("Ağ Hatası", "Supabase sunucusuna ulaşılamadı. İnternetinizi kontrol edin.");
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
      // 1. Firebase Kaydı
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      firebaseUser = userCredential.user;
      
      // 2. Supabase profiles Tablosuna Kayıt
      const { error: sbError } = await supabase
        .from('profiles')
        .insert([{ 
          id: firebaseUser.uid, 
          email: email.toLowerCase().trim(), 
          username: username.toLowerCase().trim(), 
          role: role 
        }]);

      if (sbError) {
        // Supabase tarafında hata varsa Firebase kullanıcısını sil (Rollback)
        if (firebaseUser) await deleteUser(firebaseUser);
        throw sbError;
      }

      // Başarılıysa yönlendir
      if (role === 'user') router.replace('/onboarding');
      else router.push({ pathname: "/DietitianDetailsScreen", params: { uid: firebaseUser.uid, email, username }});

    } catch (error: any) {
      console.error("Kayıt Hatası Detayı:", error);
      Alert.alert("Kayıt Başarısız", error.message || "Bir ağ hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Foodap'a Katıl</Text>
        
        <View style={styles.form}>
          <Text style={styles.label}>Kullanıcı Adı</Text>
          <TextInput style={styles.input} placeholder="kullaniciadi" onChangeText={setUsername} autoCapitalize="none" />
          
          <TextInput style={styles.input} placeholder="E-posta" onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Şifre" onChangeText={setPassword} secureTextEntry />

          <View style={styles.roleContainer}>
            <TouchableOpacity style={[styles.roleBtn, role === 'user' && styles.activeBtn]} onPress={() => setRole('user')}>
              <Text style={role === 'user' ? styles.activeText : styles.btnText}>Kullanıcı</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roleBtn, role === 'dietitian' && styles.activeBtn]} onPress={() => setRole('dietitian')}>
              <Text style={role === 'dietitian' ? styles.activeText : styles.btnText}>Diyetisyen</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.mainBtn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Hesap Oluştur</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.googleBtn} onPress={() => promptAsync()} disabled={!request || loading}>
          <Ionicons name="logo-google" size={20} color="#DB4437" />
          <Text style={styles.googleBtnText}>Google ile Devam Et</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 25, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: THEME_COLOR, marginBottom: 30, textAlign: 'center' },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 15, borderRadius: 12, marginBottom: 15, backgroundColor: '#f9f9f9' },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  roleBtn: { flex: 0.48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME_COLOR, alignItems: 'center' },
  activeBtn: { backgroundColor: THEME_COLOR },
  btnText: { color: THEME_COLOR, fontWeight: 'bold' },
  activeText: { color: '#fff', fontWeight: 'bold' },
  mainBtn: { backgroundColor: THEME_COLOR, padding: 18, borderRadius: 12, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  googleBtn: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd', marginTop: 20 },
  googleBtnText: { marginLeft: 10, fontWeight: 'bold', color: '#555' }
});