import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from './services/apiConfig';

export default function CameraScreen() {
    const [facing, setFacing] = useState<'front' | 'back'>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const params = useLocalSearchParams();
    const initialMode = (params.mode as 'POST' | 'ANALIZ' | 'HIKAYE') || 'POST';
    const [mode, setMode] = useState<'POST' | 'ANALIZ' | 'HIKAYE'>(initialMode);
    const [analyzing, setAnalyzing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    const modes = ['POST', 'ANALIZ', 'HIKAYE'] as const;

    if (!permission) return <View />;

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Ionicons name="videocam-off" size={80} color="#800020" />
                <Text style={styles.message}>Kamerayı kullanmak için izniniz gerekiyor.</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>İzin Ver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (mode === 'HIKAYE') {
            if (cameraRef.current) {
                try {
                    const options = { quality: 0.7, base64: false, mirrorImage: true }; // AYNA MODU DÜZELTİLDİ
                    const photoData = await cameraRef.current.takePictureAsync(options);
                    if (photoData?.uri) {
                        router.push({
                            pathname: '/create-story',
                            params: { imageUri: photoData.uri }
                        });
                    }
                } catch (error) {
                    console.error("Çekim Hatası:", error);
                    Alert.alert("Hata", "Fotoğraf çekilemedi.");
                }
            }
            return;
        }

        if (mode === 'ANALIZ') {
            if (cameraRef.current) {
                try {
                    setAnalyzing(true);
                    const options = { quality: 0.5, base64: false };
                    const photoData = await cameraRef.current.takePictureAsync(options);

                    if (photoData?.uri) {
                        const formData = new FormData();
                        formData.append('file', {
                            uri: photoData.uri,
                            name: 'food.jpg',
                            type: 'image/jpeg',
                        } as any);

                        const response = await fetch(`${API_URL}/predict`, {
                            method: 'POST',
                            body: formData,
                            headers: {
                                'Content-Type': 'multipart/form-data',
                                'ngrok-skip-browser-warning': 'true', // Ngrok uyarı sayfasını atlamak için
                            },
                        });

                        const contentType = response.headers.get("content-type");
                        if (!response.ok || !contentType || !contentType.includes("application/json")) {
                            const errorText = await response.text();
                            console.error("Sunucu Hatası Yanıtı:", errorText);
                            throw new Error(`Sunucu hatası: ${response.status}. JSON bekleniyordu ama farklı bir veri geldi.`);
                        }

                        const data = await response.json();
                        if (data.status === 'success') {
                            Alert.alert(
                                "Analiz Başarılı",
                                `Yiyecek: ${data.food_name}\nKalori (100g): ${data.calories_per_100g} kcal\nGüven Oranı: %${(data.confidence * 100).toFixed(1)}`,
                                [
                                    { text: "Tamam" },
                                    {
                                        text: "Paylaş", onPress: () => router.push({
                                            pathname: '/create-post',
                                            params: {
                                                imageUri: photoData.uri,
                                                initialFoodName: data.food_name,
                                                initialCalories: data.calories_per_100g.toString()
                                            }
                                        })
                                    }
                                ]
                            );
                        } else {
                            Alert.alert("Hata", "Yemek tanınamadı.");
                        }
                    }
                } catch (error) {
                    console.error("Analiz Hatası:", error);
                    Alert.alert("Hata", "Tahmin motoruna ulaşılamadı. Ngrok açık mı?");
                } finally {
                    setAnalyzing(false);
                }
            }
            return;
        }

        if (cameraRef.current) {
            try {
                const options = { quality: 0.7, base64: false };
                const photoData = await cameraRef.current.takePictureAsync(options);
                if (photoData?.uri) {
                    router.push({
                        pathname: '/create-post',
                        params: { imageUri: photoData.uri }
                    });
                }
            } catch (error) {
                console.error("Çekim Hatası:", error);
                Alert.alert("Hata", "Fotoğraf çekildi ancak işlenemedi.");
            }
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0].uri) {
                router.push({
                    pathname: '/create-post',
                    params: { imageUri: result.assets[0].uri }
                });
            }
        } catch (error) {
            Alert.alert("Hata", "Galeri açılamadı.");
        }
    };

    // Kamera Aktif Görünümü
    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* MOD SEÇİCİ */}
                <View style={styles.modeContainer}>
                    {modes.map((m) => (
                        <TouchableOpacity key={m} onPress={() => setMode(m)} style={styles.modeButton}>
                            <Text style={[styles.modeText, mode === m && styles.activeModeText]}>
                                {m}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
                        <Ionicons name="images-outline" size={28} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.shutterButtonOuter} onPress={takePicture} disabled={analyzing}>
                        {analyzing ? (
                            <ActivityIndicator size="large" color="#fff" />
                        ) : (
                            <View style={[styles.shutterButtonInner, (mode !== 'POST' && mode !== 'HIKAYE' && mode !== 'ANALIZ') && styles.disabledShutter]} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconButton} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
                        <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 },
    message: { textAlign: 'center', marginBottom: 20, fontSize: 16, marginTop: 20 },
    permissionButton: { backgroundColor: '#800020', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    permissionButtonText: { color: '#fff', fontWeight: 'bold' },
    camera: { flex: 1 },
    topBar: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
    modeContainer: {
        position: 'absolute',
        bottom: 140, // Shutter butonunun üstünde
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 10,
    },
    modeButton: {
        paddingHorizontal: 15,
    },
    modeText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        fontSize: 16,
    },
    activeModeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    bottomBar: { position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%', justifyContent: 'space-around', alignItems: 'center', zIndex: 10 },
    shutterButtonOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    shutterButtonInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
    disabledShutter: { backgroundColor: '#ccc' },
    iconButton: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 25 },
});
