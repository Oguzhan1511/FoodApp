import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth } from './services/firebaseConfig';
import { supabase } from './services/supabaseConfig';

export default function OnboardingScreen() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    // 1. Validasyon
    if (!name || !surname || !weight || !height || !age) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        Alert.alert("Hata", "Oturum bulunamadı, lütfen tekrar giriş yapın.");
        router.replace('/login');
        return;
      }

      // 2. Sayısal Dönüşümler ve Hesaplamalar
      const weightVal = parseFloat(weight.replace(',', '.'));
      const heightCm = parseFloat(height);
      const heightM = heightCm / 100;
      // Vücut Kitle İndeksi: Kilo / (Boy * Boy)
      const bmi = parseFloat((weightVal / (heightM * heightM)).toFixed(2));

      // 3. Supabase GÜNCELLEME (Update) İşlemi
      // Kayıt sırasında açılan satırı dolduruyoruz.
      const { error } = await supabase
        .from('profiles')
        .update({ 
          ad: name,
          soyad: surname,
          yas: parseInt(age),
          kilo: weightVal,
          boy: heightCm,
          vki: bmi
        })
        .eq('id', currentUser.uid); // Sadece giriş yapan kullanıcının satırını güncelle

      if (error) throw error;

      Alert.alert("Harika!", "Profilin başarıyla oluşturuldu.", [
        { text: "Uygulamaya Başla", onPress: () => router.replace('/(tabs)/home') }
      ]);

    } catch (error: any) {
      console.error("Onboarding Hatası:", error.message);
      Alert.alert("Hata", "Bilgiler güncellenemedi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Sizi Tanıyalım</Text>
        <Text style={styles.subtitle}>Size özel diyet önerileri sunabilmemiz için bu bilgilere ihtiyacımız var.</Text>

        <View style={styles.row}>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Ad</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ahmet" 
              onChangeText={setName} 
            />
          </View>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Soyad</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Yılmaz" 
              onChangeText={setSurname} 
            />
          </View>
        </View>

        <Text style={styles.label}>Yaş</Text>
        <TextInput 
          style={styles.input} 
          placeholder="25" 
          keyboardType="number-pad" 
          onChangeText={setAge} 
          maxLength={3}
        />

        <View style={styles.row}>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Kilo (kg)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="70.5" 
              keyboardType="decimal-pad" 
              onChangeText={setWeight} 
            />
          </View>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Boy (cm)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="175" 
              keyboardType="number-pad" 
              onChangeText={setHeight} 
              maxLength={3}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSaveProfile} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Profilimi Tamamla</Text>
          )}
        </TouchableOpacity>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 25, 
    paddingTop: 80, 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#800020', 
    marginBottom: 10 
  },
  subtitle: { 
    fontSize: 15, 
    color: '#666', 
    marginBottom: 35,
    lineHeight: 22 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  halfInputContainer: { 
    width: '48%' 
  },
  label: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 8,
    marginTop: 5
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#eee', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 18, 
    backgroundColor: '#f9f9f9', 
    fontSize: 16 
  },
  button: { 
    backgroundColor: '#800020', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  }
});