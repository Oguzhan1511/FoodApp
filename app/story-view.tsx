import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { supabase } from '../services/supabaseConfig';
import { useStory } from '../context/StoryContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function StoryViewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const userId = params.userId as string;

    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Context'ten hikayeleri al
    const { stories: contextStories, deleteStory, markStoryAsViewed } = useStory();

    // Doğrudan Context'teki veriyi kullan (Network request tekrarı yapma)
    const stories = contextStories.find((s: any) => s.id === userId)?.stories || [];

    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewers, setViewers] = useState<any[]>([]);
    const [showViewers, setShowViewers] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Animasyon
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (stories.length === 0 || currentIndex >= stories.length) {
            // Eğer hikaye kalmadıysa (silindiyse veya bittiyse) geri dön
            router.back();
            return;
        }

        startAnimation();
        handleMarkViewed();
        if (userId === user?.id) {
            fetchViewers();
        }
    }, [userId, currentIndex, stories.length]);

    const handleMarkViewed = async () => {
        if (userId !== user?.id && stories[currentIndex]) {
            await markStoryAsViewed(stories[currentIndex].id);
        }
    };

    const fetchViewers = async () => {
        if (userId !== user?.id || !stories[currentIndex]) return;
        try {
            const { data, error } = await supabase
                .from('story_views')
                .select('user_id, created_at, profiles(username, avatar_url)')
                .eq('story_id', stories[currentIndex].id);
            
            if (error) {
                console.error('Fetch viewers error:', error.message);
                // Yabancı anahtar (Foreign Key) hatası veriyorsa fallback yap:
                const { data: fallbackData } = await supabase
                    .from('story_views')
                    .select('user_id, created_at')
                    .eq('story_id', stories[currentIndex].id);
                
                if (fallbackData) {
                    const uniqueViewers = Array.from(new Map(fallbackData.map(item => [item.user_id, item])).values());
                    setViewers(uniqueViewers);
                }
                return;
            }

            if (data) {
                const uniqueViewers = Array.from(new Map(data.map(item => [item.user_id, item])).values());
                setViewers(uniqueViewers);
            }
        } catch (e) {
            console.error('Fetch viewers catch error:', e);
        }
    };

    const startAnimation = () => {
        if (isPaused) return;
        
        progress.setValue(0);
        Animated.timing(progress, {
            toValue: 1,
            duration: 5000, // 5 saniye
            useNativeDriver: false
        }).start(({ finished }) => {
            if (finished) {
                handleNext();
            }
        });
    };

    useEffect(() => {
        if (isPaused) {
            progress.stopAnimation();
        } else if (stories.length > 0) {
            // Animasyonu kaldığı yerden değil baştan başlatıyoruz (basitlik için)
            startAnimation();
        }
    }, [isPaused]);

    const handleNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            progress.setValue(0);
            startAnimation();
        } else {
            // Hikayeler bitti
            router.back();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            progress.setValue(0);
            startAnimation();
        } else {
            progress.setValue(0);
            startAnimation();
        }
    };

    if (stories.length === 0) return null;

    const currentStory = stories[currentIndex];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar hidden />

            {/* Görsel */}
            <Image
                source={{ uri: currentStory.image_url }}
                style={styles.image}
                resizeMode="cover"
            />

            {/* Dokunma Alanları (Sol / Sağ) */}
            <View style={styles.touchContainer}>
                <TouchableWithoutFeedback onPress={handlePrev}>
                    <View style={styles.touchArea} />
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback onPress={handleNext}>
                    <View style={styles.touchArea} />
                </TouchableWithoutFeedback>
            </View>

            {/* Üst Bar: Progress & User Info */}
            <View style={styles.header}>
                {/* Progress Bars */}
                <View style={styles.progressContainer}>
                    {stories.map((story, index) => (
                        <View key={story.id} style={styles.progressBarBackground}>
                            {index === currentIndex ? (
                                <Animated.View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: progress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%']
                                            })
                                        }
                                    ]}
                                />
                            ) : index < currentIndex ? (
                                <View style={[styles.progressBarFill, { width: '100%' }]} />
                            ) : null}
                        </View>
                    ))}
                </View>

                {/* Kullanıcı Bilgisi ve Kapat */}
                <View style={styles.userInfoRow}>
                    <View style={styles.userInfo}>
                        <Image 
                            source={{ uri: contextStories.find(s => s.id === userId)?.avatar }} 
                            style={styles.avatar} 
                        />
                        <View>
                            <Text style={styles.username}>{contextStories.find(s => s.id === userId)?.name}</Text>
                            <Text style={styles.time}>{new Date(currentStory.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {userId === user?.id && (
                            <TouchableOpacity 
                                style={{ marginRight: 20 }}
                                onPress={() => {
                                    setIsPaused(true);
                                    import('react-native').then(({ Alert }) => {
                                        Alert.alert(
                                            "Hikayeyi Sil",
                                            "Bu hikayeyi kalıcı olarak silmek istediğinize emin misiniz?",
                                            [
                                                { text: "Vazgeç", style: "cancel", onPress: () => setIsPaused(false) },
                                                { 
                                                    text: "Sil", 
                                                    style: "destructive", 
                                                    onPress: async () => {
                                                        await deleteStory(currentStory.id);
                                                        router.back();
                                                    }
                                                }
                                            ]
                                        );
                                    });
                                }}
                            >
                                <Ionicons name="trash-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => router.back()}>
                            <Ionicons name="close" size={32} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Alt Bar: Views (Sadece kendi hikayesi ise) */}
            {userId === user?.id && (
                <TouchableOpacity 
                    style={styles.footer}
                    onPress={() => {
                        setIsPaused(true);
                        setShowViewers(true);
                    }}
                >
                    <Ionicons name="eye-outline" size={20} color="#fff" />
                    <Text style={styles.viewCountText}>{viewers.length} Görüntüleme</Text>
                </TouchableOpacity>
            )}

            {/* Görüntüleyenler Modalı (Basit Overlay) */}
            {showViewers && (
                <View style={styles.viewersOverlay}>
                    {/* BlurView yerine koyu transparan view kullanıyoruz */}
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.95)', borderRadius: 25 }]} />
                    <View style={styles.viewersHeader}>
                        <Text style={styles.viewersTitle}>Görüntüleyenler ({viewers.length})</Text>
                        <TouchableOpacity onPress={() => {
                            setShowViewers(false);
                            setIsPaused(false);
                        }}>
                            <Ionicons name="close-circle" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.viewersList}>
                        {viewers.length === 0 ? (
                            <Text style={styles.noViewersText}>Henüz kimse görmedi.</Text>
                        ) : (
                            viewers.map((v, idx) => (
                                <View key={idx} style={styles.viewerItem}>
                                    <Image 
                                        source={{ uri: v.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${v.profiles?.username}&background=random` }} 
                                        style={styles.viewerAvatar} 
                                    />
                                    <View>
                                        <Text style={styles.viewerName}>{v.profiles?.username}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    image: { width: width, height: height, position: 'absolute' },
    touchContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        zIndex: 5
    },
    touchArea: {
        flex: 1,
        // backgroundColor: 'rgba(255,0,0,0.1)' // Debug için
    },
    header: {
        position: 'absolute',
        top: 40,
        left: 10,
        right: 10,
        zIndex: 10
    },
    progressContainer: {
        flexDirection: 'row',
        marginBottom: 10,
        justifyContent: 'space-between',
    },
    progressBarBackground: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        marginHorizontal: 2
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 2
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 5,
        paddingHorizontal: 5
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#fff'
    },
    username: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginRight: 10
    },
    time: {
        color: '#ddd',
        fontSize: 12
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        zIndex: 15
    },
    viewCountText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: 'bold',
        fontSize: 14
    },
    // Viewers Overlay
    viewersOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.6,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        zIndex: 100
    },
    viewersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 15
    },
    viewersTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    viewersList: {
        flex: 1
    },
    viewerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    viewerAvatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        marginRight: 15,
        backgroundColor: '#333'
    },
    viewerName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15
    },
    viewerTime: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 2
    },
    noViewersText: {
        color: '#aaa',
        textAlign: 'center',
        marginTop: 40,
        fontStyle: 'italic'
    }
});
