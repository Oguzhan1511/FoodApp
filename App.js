import { useState } from 'react';
import { Alert, Button, Image, StyleSheet, Text, View } from 'react-native';
import { launchCamera } from 'react-native-image-picker';

const App = () => {
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);

  const handleCameraLaunch = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      quality: 1,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Hata', response.errorMessage);
      } else {
        const source = response.assets[0];
        setPhoto(source);
        uploadImage(source); // Fotoğraf çekilince otomatik gönder
      }
    });
  };

  const uploadImage = async (image) => {
    const formData = new FormData();
    formData.append('file', {
      uri: image.uri,
      type: image.type || 'image/jpeg',
      name: image.fileName || 'food.jpg',
    });

    try {
      const response = await fetch('http://192.168.1.21:8000/predict', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Bağlantı Hatası', 'Sunucuya ulaşılamadı. IP adresini kontrol et!');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Foodap Kalori Takibi</Text>
      
      {photo && <Image source={{ uri: photo.uri }} style={styles.image} />}
      
      <Button title="Fotoğraf Çek" onPress={handleCameraLaunch} />

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.foodName}>Yiyecek: {result.food_name}</Text>
          <Text style={styles.calories}>Kalori (100g): {result.calories_per_100g} kcal</Text>
          <Text>Güven Oranı: %{(result.confidence * 100).toFixed(1)}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  image: { width: 300, height: 300, borderRadius: 10, marginBottom: 20 },
  resultBox: { marginTop: 20, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center' },
  foodName: { fontSize: 20, color: 'green', fontWeight: 'bold' },
  calories: { fontSize: 18, fontWeight: '600' }
});

export default App;