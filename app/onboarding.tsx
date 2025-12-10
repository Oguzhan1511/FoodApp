import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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
    if (!name || !surname || !weight || !height || !age) {
      Alert.alert("Eksik", "Lütfen tüm alanları doldurun.");
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

      // Hesaplamalar
      const weightVal = parseFloat(weight.replace(',', '.'));
      const heightCm = parseFloat(height);
      const heightM = heightCm / 100;
      const bmi = parseFloat((weightVal / (heightM * heightM)).toFixed(2));

      // Supabase Kaydı
      const { error } = await supabase
        .from('profiles')
        .insert([
          { 
            id: currentUser.uid, 
            email: currentUser.email,
            ad: name,
            soyad: surname,
            yas: parseInt(age),
            kilo: weightVal,
            boy: heightCm,
            vki: bmi
          }
        ]);

      if (error) throw error;

      Alert.alert("Harika!", "Profilin başarıyla oluşturuldu.", [
        { text: "Uygulamaya Başla", onPress: () => router.replace('/(tabs)') }
      ]);

    } catch (error: any) {
      Alert.alert("Hata", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Sizi Tanıyalım</Text>
        <Text style={styles.subtitle}>Size özel diyet listesi oluşturabilmemiz için bu bilgilere ihtiyacımız var.</Text>

        {/* --- Ad & Soyad Yan Yana --- */}
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

        {/* --- Yaş --- */}
        <Text style={styles.label}>Yaş</Text>
        <TextInput 
          style={styles.input} 
          placeholder="25" 
          keyboardType="number-pad" 
          onChangeText={setAge} 
          maxLength={3}
        />

        {/* --- Kilo & Boy Yan Yana --- */}
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

        {/* --- Kaydet Butonu --- */}
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSaveProfile} 
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Kaydediliyor..." : "Hesabımı Tamamla"}
          </Text>
        </TouchableOpacity>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 20, 
    paddingTop: 60, 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#800020', // Bordo Tema
    marginBottom: 10 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    marginBottom: 30,
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
    fontWeight: '600', 
    color: '#444', 
    marginBottom: 8,
    marginTop: 5
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 15, 
    backgroundColor: '#f9f9f9', 
    fontSize: 16 
  },
  button: { 
    backgroundColor: '#800020', // Bordo Tema
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 30,
    marginBottom: 40,
    shadowColor: "#800020",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  }
});