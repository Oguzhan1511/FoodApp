import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View, Animated, Modal, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../services/apiConfig';
import { supabase } from '../services/supabaseConfig';
import { useAuth } from '../context/AuthContext';

export default function CameraScreen() {
    const { user } = useAuth();
    const [facing, setFacing] = useState<'front' | 'back'>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const params = useLocalSearchParams();
    const initialMode = (params.mode as 'POST' | 'ANALIZ' | 'HIKAYE') || 'POST';
    const [mode, setMode] = useState<'POST' | 'ANALIZ' | 'HIKAYE'>(initialMode);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzingImage, setAnalyzingImage] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const scanAnim = useRef(new Animated.Value(0)).current;

    const modes = ['POST', 'ANALIZ', 'HIKAYE'] as const;

    useEffect(() => {
        if (analyzing) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanAnim, { toValue: 300, duration: 1500, useNativeDriver: true }),
                    Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
                ])
            ).start();
        } else {
            scanAnim.setValue(0);
        }
    }, [analyzing]);

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

    const analyzeImage = async (uri: string) => {
        try {
            setAnalyzing(true);
            setAnalyzingImage(uri);
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                name: 'food.jpg',
                type: 'image/jpeg',
            } as any);

            const response = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'ngrok-skip-browser-warning': 'true',
                },
            });

            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                console.error("Sunucu Hatası Yanıtı:", errorText);
                throw new Error(`Sunucu hatası: ${response.status}. JSON bekleniyordu ama farklı bir veri geldi.`);
            }

            const data = await response.json();

            // Yemek değilse kullanıcıyı bilgilendir
            if (data.status === 'not_food') {
                setAnalyzing(false);
                setAnalyzingImage(null);
                Alert.alert(
                    "🚫 Yemek Algılanamadı",
                    "Çektiğiniz görsel bir yemek olarak tanınamadı. Lütfen bir yemek fotoğrafı çekin.",
                    [{ text: "Tamam" }]
                );
                return;
            }

            if (data.status === 'success') {
                // Kayıt İşlemi (Admin Paneli İçin)
                try {
                    const formDataLog = new FormData();
                    formDataLog.append('file', {
                        uri: uri,
                        name: `analysis_${Date.now()}.jpg`,
                        type: 'image/jpeg',
                    } as any);

                    const fileName = `analysis/${user?.id}/${Date.now()}.jpg`;
                    const { data: storageData } = await supabase.storage
                        .from('posts')
                        .upload(fileName, formDataLog, { contentType: 'image/jpeg' });

                    if (storageData) {
                        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
                        console.log("Görsel yüklendi, URL:", urlData.publicUrl);
                        
                        await supabase.from('analysis_logs').insert({
                            user_id: user?.id,
                            image_url: urlData.publicUrl,
                            food_name: data.food_name,
                            confidence: data.confidence
                        });
                        
                        // ÖNEMLİ: Görsel URL'sini sonuç objesine ekle
                        data.image_url = urlData.publicUrl;
                    } else {
                        console.error("Storage yükleme başarısız, storageData boş.");
                    }
                } catch (logErr) {
                    console.error("Görsel yükleme veya log hatası:", logErr);
                }

                setAnalysisResult(data);
                setShowResultModal(true);
            } else {
                Alert.alert("Hata", "Yemek tanınamadı.");
            }
        } catch (error) {
            console.error("Analiz Hatası:", error);
            Alert.alert("Hata", "Tahmin motoruna ulaşılamadı.");
        } finally {
            setAnalyzing(false);
            // setAnalyzingImage(null); // Modal kapandığında veya sonuç geldiğinde temizleyebiliriz
        }
    };

    const takePicture = async () => {
        if (mode === 'HIKAYE') {
            if (cameraRef.current) {
                try {
                    const options = { quality: 0.7, base64: false, mirrorImage: true };
                    const photoData = await cameraRef.current.takePictureAsync(options);
                    if (photoData?.uri) {
                        router.push({
                            pathname: '/create-story' as any,
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
                    const options = { quality: 0.5, base64: false };
                    const photoData = await cameraRef.current.takePictureAsync(options);
                    if (photoData?.uri) {
                        await analyzeImage(photoData.uri);
                    }
                } catch (error) {
                    console.error("Çekim Hatası:", error);
                    Alert.alert("Hata", "Fotoğraf çekilemedi.");
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
                        pathname: '/create-post' as any,
                        params: { imageUris: photoData.uri }
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
            const isPost = mode === 'POST';
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
                allowsMultipleSelection: isPost,
                selectionLimit: isPost ? 10 : 1
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                if (mode === 'HIKAYE') {
                    router.push({
                        pathname: '/create-story' as any,
                        params: { imageUri: result.assets[0].uri }
                    });
                } else if (mode === 'POST') {
                    const uris = result.assets.map(a => a.uri).join(',');
                    router.push({
                        pathname: '/create-post' as any,
                        params: { imageUris: uris }
                    });
                } else if (mode === 'ANALIZ') {
                    await analyzeImage(result.assets[0].uri);
                } else {
                    router.push({
                        pathname: '/create-post' as any,
                        params: { imageUris: result.assets[0].uri }
                    });
                }
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

                {analyzing && (
                    <View style={styles.scanningOverlay}>
                        {analyzingImage && (
                            <Image 
                                source={{ uri: analyzingImage }} 
                                style={StyleSheet.absoluteFillObject}
                                blurRadius={1}
                            />
                        )}
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                        <Animated.View style={[styles.scannerLine, { transform: [{ translateY: scanAnim }] }]} />
                        <Text style={styles.scanningText}>Yemek Analiz Ediliyor...</Text>
                    </View>
                )}

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

                {/* ANALİZ SONUÇ MODALI */}
                <Modal
                    visible={showResultModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowResultModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.resultPanel}>
                            <View style={styles.panelHeader}>
                                <Text style={styles.panelTitle}>Analiz Sonucu</Text>
                                <TouchableOpacity onPress={() => setShowResultModal(false)}>
                                    <Ionicons name="close-circle" size={30} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {analysisResult && (
                                    <>
                                        <View style={styles.mainResult}>
                                            <Text style={styles.foodName}>{analysisResult.food_name}</Text>
                                            <Text style={styles.calories}>{analysisResult.calories_per_100g} kcal <Text style={{fontSize:14, color:'#666'}}>(100g)</Text></Text>
                                            
                                            <View style={styles.confidenceContainer}>
                                                <Text style={styles.confidenceText}>Güven Oranı: %{(analysisResult.confidence * 100).toFixed(1)}</Text>
                                                <View style={styles.confidenceBarBg}>
                                                    <View style={[styles.confidenceBarFill, { width: `${analysisResult.confidence * 100}%` }]} />
                                                </View>
                                            </View>
                                        </View>

                                        {analysisResult.all_predictions && analysisResult.all_predictions.length > 1 && (
                                            <View style={styles.alternatives}>
                                                <Text style={styles.alternativeTitle}>Diğer Olasılıklar</Text>
                                                {analysisResult.all_predictions.slice(1).map((p: any, i: number) => (
                                                    <TouchableOpacity 
                                                        key={i} 
                                                        style={styles.altItem}
                                                        onPress={() => setAnalysisResult({ ...analysisResult, food_name: p.food_name, calories_per_100g: p.calories, confidence: p.confidence })}
                                                    >
                                                        <Text style={styles.altName}>{p.food_name}</Text>
                                                        <Text style={styles.altConf}>%{(p.confidence * 100).toFixed(0)}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}

                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity 
                                                style={[styles.actionBtn, {backgroundColor: '#800020'}]}
                                                onPress={() => {
                                                    setShowResultModal(false);
                                                    router.push({
                                                        pathname: '/create-post' as any,
                                                        params: {
                                                            initialFoodName: analysisResult.food_name,
                                                            initialCalories: analysisResult.calories_per_100g.toString()
                                                        }
                                                    });
                                                }}
                                            >
                                                <Text style={styles.actionBtnText}>Paylaş</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={[styles.actionBtn, {backgroundColor: '#4CAF50'}]}
                                                onPress={() => {
                                                    Alert.prompt(
                                                        "Miktar",
                                                        `Kaç gram ${analysisResult.food_name} yediniz?`,
                                                        async (gramText) => {
                                                            const gram = parseFloat(gramText || '100');
                                                            if (isNaN(gram) || gram <= 0) {
                                                                Alert.alert("Hata", "Geçerli bir gram değeri girin.");
                                                                return;
                                                            }
                                                            const ratio = gram / 100;
                                                            const kcal  = (analysisResult.calories_per_100g || 0) * ratio;
                                                            const protein = (analysisResult.protein_per_100g || 0) * ratio;
                                                            const fat     = (analysisResult.fat_per_100g || 0) * ratio;
                                                            const carbs   = (analysisResult.carbs_per_100g || 0) * ratio;
                                                            const newEntry = {
                                                                name: analysisResult.food_name,
                                                                kcal:    Math.round(kcal),
                                                                protein: Math.round(protein * 10) / 10,
                                                                fat:     Math.round(fat * 10) / 10,
                                                                carbs:   Math.round(carbs * 10) / 10,
                                                                gram,
                                                                date: new Date().toISOString(),
                                                            };
                                                            try {
                                                                const today = new Date().toISOString().split('T')[0];
                                                                const logKey = `daily_food_log_${user?.id}_${today}`;
                                                                const stored = await AsyncStorage.getItem(logKey);
                                                                const existing = stored ? JSON.parse(stored) : [];
                                                                existing.push(newEntry);
                                                                await AsyncStorage.setItem(logKey, JSON.stringify(existing));
                                                                setShowResultModal(false);
                                                                Alert.alert(
                                                                    "✅ Eklendi",
                                                                    `${gram}g ${analysisResult.food_name}\n${Math.round(kcal)} kcal | P:${Math.round(protein)}g Y:${Math.round(fat)}g K:${Math.round(carbs)}g`
                                                                );
                                                            } catch (e) {
                                                                Alert.alert("Hata", "Günlüğe eklenemedi.");
                                                            }
                                                        },
                                                        'plain-text',
                                                        '100',
                                                        'numeric'
                                                    );
                                                }}
                                            >
                                                <Text style={styles.actionBtnText}>Günlüğe Ekle</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* BİLDİR BUTONU */}
                                        <TouchableOpacity
                                            style={styles.reportBtn}
                                            onPress={() => {
                                                Alert.prompt(
                                                    "Analizi Bildir",
                                                    `Model "${analysisResult.food_name}" dedi. Doğru yemek adı neydi?`,
                                                    async (correctName) => {
                                                        if (!correctName?.trim()) return;
                                                        try {
                                                            const feedbackData = {
                                                                user_id: user?.id,
                                                                predicted_food: analysisResult.food_name,
                                                                correct_food: correctName.trim(),
                                                                confidence: analysisResult.confidence,
                                                                image_url: analysisResult.image_url || null,
                                                            };
                                                            console.log("Geri bildirim gönderiliyor:", feedbackData);
                                                            
                                                            const { error } = await supabase.from('analysis_feedback').insert(feedbackData);
                                                            if (error) throw error;

                                                            setShowResultModal(false);
                                                            Alert.alert('✅ Teşekkürler', 'Geri bildiriminiz modeli geliştirmemize yardımcı olacak!');
                                                        } catch (e) {
                                                            console.error("Bildirim gönderme hatası:", e);
                                                            Alert.alert('Hata', 'Bildirim gönderilemedi.');
                                                        }
                                                    },
                                                    'plain-text'
                                                );
                                            }}
                                        >
                                            <Ionicons name="flag-outline" size={14} color="#999" />
                                            <Text style={styles.reportBtnText}>Yanlış tahmin mi? Bildir</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
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
    // SCANNING STYLES
    scanningOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)'
    },
    scannerLine: {
        width: '80%',
        height: 2,
        backgroundColor: '#ff4d4d',
        shadowColor: '#ff4d4d',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 5,
    },
    scanningText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 40,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3
    },
    // RESULT MODAL STYLES
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end'
    },
    resultPanel: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 25,
        maxHeight: '70%'
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    panelTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333'
    },
    mainResult: {
        alignItems: 'center',
        marginBottom: 25,
        padding: 20,
        backgroundColor: '#f8f9fa',
        borderRadius: 15
    },
    foodName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#800020',
        marginBottom: 5,
        textTransform: 'capitalize'
    },
    calories: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15
    },
    confidenceContainer: {
        width: '100%',
        alignItems: 'center'
    },
    confidenceText: {
        fontSize: 13,
        color: '#666',
        marginBottom: 8
    },
    confidenceBarBg: {
        width: '100%',
        height: 8,
        backgroundColor: '#e9ecef',
        borderRadius: 4,
        overflow: 'hidden'
    },
    confidenceBarFill: {
        height: '100%',
        backgroundColor: '#4CAF50'
    },
    alternatives: {
        marginBottom: 25
    },
    alternativeTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 10
    },
    altItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    altName: {
        fontSize: 16,
        color: '#333',
        textTransform: 'capitalize'
    },
    altConf: {
        fontSize: 14,
        color: '#999',
        fontWeight: 'bold'
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10
    },
    actionBtn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    reportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
    },
    reportBtnText: {
        color: '#999',
        fontSize: 13,
    }
});
