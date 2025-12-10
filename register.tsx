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

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = () => {
    if (!name || !surname || !weight || !height || !email || !password) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun!");
      return;
    }

    const weightVal = parseFloat(weight.replace(',', '.'));
    const heightCm = parseFloat(height);
    
    if (isNaN(weightVal) || isNaN(heightCm) || heightCm === 0) {
      Alert.alert("Hata", "Geçersiz boy veya kilo değeri.");
      return;
    }

    const heightM = heightCm / 100; 
    const bmi = weightVal / (heightM * heightM);

    const userData = {
      ad: name,
      soyad: surname,
      yas: parseInt(age),
      kilo: weightVal,
      boy: heightCm,
      vki: parseFloat(bmi.toFixed(2)),
      email: email.toLowerCase(),
      password: password
    };

    console.log("Kayıt Verisi:", userData);

    Alert.alert(
      "Kayıt Başarılı", 
      `Hoş geldin ${name}! VKİ değerin: ${userData.vki}`,
      [{ text: "Tamam", onPress: () => router.replace('/(tabs)') }]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <Text style={styles.headerTitle}>Hesap Oluştur</Text>
        <Text style={styles.subTitle}>Aramıza katılın.</Text>

        <View style={styles.row}>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Ad</Text>
            <TextInput style={styles.input} placeholder="Ahmet" onChangeText={setName}/>
          </View>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Soyad</Text>
            <TextInput style={styles.input} placeholder="Yılmaz" onChangeText={setSurname}/>
          </View>
        </View>

        <Text style={styles.label}>Yaş</Text>
        <TextInput style={styles.input} placeholder="25" keyboardType="number-pad" onChangeText={setAge} maxLength={3}/>

        <View style={styles.row}>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Kilo (kg)</Text>
            <TextInput style={styles.input} placeholder="70.5" keyboardType="decimal-pad" onChangeText={setWeight}/>
          </View>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Boy (cm)</Text>
            <TextInput style={styles.input} placeholder="175" keyboardType="number-pad" onChangeText={setHeight} maxLength={3}/>
          </View>
        </View>

        <Text style={styles.label}>E-Posta</Text>
        <TextInput style={styles.input} placeholder="ornek@mail.com" keyboardType="email-address" autoCapitalize="none" onChangeText={setEmail}/>

        <Text style={styles.label}>Şifre</Text>
        <TextInput style={styles.input} placeholder="******" secureTextEntry={true} onChangeText={setPassword}/>

        {/* --- Buton Rengi Güncellendi --- */}
        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Kayıt Ol</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 20, paddingTop: 60 },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#800020', // <-- Başlık BORDO
    marginBottom: 5,
  },
  subTitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInputContainer: { width: '48%' },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: '#f9f9f9', fontSize: 16 },
  
  button: {
    backgroundColor: '#800020', // <-- Buton Rengi BORDO
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
    shadowColor: "#800020", // <-- Gölge rengi de uyumlu olsun
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});