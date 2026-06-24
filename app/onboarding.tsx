import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebaseConfig';
import { supabase } from '../services/supabaseConfig';

const THEME_COLOR = '#800020';

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState('personal');

  React.useEffect(() => {
    const fetchType = async () => {
      if(auth.currentUser) {
        const { data } = await supabase.from('profiles').select('account_type').eq('id', auth.currentUser.uid).single();
        if(data?.account_type) setAccountType(data.account_type);
      }
    };
    fetchType();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      const currentUser = auth.currentUser;
      const fileExt = uri.split('.').pop();
      const fileName = `${currentUser?.uid}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log("Supabase upload basliyor, Path:", filePath);
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, formData, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error("Supabase Upload Hatasi:", uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      console.log("Upload başarılı, Public URL:", data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const handleSaveProfile = async () => {
    if (accountType !== 'business' && (!name || !surname || !weight || !height || !age)) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
      return;
    }
    if (accountType === 'business' && (!name || !surname)) {
      Alert.alert("Eksik Bilgi", "Lütfen işletme adını giriniz.");
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert("Hata", "Oturum bulunamadı, lütfen tekrar giriş yapın.");
        router.replace('/login' as any);
        return;
      }

      let finalAvatarUrl = avatarUrl;
      if (avatarUrl && avatarUrl.startsWith('file://')) {
        finalAvatarUrl = await uploadImage(avatarUrl);
      }

      const weightVal = parseFloat(weight.replace(',', '.')) || 0;
      const heightCm = parseFloat(height) || 0;
      const heightM = heightCm / 100 || 1;
      const bmi = parseFloat((weightVal / (heightM * heightM)).toFixed(2)) || 0;

      const { error } = await supabase
        .from('profiles')
        .update({
          ad: name,
          soyad: surname,
          yas: parseInt(age),
          kilo: weightVal,
          boy: heightCm,
          vki: bmi,
          avatar_url: finalAvatarUrl
        })
        .eq('id', currentUser.uid);

      if (error) throw error;

      // 4. Context'i GÜNCELLE
      updateUser({
        ad: name,
        soyad: surname,
        avatar_url: finalAvatarUrl
      });

      Alert.alert("Harika!", "Profilin başarıyla oluşturuldu.", [
        { text: "Uygulamaya Başla", onPress: () => router.replace('/(tabs)/home' as any) }
      ]);

    } catch (error: any) {
      console.error("Onboarding Hatası:", error.message);
      Alert.alert("Hata", "Bilgiler güncellenemedi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!name || !surname) {
        Alert.alert("Eksik Bilgi", "Lütfen gerekli alanları girin.");
        return;
      }
      if (accountType === 'business') {
        handleSaveProfile();
      } else {
        setStep(2);
      }
    }
  };

  const prevStep = () => {
    setStep(1);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.stepText}>{accountType === 'business' ? 'Son Adım' : `Adım ${step}/2`}</Text>
          <Text style={styles.title}>
            {step === 1 ? (accountType === 'business' ? 'İşletmenizi Tanıyalım' : 'Sizi Tanıyalım') : 'Fiziksel Bilgiler'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? (accountType === 'business' ? 'İşletmenizin adı ve fotoğrafını kaydedelim.' : 'Size özel diyet önerileri sunabilmemiz için temel bilgilerinizi alalım.')
              : 'Vücut kitle indeksinizi hesaplamak için bu bilgiler gerekli.'}
          </Text>
        </View>

        {step === 1 ? (
          <View style={styles.stepContent}>
            <View style={styles.avatarPickerContainer}>
              <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={40} color="#ccc" />
                    <Text style={styles.avatarPlaceholderText}>Fotoğraf Ekle</Text>
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="add" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{accountType === 'business' ? 'İşletme Adı (Örn: Meşale)' : 'Adınız'}</Text>
              <TextInput
                style={styles.input}
                placeholder={accountType === 'business' ? 'İşletme Adı' : 'Örn: Ahmet'}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{accountType === 'business' ? 'İşletme Soyadı/Ek (Örn: Cafe)' : 'Soyadınız'}</Text>
              <TextInput
                style={styles.input}
                placeholder={accountType === 'business' ? 'Soyadı veya Şube vs.' : 'Örn: Yılmaz'}
                value={surname}
                onChangeText={setSurname}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={nextStep}>
              <Text style={styles.primaryButtonText}>{accountType === 'business' ? 'Profili Tamamla' : 'Devam Et'}</Text>
              <Ionicons name={accountType === 'business' ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.stepContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yaşınız</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: 25"
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
                maxLength={3}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Kilo (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 70.5"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Boy (cm)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 175"
                  keyboardType="number-pad"
                  value={height}
                  onChangeText={setHeight}
                  maxLength={3}
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={prevStep}>
                <Ionicons name="arrow-back" size={20} color={THEME_COLOR} />
                <Text style={styles.secondaryButtonText}>Geri</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { flex: 2 }]}
                onPress={handleSaveProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Profilimi Tamamla</Text>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 30,
    paddingTop: 60,
    backgroundColor: '#fff'
  },
  header: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLOR,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    letterSpacing: 0.3
  },
  stepContent: {
    flex: 1,
  },
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: 35,
  },
  avatarButton: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontWeight: '600',
  },
  editBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: THEME_COLOR,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#1a1a1a',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  primaryButton: {
    backgroundColor: THEME_COLOR,
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    marginTop: 20,
  },
  secondaryButtonText: {
    color: THEME_COLOR,
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});