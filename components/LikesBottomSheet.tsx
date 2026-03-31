import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { supabase } from '../app/services/supabaseConfig';
import { useTheme } from '../app/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface UserLiked {
    id: string;
    username: string;
    avatar_url: string | null;
    first_name?: string;
    last_name?: string;
}

interface LikesBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    postId: string;
}

export default function LikesBottomSheet({ isVisible, onClose, postId }: LikesBottomSheetProps) {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [likes, setLikes] = useState<UserLiked[]>([]);
    const [loading, setLoading] = useState(true);

    // Tematik Renkler
    const bgColor = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#eeeeee';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';

    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10
            }).start();
            fetchLikes();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [isVisible]);

    const fetchLikes = async () => {
        if (!postId) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('post_likes')
                .select('user_id')
                .eq('post_id', postId);

            if (error) throw error;

            if (data && data.length > 0) {
                const userIds = data.map(l => l.user_id);

                // Profilleri ve Diyetisyenleri çek
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, ad, soyad')
                    .in('id', userIds);

                const { data: dietitians } = await supabase
                    .from('dietitians')
                    .select('id, username, profile_picture, first_name, last_name')
                    .in('id', userIds);

                const userMap: Record<string, UserLiked> = {};
                profiles?.forEach(p => {
                    userMap[p.id] = {
                        id: p.id,
                        username: p.username,
                        avatar_url: p.avatar_url,
                        first_name: p.ad,
                        last_name: p.soyad
                    };
                });

                dietitians?.forEach(d => {
                    if (!userMap[d.id]) {
                        userMap[d.id] = {
                            id: d.id,
                            username: d.username,
                            avatar_url: d.profile_picture,
                            first_name: d.first_name,
                            last_name: d.last_name
                        };
                    }
                });

                const likedUsers = userIds
                    .map(id => userMap[id])
                    .filter(u => !!u);

                setLikes(likedUsers);
            } else {
                setLikes([]);
            }
        } catch (error) {
            console.error("Beğenileri çekme hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true
        }).start(() => onClose());
    };

    const handleUserPress = (userId: string) => {
        handleClose();
        router.push({ pathname: '/user-profile', params: { userId } });
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <Animated.View
                            style={[
                                styles.container,
                                {
                                    backgroundColor: bgColor,
                                    transform: [{ translateY: slideAnim }]
                                }
                            ]}
                        >
                            <View style={[styles.handle, { backgroundColor: borderColor }]} />

                            <View style={styles.header}>
                                <Text style={[styles.title, { color: textColor }]}>Beğenenler</Text>
                                <TouchableOpacity onPress={handleClose}>
                                    <Ionicons name="close" size={24} color={textColor} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.list}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 20 }} />
                                ) : likes.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="heart-dislike-outline" size={60} color={subTextColor} />
                                        <Text style={[styles.emptyText, { color: subTextColor }]}>Henüz beğeni yok.</Text>
                                    </View>
                                ) : (
                                    likes.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={styles.userItem}
                                            onPress={() => handleUserPress(item.id)}
                                        >
                                            <Image
                                                source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.username}&background=800020&color=fff` }}
                                                style={styles.avatar}
                                                contentFit="cover"
                                            />
                                            <View style={styles.userInfo}>
                                                <Text style={[styles.username, { color: textColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                                                {(item.first_name || item.last_name) && (
                                                    <Text style={[styles.fullName, { color: subTextColor }]}>
                                                        {item.first_name} {item.last_name}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    container: {
        height: SCREEN_HEIGHT * 0.6,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 10
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee',
        paddingBottom: 10
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    list: {
        flex: 1
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12
    },
    userInfo: {
        flex: 1
    },
    username: {
        fontSize: 14,
        fontWeight: 'bold'
    },
    fullName: {
        fontSize: 13,
        marginTop: 2
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 60
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 15,
        fontStyle: 'italic'
    }
});
