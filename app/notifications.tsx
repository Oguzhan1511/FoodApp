import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#f0f0f0';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';

    const [excludedIds, setExcludedIds] = useState<string[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadExcludedIds();
        if (user) {
            fetchNotifications();
        }
    }, [user]);

    const loadExcludedIds = async () => {
        try {
            const saved = await AsyncStorage.getItem(`excluded_notifs_${user?.id}`);
            if (saved) setExcludedIds(JSON.parse(saved));
        } catch (e) { console.error(e); }
    };

    const saveExcludedIds = async (ids: string[]) => {
        try {
            await AsyncStorage.setItem(`excluded_notifs_${user?.id}`, JSON.stringify(ids));
        } catch (e) { console.error(e); }
    };

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('id, user_id, actor_id, type, content, post_id, is_read, created_at')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const actorIds = [...new Set(data.map(n => n.actor_id))];

                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', actorIds);

                const { data: dietitians } = await supabase
                    .from('dietitians')
                    .select('id, username, profile_picture')
                    .in('id', actorIds);

                const userMap: Record<string, any> = {};
                profiles?.forEach(p => userMap[p.id] = p);
                dietitians?.forEach(d => userMap[d.id] = { ...d, avatar_url: d.profile_picture });

                setNotifications(data
                    .map(n => ({
                        ...n,
                        actor: userMap[n.actor_id]
                    }))
                    .filter(n => !excludedIds.includes(n.id))
                );
            } else {
                setNotifications([]);
            }
        } catch (error) {
            console.error("Fetch notifications error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error("Mark as read error:", error);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error("Delete notification error:", error);
            Alert.alert("Hata", "Bildirim silinemedi.");
        }
    };

    const handleDeleteAllNotifications = async () => {
        if (!notifications || notifications.length === 0) {
            Alert.alert("Bilgi", "Silinecek bildirim bulunamadı.");
            return;
        }
        
        Alert.alert(
            "Tümünü Sil",
            "Veritabanındaki TÜM bildirimleriniz kalıcı olarak silinecek. Emin misiniz?",
            [
                { text: "Vazgeç", style: "cancel" },
                { 
                    text: "Evet, Hepsini Sil", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const notifCount = notifications.length;

                            // Tek seferde user_id ile sil
                            const { error: bulkError, count } = await supabase
                                .from('notifications')
                                .delete({ count: 'exact' })
                                .eq('user_id', user?.id);

                            if (bulkError) throw bulkError;

                            // Silme gerçekten oldu mu doğrula
                            if (count === 0 && notifCount > 0) {
                                // RLS engelliyor olabilir — tekil silmeyi dene
                                const ids = notifications.map(n => n.id);
                                for (const id of ids) {
                                    await supabase.from('notifications').delete().eq('id', id);
                                }
                            }
                            
                            // Clear Local State & Storage
                            await AsyncStorage.removeItem(`excluded_notifs_${user?.id}`);
                            setExcludedIds([]);
                            setNotifications([]);
                            
                            Alert.alert("Başarılı", `Bildirimler temizlendi.`);
                        } catch (error: any) {
                            console.error("Full Wipe Error:", error);
                            setNotifications([]);
                            Alert.alert("Hata", "Veritabanı silme işlemi başarısız oldu. Lütfen RLS ayarlarını kontrol edin.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleFriendRequestAction = async (actorId: string, notificationId: string, action: 'accept' | 'reject') => {
        try {
            const { data: follow, error: findError } = await supabase
                .from('user_follows')
                .select('id')
                .eq('follower_id', actorId)
                .eq('following_id', user?.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (findError) throw findError;

            if (action === 'accept') {
                if (!follow) {
                    Alert.alert("Bilgi", "Bu takip isteği artık mevcut değil.");
                    handleMarkAsRead(notificationId);
                    return;
                }

                const { error: updateError } = await supabase
                    .from('user_follows')
                    .update({ status: 'accepted' })
                    .eq('id', follow.id);

                if (updateError) throw updateError;

                // Create acceptance notification for the requester
                await supabase.from('notifications').insert([{
                    user_id: actorId,
                    actor_id: user?.id,
                    type: 'friend_accept',
                    content: 'accept_request'
                }]);

                const { data: actorProfile } = await supabase.from('profiles').select('is_private, username').eq('id', actorId).single();
                
                // Zaten takip ediyor mu veya istek atmış mı kontrol et
                const { data: existingFollowData } = await supabase
                    .from('user_follows')
                    .select('id')
                    .eq('follower_id', user?.id)
                    .eq('following_id', actorId)
                    .maybeSingle();

                if (existingFollowData) {
                    Alert.alert("Başarılı", "İstek kabul edildi.");
                } else {
                    Alert.alert(
                        "İstek Kabul Edildi",
                        `@${actorProfile?.username || 'Kullanıcı'} artık sizi takip ediyor. Siz de onu takip etmek ister misiniz?`,
                        [
                            { text: "Hayır", style: "cancel" },
                            {
                                text: "Sen de Takip Et",
                                onPress: async () => {
                                    const isPublic = !actorProfile?.is_private;
                                    await supabase.from('user_follows').insert([{
                                        follower_id: user?.id,
                                        following_id: actorId,
                                        status: isPublic ? 'accepted' : 'pending'
                                    }]);
                                    
                                    await supabase.from('notifications').insert([{
                                        user_id: actorId,
                                        actor_id: user?.id,
                                        type: isPublic ? 'friend_accept' : 'friend_request',
                                        content: isPublic ? 'direct_follow' : null
                                    }]);
                                    
                                    Alert.alert("Başarılı", isPublic ? "Kullanıcıyı takip etmeye başladınız." : "Takip isteği gönderildi.");
                                }
                            }
                        ]
                    );
                }
            } else {
                if (follow) {
                    await supabase
                        .from('user_follows')
                        .delete()
                        .eq('id', follow.id);
                }
                Alert.alert("Bilgi", "İstek reddedildi.");
            }

            // Always mark notification as read and update UI
            handleMarkAsRead(notificationId);
            // Optionally remove from list if requested, but marking as read is safer
        } catch (error) {
            console.error("Friend action error:", error);
            Alert.alert("Hata", "İşlem gerçekleştirilemedi.");
        }
    };

    const renderNotification = ({ item }: { item: any }) => {
        const getIcon = () => {
            switch (item.type) {
                case 'friend_request': return 'person-add';
                case 'friend_accept': return 'people';
                case 'like':
                case 'comment_like': return 'heart';
                case 'comment':
                case 'comment_reply': return 'chatbubble';
                default: return 'notifications';
            }
        };

        const getMessage = () => {
            const username = item.actor?.username || 'Bir kullanıcı';
            switch (item.type) {
                case 'friend_request': return `@${username} seni takip etmek istiyor.`;
                case 'friend_accept': 
                    return item.content === 'direct_follow' 
                        ? `@${username} seni takip etmeye başladı.` 
                        : `@${username} takip isteğini kabul etti!`;
                case 'like': return `@${username} senin bir gönderini beğendi.`;
                case 'comment': return `@${username} bir gönderine yorum yaptı: "${item.content?.substring(0, 30)}${item.content?.length > 30 ? '...' : ''}"`;
                case 'comment_like': return `@${username} senin bir yorumunu beğendi.`;
                case 'comment_reply': return `@${username} senin yorumuna yanıt verdi: "${item.content?.substring(0, 30)}${item.content?.length > 30 ? '...' : ''}"`;
                default: return 'Yeni bir bildiriminiz var.';
            }
        };

        const handlePress = () => {
            handleMarkAsRead(item.id);
            if (item.type === 'friend_request' || item.type === 'friend_accept') {
                router.push({ pathname: '/user-profile' as any, params: { userId: item.actor_id } });
            } else if (item.post_id) {
                router.push({ pathname: '/post-detail' as any, params: { postId: item.post_id } });
            }
        };

        const renderRightActions = (progress: any, dragX: any) => {
            const trans = dragX.interpolate({
                inputRange: [-80, 0],
                outputRange: [0, 80],
                extrapolate: 'clamp',
            });
            return (
                <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: '#ff3b30' }]}
                    onPress={() => handleDeleteNotification(item.id)}
                >
                    <Animated.View style={{ transform: [{ translateX: trans }] }}>
                        <Ionicons name="trash" size={24} color="#fff" />
                    </Animated.View>
                </TouchableOpacity>
            );
        };

        return (
            <Swipeable
                renderRightActions={renderRightActions}
                friction={2}
                rightThreshold={40}
            >
                <TouchableOpacity
                    style={[
                        styles.notificationItem,
                        { borderBottomColor: borderColor, backgroundColor: item.is_read ? bgColor : (isDark ? '#1a1a1a' : '#fff5f5') }
                    ]}
                    onPress={handlePress}
                >
                    <View style={styles.actorAvatarContainer}>
                        <Image
                            source={{ uri: item.actor?.avatar_url || `https://ui-avatars.com/api/?name=${item.actor?.username || 'U'}&background=800020&color=fff` }}
                            style={styles.actorAvatar}
                            contentFit="cover"
                        />
                        <View style={[styles.iconBadge, { backgroundColor: primaryColor }]}>
                            <Ionicons name={getIcon()} size={12} color="#fff" />
                        </View>
                    </View>
                    <View style={styles.notificationContent}>
                        <Text style={[styles.notificationText, { color: textColor }]}>
                            {getMessage()}
                        </Text>
                        <Text style={[styles.notificationDate, { color: subTextColor }]}>
                            {new Date(item.created_at).toLocaleString('tr-TR')}
                        </Text>

                        {item.type === 'friend_request' && !item.is_read && (
                            <View style={styles.actionButtonsContainer}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.acceptButton]}
                                    onPress={() => handleFriendRequestAction(item.actor_id, item.id, 'accept')}
                                >
                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.rejectButton]}
                                    onPress={() => handleFriendRequestAction(item.actor_id, item.id, 'reject')}
                                >
                                    <Ionicons name="close" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: primaryColor }]} />}
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={26} color={primaryColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Bildirimler</Text>
                <TouchableOpacity 
                    onPress={handleDeleteAllNotifications}
                    disabled={notifications.length === 0}
                    style={{ opacity: notifications.length === 0 ? 0 : 1 }}
                >
                    <Ionicons name="trash-outline" size={24} color={primaryColor} />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotification}
                    keyExtractor={item => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={60} color={subTextColor} />
                            <Text style={[styles.emptyText, { color: subTextColor }]}>Henüz bir bildirim yok.</Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: 0.5,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    notificationItem: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
        borderBottomWidth: 0.5,
    },
    actorAvatarContainer: { position: 'relative' },
    actorAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0' },
    iconBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    notificationContent: { flex: 1, marginLeft: 15 },
    notificationText: { fontSize: 14, lineHeight: 20 },
    notificationDate: { fontSize: 12, marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 15, fontSize: 16 },
    actionButtonsContainer: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 12,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    acceptButton: {
        backgroundColor: '#4CAF50',
    },
    rejectButton: {
        backgroundColor: '#ff5252',
    },
    deleteButton: {
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
