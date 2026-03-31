import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
    View,
    TextInput,
    Alert
} from 'react-native';
import { useAuth } from '../app/AuthContext';
import { supabase } from '../app/services/supabaseConfig';
import { useTheme } from '../app/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ShareBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    postId: string;
}

export default function ShareBottomSheet({ isVisible, onClose, postId }: ShareBottomSheetProps) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [friends, setFriends] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sendingTo, setSendingTo] = useState<string | null>(null);

    // Theme Colors
    const bgColor = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const inputBg = isDark ? '#2a2a2a' : '#f5f5f5';
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
            if (user) {
                fetchFriendsAndGroups(user.id);
            }
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true
            }).start();
            setSearchQuery('');
        }
    }, [isVisible, user]);

    const fetchFriendsAndGroups = async (currentUid: string) => {
        setLoading(true);
        try {
            // Fetch Groups
            const { data: groupData } = await supabase
                .from('group_members')
                .select('group:group_id(*)')
                .eq('user_id', currentUid);

            if (groupData) {
                const rawGroups = groupData.map((item: any) => item.group);
                const uniqueGroups = Array.from(new Map(rawGroups.map((g: any) => [g.id, g])).values());
                setGroups(uniqueGroups);
            }

            // Fetch Friends
            const { data: friendData } = await supabase
                .from('friendships')
                .select(`
                    requester:requester(id, username, ad, soyad, avatar_url),
                    receiver:receiver(id, username, ad, soyad, avatar_url)
                `)
                .eq('status', 'accepted')
                .or(`requester.eq.${currentUid},receiver.eq.${currentUid}`);

            if (friendData) {
                const formatted = friendData.map((rel: any) =>
                    rel.requester.id === currentUid ? rel.receiver : rel.requester
                );
                setFriends(formatted);
            }
        } catch (error) {
            console.error("Fetch friends error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (targetId: string, isGroup: boolean) => {
        if (!user || !postId) return;

        setSendingTo(targetId);
        try {
            const payload: any = {
                sender_id: user.id,
                content: `POST_SHARE:::${postId}`
            };

            if (isGroup) {
                payload.group_id = targetId;
            } else {
                payload.receiver_id = targetId;
            }

            const { error } = await supabase.from('messages').insert(payload);

            if (error) throw error;
            
            // Başarılı olduğunda geri bildirim ver ve kapat
            Alert.alert("Başarılı", "Gönderi paylaşıldı!", [
                { text: "Tamam", onPress: handleClose }
            ]);

        } catch (error) {
            console.error("Gönderi paylaşım hatası: ", error);
            Alert.alert("Hata", "Gönderi paylaşılamadı.");
        } finally {
            setSendingTo(null);
        }
    };

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true
        }).start(() => onClose());
    };

    // MERGE & FILTER
    const combinedList = [
        ...groups.map(g => ({ type: 'group', id: g.id, name: g.name, username: null, data: g })),
        ...friends.map(f => ({ type: 'friend', id: f.id, name: `${f.ad || ''} ${f.soyad || ''}`.trim() || f.username, username: f.username, data: f }))
    ];

    const filteredList = combinedList.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
                                <Text style={[styles.title, { color: textColor }]}>Paylaş</Text>
                                <TouchableOpacity onPress={handleClose}>
                                    <Ionicons name="close" size={24} color={textColor} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchContainer}>
                                <TextInput
                                    style={[styles.searchInput, { backgroundColor: inputBg, color: textColor }]}
                                    placeholder="Ara..."
                                    placeholderTextColor={subTextColor}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            <ScrollView
                                style={styles.listContainer}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 20 }} />
                                ) : filteredList.length === 0 ? (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
                                        <Text style={{ color: subTextColor, fontStyle: 'italic' }}>Sonuç bulunamadı.</Text>
                                    </View>
                                ) : (
                                    filteredList.map((item) => {
                                        const isGroup = item.type === 'group';
                                        const avatarUrl = isGroup ? null : item.data.avatar_url;
                                        const defaultImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff`;

                                        return (
                                            <View key={`${item.type}-${item.id}`} style={styles.listItem}>
                                                <View style={styles.userInfo}>
                                                    <Image
                                                        source={{ uri: avatarUrl || defaultImage }}
                                                        style={styles.avatar}
                                                        contentFit="cover"
                                                    />
                                                    <View>
                                                        <Text style={[styles.userName, { color: textColor }]}>{item.name}</Text>
                                                        {!isGroup && item.username && (
                                                            <Text style={[styles.userHandle, { color: subTextColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                                                        )}
                                                    </View>
                                                </View>

                                                <TouchableOpacity
                                                    style={[styles.sendBtn, { backgroundColor: primaryColor }]}
                                                    onPress={() => handleSend(item.id, isGroup)}
                                                    disabled={sendingTo === item.id}
                                                >
                                                    {sendingTo === item.id ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Text style={styles.sendBtnText}>Gönder</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })
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
        height: SCREEN_HEIGHT * 0.75,
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
        marginBottom: 15
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    searchContainer: {
        marginBottom: 15
    },
    searchInput: {
        padding: 10,
        borderRadius: 10,
        fontSize: 15
    },
    listContainer: {
        flex: 1
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: '#ddd'
    },
    userName: {
        fontSize: 15,
        fontWeight: 'bold'
    },
    userHandle: {
        fontSize: 13,
        marginTop: 2
    },
    sendBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center'
    },
    sendBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13
    }
});
