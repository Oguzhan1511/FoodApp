import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    PanResponder,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useAuth } from '../context/AuthContext';
import { useStory } from '../context/StoryContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// A component for Draggable and Zoomable Text
const DraggableText = ({ text, color, initialFontSize, isCapturing, onRemove }: { text: string; color: string; initialFontSize: number; isCapturing: boolean; onRemove: () => void }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scale = useRef(new Animated.Value(1)).current;
    
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
                pan.setValue({ x: 0, y: 0 });
                initialDistance.current = null;
            },
            onPanResponderMove: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches;
                if (touches.length >= 2) {
                    const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
                    if (initialDistance.current === null) {
                        initialDistance.current = distance;
                        initialScale.current = (scale as any)._value;
                    } else {
                        const newScale = (distance / initialDistance.current) * initialScale.current;
                        scale.setValue(Math.max(0.3, Math.min(5, newScale)));
                    }
                } else if (touches.length === 1 && initialDistance.current === null) {
                    pan.setValue({ x: gestureState.dx, y: gestureState.dy });
                }
            },
            onPanResponderRelease: () => {
                pan.flattenOffset();
                initialDistance.current = null;
            }
        })
    ).current;

    return (
        <Animated.View
            style={[
                {
                    transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
                    position: 'absolute',
                    top: SCREEN_HEIGHT / 3,
                    left: 50,
                    zIndex: 100,
                }
            ]}
            {...panResponder.panHandlers}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.storyText, { color, fontSize: initialFontSize }]}>{text}</Text>
                {!isCapturing && (
                    <TouchableOpacity onPress={onRemove} style={styles.removeTextBtn}>
                        <Ionicons name="close-circle" size={24} color="red" />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

export default function CreateStoryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { uploadStory, uploading } = useStory();
    const imageUri = params.imageUri as string;
    const viewShotRef = useRef<ViewShot>(null);

    // Text Overlay States
    const [texts, setTexts] = useState<{ id: number; text: string; color: string; fontSize: number }[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false); // Ekran yakalanırken ikonları gizlemek için
    const [currentText, setCurrentText] = useState('');
    const [selectedColor, setSelectedColor] = useState('#FFFFFF');
    const colors = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];

    // Background Image Pan and Zoom State (Pure PanResponder)
    const pan = useRef(new Animated.ValueXY()).current;
    const scale = useRef(new Animated.Value(1)).current;
    
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef<number>(1);

    const imagePanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
                pan.setValue({ x: 0, y: 0 });
                initialDistance.current = null;
            },
            onPanResponderMove: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches;
                if (touches.length >= 2) {
                    const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
                    if (initialDistance.current === null) {
                        initialDistance.current = distance;
                        initialScale.current = (scale as any)._value;
                    } else {
                        const newScale = (distance / initialDistance.current) * initialScale.current;
                        scale.setValue(Math.max(0.1, Math.min(5, newScale)));
                    }
                } else if (touches.length === 1 && initialDistance.current === null) {
                    pan.setValue({ x: gestureState.dx, y: gestureState.dy });
                }
            },
            onPanResponderRelease: () => {
                pan.flattenOffset();
                initialDistance.current = null;
            }
        })
    ).current;

    const handleShare = async () => {
        if (!imageUri || !user) {
            Alert.alert("Hata", "Gerekli bilgiler eksik.");
            return;
        }

        setIsCapturing(true); // Çarpı ikonlarını gizle

        // React'in UI'ı (çarpı ikonlarını) gizleyebilmesi için çok kısa bir süre bekle
        setTimeout(async () => {
            try {
                const uri = await viewShotRef.current?.capture?.();
                if (!uri) throw new Error("Görüntü yakalanamadı.");

                await uploadStory(uri);

                Alert.alert("Başarılı", "Hikayen paylaşıldı!", [
                    { text: "Tamam", onPress: () => router.replace('/(tabs)/home' as any) }
                ]);
            } catch (error: any) {
                console.error("Hikaye Paylaşım Hatası:", error);
                Alert.alert("Hata", "İşlem Hatası: " + (error.message || error));
            } finally {
                setIsCapturing(false); // İşlem bitince çarpıları geri getir
            }
        }, 100);
    };

    const addText = () => {
        if (currentText.trim() !== '') {
            setTexts([...texts, { id: Date.now(), text: currentText, color: selectedColor, fontSize: 32 }]);
            setCurrentText('');
        }
        setIsTyping(false);
        Keyboard.dismiss();
    };

    if (!imageUri) return null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" hidden={isTyping} />

            {/* VIEW SHOT AREA */}
            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.viewShotContainer}>
                
                {/* BLURRED BACKGROUND */}
                <Image 
                    source={{ uri: imageUri }} 
                    style={[StyleSheet.absoluteFillObject, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]} 
                    resizeMode="cover" 
                    blurRadius={20} 
                />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />

                <Animated.View 
                    style={[styles.imageWrapper, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] }]}
                    {...imagePanResponder.panHandlers}
                >
                    <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
                </Animated.View>

                {texts.map((t) => (
                    <DraggableText
                        key={t.id}
                        text={t.text}
                        color={t.color}
                        initialFontSize={t.fontSize}
                        isCapturing={isCapturing}
                        onRemove={() => setTexts(texts.filter(item => item.id !== t.id))}
                    />
                ))}
            </ViewShot>

            {/* ÜST BAR (Araçlar) */}
            {!isTyping && (
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => setIsTyping(true)} style={styles.iconButton}>
                        <Ionicons name="text" size={30} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {/* ALT BAR (Paylaş Butonu) */}
            {!isTyping && (
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
            )}

            {/* YAZI EKLEME MODU */}
            {isTyping && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.typingOverlay}>
                    <TouchableOpacity style={styles.dismissTyping} onPress={() => setIsTyping(false)} />
                    
                    <View style={styles.typingControls}>
                        <TouchableOpacity onPress={addText} style={styles.doneBtn}>
                            <Text style={styles.doneBtnText}>Bitti</Text>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={[styles.textInput, { color: selectedColor }]}
                        autoFocus
                        multiline
                        placeholder="Bir şeyler yaz..."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={currentText}
                        onChangeText={setCurrentText}
                    />

                    {/* Renk Paleti */}
                    <View style={styles.colorPalette}>
                        {colors.map(c => (
                            <TouchableOpacity
                                key={c}
                                style={[styles.colorCircle, { backgroundColor: c }, selectedColor === c && styles.selectedColor]}
                                onPress={() => setSelectedColor(c)}
                            />
                        ))}
                    </View>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    viewShotContainer: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
    imageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'absolute' },
    
    topBar: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
    shareText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    storyText: {
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
    },
    removeTextBtn: { marginLeft: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12 },

    typingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, justifyContent: 'center' },
    dismissTyping: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    typingControls: { position: 'absolute', top: 50, right: 20, zIndex: 201 },
    doneBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15 },
    doneBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    
    textInput: { textAlign: 'center', fontWeight: 'bold', padding: 20, fontSize: 32, zIndex: 201 },
    
    colorPalette: { position: 'absolute', bottom: 100, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 15, zIndex: 201 },
    colorCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
    selectedColor: { transform: [{ scale: 1.3 }] }
});
