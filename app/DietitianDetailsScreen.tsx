import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { supabase } from './services/supabaseConfig';

export default function DietitianDetailsScreen() {
  const { uid, email, username } = useLocalSearchParams<{ uid: string, email: string, username: string }>();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [location, setLocation] = useState('');
  const [diplomaNo, setDiplomaNo] = useState('');
  const [diplomaImage, setDiplomaImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) setDiplomaImage(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!firstName || !lastName || !location || !diplomaNo || !diplomaImage) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun ve belge yükleyin.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('dietitians')
        .insert([{ 
          id: uid, 
          email: email,
          username: username, // Register ekranından geldi
          first_name: firstName,
          last_name: lastName,
          location: location,
          diploma_no: diplomaNo,
          is_verified: false 
        }]);

      if (error) throw error;
      Alert.alert("Başarılı", "Başvurunuz alındı.", [{ text: "Tamam", onPress: () => router.replace('/home') }]);
    } catch (error: any) {
      Alert.alert("Hata", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Diyetisyen Detayları</Text>
      
      <Text style={styles.label}>Ad</Text>
      <TextInput style={styles.input} placeholder="Adınız" onChangeText={setFirstName} />
      <Text style={styles.label}>Soyad</Text>
      <TextInput style={styles.input} placeholder="Soyadınız" onChangeText={setLastName} />
      <Text style={styles.label}>Konum</Text>
      <TextInput style={styles.input} placeholder="Şehir" onChangeText={setLocation} />
      <Text style={styles.label}>Diploma No</Text>
      <TextInput style={styles.input} placeholder="Numaranız" onChangeText={setDiplomaNo} keyboardType="numeric" />

      <Text style={styles.label}>Diploma Görseli</Text>
      <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
        {diplomaImage ? <Image source={{ uri: diplomaImage }} style={styles.img} /> : <Ionicons name="camera-outline" size={40} color="#800020" />}
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Kaydı Tamamla</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, flexGrow: 1, backgroundColor: '#fff', paddingTop: 50 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#800020', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#eee', padding: 15, borderRadius: 10, marginBottom: 15, backgroundColor: '#f9f9f9' },
  imageBox: { height: 150, borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  img: { width: '100%', height: '100%', borderRadius: 10 },
  btn: { backgroundColor: '#800020', padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});