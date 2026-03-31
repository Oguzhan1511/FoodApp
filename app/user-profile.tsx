import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Linking,
    Modal,
} from 'react-native';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from './services/supabaseConfig';

const { width } = Dimensions.get('window');
const THEME_COLOR = '#800020';

export default function UserProfileScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { user: currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#f0f0f0';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';
    const statLabelColor = isDark ? '#aaaaaa' : '#666';

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
    const [imageSource, setImageSource] = useState<string | null>(null);
    const [relationship, setRelationship] = useState<'none' | 'following' | 'friend' | 'pending'>('none');
    const [posts, setPosts] = useState<any[]>([]);
    const [showRemoveFollowerModal, setShowRemoveFollowerModal] = useState(false);

    useEffect(() => {
        if (userId) {
            fetchProfile();
            fetchUserPosts();
            fetchStats();
        }
    }, [userId]);

    useEffect(() => {
        if (userId && profile) {
            checkFollowStatus();
        }
    }, [userId, profile]); // Re-run when profile is loaded (to know role)

    useEffect(() => {
        const fetchImage = async () => {
            const url = profile?.role === 'dietitian' ? profile?.profile_picture : profile?.avatar_url;
            if (!url) {
                const avatarName = profile?.ad || profile?.first_name;
                if (avatarName) {
                    setImageSource(`https://ui-avatars.com/api/?name=${avatarName}&background=800020&color=fff`);
                } else {
                    setImageSource(null);
                }
                return;
            }

            try {
                if (url.includes('supabasestorage') || url.includes('supabase.co')) {
                    const pathParts = url.split('/avatars/');
                    if (pathParts.length > 1) {
                        const path = pathParts[pathParts.length - 1].split('?')[0];

                        // Signed URL for guaranteed access
                        const { data, error } = await supabase.storage
                            .from('avatars')
                            .createSignedUrl(path, 3600);

                        if (data?.signedUrl) {
                            setImageSource(data.signedUrl);
                            return;
                        }
                    }
                }
                setImageSource(url);
            } catch (e) {
                console.log("Image error:", e);
                setImageSource(url);
            }
        };

        if (profile) {
            fetchImage();
        }
    }, [profile]);

    const fetchProfile = async () => {
        try {
            setLoading(true);

            // 1. Try finding in dietitians
            const { data: dietitian } = await supabase
                .from('dietitians')
                .select('*')
                .eq('id', userId)
                .single();

            if (dietitian) {
                setProfile({ ...dietitian, role: 'dietitian' });
            } else {
                // 2. Try regular profile
                const { data: userData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (userData) {
                    let businessData = null;
                    if (userData.account_type === 'business') {
                        const { data: bData } = await supabase.from('business_profiles').select('*').eq('id', userId).maybeSingle();
                        if (bData) businessData = bData;
                    }
                    setProfile({ ...userData, role: 'user', businessData });
                }
            }
        } catch (error) {
            console.log("Profile error:", error);
            Alert.alert("Hata", "Kullanıcı bulunamadı.");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        // ... Same logic as profile.tsx mostly, but for 'userId' ...
        try {
            // Follower count (People following this user)
            const { count: friendCount } = await supabase
                .from('user_follows')
                .select('id', { count: 'exact', head: true })
                .eq('following_id', userId)
                .eq('status', 'accepted');
                
            // Following count (People this user follows)
            const { count: followingCount } = await supabase
                .from('user_follows')
                .select('id', { count: 'exact', head: true })
                .eq('follower_id', userId)
                .eq('status', 'accepted');

            // Followed Dietitians
            const { count: followingDietitianCount } = await supabase
                .from('dietitian_follows')
                .select('id', { count: 'exact', head: true })
                .eq('follower_id', userId);

            // Followers (if dietitian)
            let followerCount = friendCount || 0;
            const { count: dietFollowers } = await supabase
                .from('dietitian_follows')
                .select('id', { count: 'exact', head: true })
                .eq('dietitian_id', userId);

            if (dietFollowers) followerCount += dietFollowers;

            setStats(prev => ({
                ...prev,
                followers: followerCount,
                following: (followingCount || 0) + (followingDietitianCount || 0)
            }));
        } catch (error) {
            console.log("Stats error:", error);
        }
    };

    const fetchUserPosts = async () => {
        // Privacy check optimization: don't fetch if likely private and not friends
        // However, we might not know relationship yet. 
        // Better to fetch and let RLS handle it, OR handle it in UI. 
        // For now, let's fetch but handle UI hiding. 
        // Actually, if we want to be secure, RLS is best, but UI hiding is what is requested.
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setPosts(data);
                setStats(prev => ({ ...prev, posts: data.length }));
            }
        } catch (error) {
            console.log("Error fetching user posts:", error);
        }
    };

    const checkFollowStatus = async () => {
        if (!currentUser || !profile) return;

        try {
            if (profile.role === 'dietitian') {
                const { data, error } = await supabase
                    .from('dietitian_follows')
                    .select('*')
                    .eq('follower_id', currentUser.id)
                    .eq('dietitian_id', userId)
                    .single();

                if (data) setRelationship('following');
                else setRelationship('none');

            } else {
                // Check Following Status
                const { data, error } = await supabase
                    .from('user_follows')
                    .select('*')
                    .eq('follower_id', currentUser.id)
                    .eq('following_id', userId)
                    .single();

                if (data) {
                    if (data.status === 'accepted') setRelationship('following');
                    else if (data.status === 'pending') setRelationship('pending');
                    else setRelationship('none');
                } else {
                    setRelationship('none');
                }
            }
        } catch (error) {
            console.log("Check follow error:", error);
        }
    };

    const handleFollowAction = async () => {
        if (!currentUser || !profile) return;

        try {
            if (relationship === 'friend' || relationship === 'following' || relationship === 'pending') {
                // Unfollow / Cancel Request / Remove Friend logic
                let title = "Emin misiniz?";
                let message = "Takibi bırakmak istiyor musunuz?";

                if (relationship === 'friend') message = "Arkadaşlardan çıkarmak istiyor musunuz?";
                else if (relationship === 'pending') message = "Arkadaşlık isteğini geri çekmek istiyor musunuz?";

                Alert.alert(
                    title,
                    message,
                    [
                        { text: "Vazgeç", style: "cancel" },
                        {
                            text: "Evet",
                            style: 'destructive',
                            onPress: async () => {
                                if (profile.role === 'dietitian') {
                                    await supabase.from('dietitian_follows').delete().eq('follower_id', currentUser.id).eq('dietitian_id', userId);
                                } else {
                                    await supabase.from('user_follows')
                                        .delete()
                                        .eq('follower_id', currentUser.id)
                                        .eq('following_id', userId);

                                    // Handle unfollow or cancel request
                                    // Optionally delete the notification if it was pending
                                    if (relationship === 'pending') {
                                        await supabase.from('notifications')
                                            .delete()
                                            .eq('actor_id', currentUser.id)
                                            .eq('user_id', userId)
                                            .eq('type', 'follow_request');
                                        
                                        setRelationship('none');
                                        fetchStats(); // refresh stats
                                    } else {
                                        const oldRel = relationship;
                                        setRelationship('none');
                                        fetchStats(); // refresh stats

                                        // Only prompt to remove follower if we were actually following them
                                        if (oldRel === 'following' || oldRel === 'friend') {
                                            const { data: theyFollowMe } = await supabase
                                                .from('user_follows')
                                                .select('id')
                                                .eq('follower_id', userId)
                                                .eq('following_id', currentUser.id)
                                                .eq('status', 'accepted')
                                                .maybeSingle();

                                            if (theyFollowMe) {
                                                setShowRemoveFollowerModal(true);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ]
                );
                return;
            }

            // Follow / Add Friend logic
            if (profile.role === 'dietitian') {
                const { error } = await supabase.from('dietitian_follows').insert([{ follower_id: currentUser.id, dietitian_id: userId }]);
                if (error) throw error;
                setRelationship('following');
            } else {
                const isPublic = !profile.is_private;
                const newStatus = isPublic ? 'accepted' : 'pending';
                // Veritabanı CHECK kısıtlamasına (notifications_type_check) takılmamak için eski tipleri kullanıyoruz.
                const notifType = isPublic ? 'friend_accept' : 'friend_request';

                const { error } = await supabase.from('user_follows').insert([{ 
                    follower_id: currentUser.id, 
                    following_id: userId, 
                    status: newStatus 
                }]);
                if (error) throw error;

                // Trigger Notification
                const { error: notifError } = await supabase.from('notifications').insert([{
                    user_id: userId,
                    actor_id: currentUser.id,
                    type: notifType,
                    content: isPublic ? 'direct_follow' : null
                }]);
                
                if (notifError) {
                    console.error("NOTIF ERROR:", notifError);
                    Alert.alert("Bildirim Hatası", notifError.message);
                }

                setRelationship(isPublic ? 'following' : 'pending');
                Alert.alert("Başarılı", isPublic ? "Kullanıcıyı takip etmeye başladınız." : "Takip isteği gönderildi.");
            }
            fetchStats();

        } catch (error) {
            console.log("Action error:", error);
            Alert.alert("Hata", "İşlem gerçekleştirilemedi.");
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={THEME_COLOR} />
            </View>
        );
    }

    const getButtonText = () => {
        switch (relationship) {
            case 'friend': return 'Arkadaşsınız';
            case 'following': return 'Takip Ediliyor';
            case 'pending': return 'İstek Gönderildi';
            default: return 'Takip Et';
        }
    };

    const getButtonColor = () => {
        return relationship === 'none' ? THEME_COLOR : '#ccc';
    };

    const handleRemoveFollower = async () => {
        try {
            await supabase
                .from('user_follows')
                .delete()
                .eq('follower_id', userId)
                .eq('following_id', currentUser?.id);
            fetchStats();
            setShowRemoveFollowerModal(false);
            Alert.alert("Başarılı", "Kullanıcı takipçilerinizden çıkarıldı.");
        } catch (error) {
            console.error("Remove follower error", error);
        }
    };

    const getButtonTextColor = () => {
        return relationship === 'none' ? '#fff' : '#333';
    };

    const handleStatPress = (type: 'followers' | 'following') => {
        const canView = profile?.role === 'dietitian' || relationship === 'friend';

        if (canView) {
            router.push({
                pathname: '/follow-list',
                params: { type, userId: userId }
            });
        } else {
            Alert.alert("Gizli Profil", "Takipçileri görmek için arkadaş olmalısınız.");
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={[styles.header, { backgroundColor: bgColor, borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={26} color={primaryColor} />
                </TouchableOpacity>
                <Text style={[styles.headerUsername, { color: textColor }]}>
                    {userId === currentUser?.id ? 'Senin Profilin' : (profile?.username ? profile.username.replace(/^@/, '') : 'Profil')}
                </Text>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: bgColor }}>
                <View style={[styles.profileInfoContainer, { backgroundColor: bgColor }]}>
                    <Image
                        source={imageSource}
                        style={styles.avatar}
                        contentFit="cover"
                        transition={500}
                    />

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.posts}</Text>
                            <Text style={[styles.statLabel, { color: statLabelColor }]}>Gönderi</Text>
                        </View>

                        <TouchableOpacity style={styles.statItem} onPress={() => handleStatPress('followers')}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.followers}</Text>
                            <Text style={[styles.statLabel, { color: statLabelColor }]}>Takipçi</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.statItem} onPress={() => handleStatPress('following')}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.following}</Text>
                            <Text style={[styles.statLabel, { color: statLabelColor }]}>Takip</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.bioContainer}>
                    <Text style={[styles.fullName, { color: textColor }]}>
                        {userId === currentUser?.id ? `${currentUser?.ad} ${currentUser?.soyad}` : `${profile?.ad || profile?.first_name || ''} ${profile?.soyad || profile?.last_name || ''}`.trim()}
                    </Text>
                    {profile?.role === 'dietitian' ? (
                        <View>
                            <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.location}</Text>
                            <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.specialty} | {profile?.experience} yıl</Text>
                            <Text style={[styles.bioText, { color: subTextColor, marginTop: 5 }]}>{profile?.bio}</Text>
                        </View>
                    ) : (
                        <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.bio || 'Henüz biyografi eklenmemiş.'}</Text>
                    )}
                </View>

                {profile?.account_type === 'business' && (
                    <View style={styles.businessButtonsContainer}>
                        <TouchableOpacity style={[styles.businessButton, { backgroundColor: isDark ? '#1a1a1a' : '#fafafa', borderColor: borderColor }]} onPress={() => {
                            const address = profile?.businessData?.address;
                            if (address) {
                                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                                Linking.openURL(url).catch(() => Alert.alert('Hata', 'Harita uygulaması açılamadı.'));
                            } else {
                                Alert.alert('Bilgi', 'İşletme henüz adres bilgisi girmemiş.');
                            }
                        }}>
                            <Ionicons name="location-outline" size={18} color={primaryColor} />
                            <Text style={[styles.businessButtonText, { color: textColor }]}>Yol Tarifi</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.businessButton, { backgroundColor: isDark ? '#1a1a1a' : '#fafafa', borderColor: borderColor }]} onPress={() => {
                            const phone = profile?.businessData?.phone_number;
                            if (phone) {
                                // Sometimes phones need cleaning but let's just pass it
                                Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Hata', 'Arama başlatılamadı.'));
                            } else {
                                Alert.alert('Bilgi', 'İşletme henüz iletişim numarası girmemiş.');
                            }
                        }}>
                            <Ionicons name="call-outline" size={18} color={primaryColor} />
                            <Text style={[styles.businessButtonText, { color: textColor }]}>İletişim</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[styles.followButton, { backgroundColor: getButtonColor(), borderColor: primaryColor }]}
                        onPress={handleFollowAction}
                    >
                        <Text style={[styles.buttonText, { color: getButtonTextColor() }]}>{getButtonText()}</Text>
                    </TouchableOpacity>

                    {/* Eğer takıpleşiyorlarsa mesaj butonu göster */}
                    {(relationship === 'friend' || relationship === 'following') && (
                        <TouchableOpacity
                            style={[styles.messageButton, { borderColor: borderColor }]}
                            onPress={() => router.push({ pathname: '/chat', params: { userId: userId, username: profile?.username } })}
                        >
                            <Text style={[styles.messageButtonText, { color: textColor }]}>Mesaj</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.postsGrid}>
                    {/* Gizli Profil Logic */}
                    {(profile?.is_private && relationship !== 'following' && relationship !== 'friend' && profile?.role !== 'dietitian') ? (
                        <View style={styles.privateProfileContainer}>
                            <Ionicons name="lock-closed-outline" size={50} color={subTextColor} />
                            <Text style={[styles.privateProfileText, { color: textColor }]}>Bu hesap gizli</Text>
                            <Text style={[styles.privateProfileSubText, { color: subTextColor }]}>
                                Fotoğraflarını ve videolarını görmek için bu hesabı takip et.
                            </Text>
                        </View>
                    ) : (
                        posts.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: subTextColor }]}>Henüz gönderi yok.</Text>
                            </View>
                        ) : (
                            posts.map((post) => (
                                <TouchableOpacity
                                    key={post.id}
                                    style={styles.gridItem}
                                    onPress={() => router.push({ pathname: "/post-detail", params: { postId: post.id } })}
                                >
                                    <Image source={{ uri: post.image_url }} style={styles.gridImage} contentFit="cover" />
                                </TouchableOpacity>
                            ))
                        )
                    )}
                </View>
            </ScrollView>

            {/* Remove Follower Modal */}
            <Modal
                visible={showRemoveFollowerModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowRemoveFollowerModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.bottomSheet, { backgroundColor: bgColor }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: textColor }]}>Takipçiyi Çıkar</Text>
                            <TouchableOpacity onPress={() => setShowRemoveFollowerModal(false)}>
                                <Ionicons name="close" size={24} color={textColor} />
                            </TouchableOpacity>
                        </View>
                            {profile?.username ? profile.username.replace(/^@/, '') : 'Kullanıcı'} sizi takip etmeye devam ediyor. Onu takipçilerinizden de çıkarmak ister misiniz?
                        <TouchableOpacity style={[styles.removeButton, { backgroundColor: '#ff3b30' }]} onPress={handleRemoveFollower}>
                            <Text style={styles.removeButtonText}>Takipten Çıkar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#f0f0f0'
    },
    headerUsername: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    profileInfoContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0' },
    statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 20 },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    statLabel: { fontSize: 12, color: '#666' },
    bioContainer: { paddingHorizontal: 20, marginTop: 5 },
    fullName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    bioText: { fontSize: 14, color: '#444', lineHeight: 20 },
    actionButtons: { paddingHorizontal: 20, marginTop: 15 },
    followButton: { backgroundColor: THEME_COLOR, padding: 12, borderRadius: 10, alignItems: 'center' },
    followButtonText: { fontWeight: 'bold', color: '#fff' },
    businessButtonsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 15,
        justifyContent: 'space-between',
        gap: 10
    },
    businessButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    businessButtonText: {
        marginLeft: 6,
        fontWeight: 'bold',
        fontSize: 14
    },
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingBottom: 40 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 14 },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 20,
    },
    gridItem: {
        width: width / 3,
        height: width / 3,
        borderColor: '#fff',
        borderWidth: 1,
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    privateIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    privateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    privateText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        maxWidth: '80%',
    },
    buttonText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    messageButton: {
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
    },
    messageButtonText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    privateProfileContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 50,
    },
    privateProfileText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
    },
    privateProfileSubText: {
        fontSize: 14,
        marginTop: 5,
        textAlign: 'center',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#333' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sheetTitle: { fontSize: 18, fontWeight: 'bold' },
    sheetMessage: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
    removeButton: { padding: 15, borderRadius: 10, alignItems: 'center' },
    removeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
