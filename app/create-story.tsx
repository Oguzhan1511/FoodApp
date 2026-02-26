import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from './AuthContext';
import { useStory } from './StoryContext';

export default function CreateStoryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { uploadStory, uploading } = useStory(); // HOOK EKLENDİ
    const imageUri = params.imageUri as string;

    const handleShare = async () => {
        if (!imageUri || !user) {
            Alert.alert("Hata", `Kullanıcı veya Fotoğraf yok. User: ${!!user}, Image: ${!!imageUri}`);
            return;
        }

        // Network Check (Simple fetch to google)
        try {
            await fetch('https://www.google.com', { method: 'HEAD' });
        } catch (e) {
            Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
            return;
        }

        try {
            await uploadStory(imageUri);

            Alert.alert("Başarılı", "Hikayen paylaşıldı!", [
                { text: "Tamam", onPress: () => router.replace('/(tabs)/home') }
            ]);

        } catch (error: any) {
            console.error("Hikaye Paylaşım Hatası:", error);
            Alert.alert("Hata", "İşlem Hatası: " + (error.message || error));
        }
    };

    if (!imageUri) return null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                    <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShare}
                    disabled={uploading}
                >
                    {uploading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.shareText}>Hikayene Ekle</Text>
                            <Ionicons name="arrow-forward-circle" size={30} color="#fff" style={{ marginLeft: 10 }} />
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    image: { width: '100%', height: '100%', position: 'absolute' },
    topBar: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    bottomBar: { position: 'absolute', bottom: 50, right: 20, zIndex: 10 },
    shareButton: {
        backgroundColor: '#A00020',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 5
    },
    shareText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
