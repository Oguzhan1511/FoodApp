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
import { supabase } from './services/supabaseConfig';
import { useStory } from './StoryContext'; // IMPORT EKLENDİ

const { width, height } = Dimensions.get('window');

export default function StoryViewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const userId = params.userId as string;

    // Context'ten hikayeleri al
    const { stories: contextStories } = useStory();

    // Başlangıçta context'teki veriyi kullan, yoksa boş dizi
    const initialStories = contextStories.find((s: any) => s.id === userId)?.stories || [];

    const [stories, setStories] = useState<any[]>(initialStories);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(initialStories.length === 0);

    // Animasyon
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (userId && stories.length === 0) {
            fetchStories();
        } else if (stories.length > 0) {
            startAnimation();
        }
    }, [userId]);

    const fetchStories = async () => {
        try {
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from('stories')
                .select('*')
                .eq('user_id', userId)
                .gt('expires_at', now)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setStories(data);
                startAnimation();
            } else {
                // Hikaye yoksa geri dön
                router.back();
            }
        } catch (error) {
            console.error(error);
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const startAnimation = () => {
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
            // İlk hikayede geri basılırsa (Opsiyonel: Önceki kullanıcıya geç)
            progress.setValue(0);
            startAnimation();
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

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
                        <Text style={styles.username}>Hikaye</Text>
                        <Text style={styles.time}>{new Date(currentStory.created_at).toLocaleTimeString().slice(0, 5)}</Text>
                    </View>

                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
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
    }
});
