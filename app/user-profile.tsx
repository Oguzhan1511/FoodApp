import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

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
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [menuImages, setMenuImages] = useState<string[]>([]);
    const [activeMenuIndex, setActiveMenuIndex] = useState(0);
    const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const [isEligibleToRate, setIsEligibleToRate] = useState(false);
    const [submittingRating, setSubmittingRating] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const allBadges = [
        { id: 'first_log', name: 'İlk Adım', icon: 'footsteps', color: '#4CAF50', desc: 'İlk besin kaydını tamamladın!' },
        { id: 'water_master', name: 'Su Ejderhası', icon: 'water', color: '#2196F3', desc: 'Günlük su hedefini 2L üzerine çıkardın.' },
        { id: 'streak_3', name: '3 Günlük Seri', icon: 'flame', color: '#FF5722', desc: 'Üst üste 3 gün kayıt yaparak kazanılır.' },
        { id: 'early_bird', name: 'Erkenci Kuş', icon: 'sunny', color: '#FFC107', desc: 'Sabah 09:00 öncesi kahvaltı kaydı yaparak kazanılır.' },
        { id: 'macro_hero', name: 'Makro Kahramanı', icon: 'medal', color: '#9C27B0', desc: 'Tüm makro hedeflerine tam isabet tutturunca kazanılır.' }
    ];

    useEffect(() => {
        if (userId) {
            fetchProfile();
            fetchUserPosts();
            fetchStats();
            loadFeaturedBadges();
            if (userId !== currentUser?.id) {
                checkEligibility();
            }
        }
    }, [userId]);

    const checkEligibility = async () => {
        if (!currentUser || !userId) return;
        try {
            // Check if there is a message starting with DIET_PLAN::: from dietitian to user
            const { data, error } = await supabase
                .from('messages')
                .select('id')
                .eq('sender_id', userId) // dietitian
                .eq('receiver_id', currentUser.id)
                .ilike('content', 'DIET_PLAN:::%')
                .limit(1);
            
            if (data && data.length > 0) {
                setIsEligibleToRate(true);
            } else {
                // Also check if user is the dietitian themselves
                setIsEligibleToRate(false);
            }
        } catch (e) {
            console.error("Eligibility check error:", e);
        }
    };

    const loadFeaturedBadges = async () => {
        try {
            const stored = await AsyncStorage.getItem(`featuredBadges_${userId}`);
            if (stored) setFeaturedBadges(JSON.parse(stored));
            else setFeaturedBadges([]);
        } catch (e) { console.error(e); }
    };

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

    const fetchMenuImage = async (freshBusinessData?: any) => {
        const bizData = freshBusinessData || profile?.businessData;
        const menuUrlRaw = bizData?.menu_url;
        
        console.log("--- Menu Fetch Start ---");
        console.log("Raw Menu Data from DB:", menuUrlRaw);
        
        if (!menuUrlRaw) {
            setMenuImages([]);
            return;
        }

        try {
            // Eğer veri JSON formatındaysa (yeni çoklu yapı)
            if (typeof menuUrlRaw === 'string' && menuUrlRaw.startsWith('[')) {
                const urls = JSON.parse(menuUrlRaw);
                setMenuImages(urls);
            } else {
                // Eski tekli yapı ise
                setMenuImages([menuUrlRaw]);
            }
        } catch (e) {
            console.log("Menu parse error, using as single:", e);
            setMenuImages([menuUrlRaw]);
        }
    };

    useEffect(() => {
        if (showMenuModal) {
            console.log("Menu modal opened, refreshing profile...");
            fetchProfile().then((freshProfile) => {
                if (freshProfile?.businessData) {
                    fetchMenuImage(freshProfile.businessData);
                } else {
                    fetchMenuImage();
                }
            });
        }
    }, [showMenuModal]);

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
                // Puanlama verilerini çek
                const { data: ratingsData } = await supabase
                    .from('dietitian_ratings')
                    .select('rating')
                    .eq('dietitian_id', userId);
                
                const count = ratingsData?.length || 0;
                const avg = count > 0 
                    ? (ratingsData!.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1) 
                    : '5.0';

                const newProfile = { 
                    ...dietitian, 
                    role: 'dietitian',
                    average_rating: avg,
                    rating_count: count
                };

                // Sponsorluysa gösterimi artır
                if (userId !== currentUser?.id && dietitian.is_sponsored) {
                    supabase.from('dietitians')
                        .update({ sponsor_views: (dietitian.sponsor_views || 0) + 1 })
                        .eq('id', userId)
                        .then();
                }

                setProfile(newProfile);
                return newProfile;
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
                    const newProfile = { ...userData, role: 'user', businessData };

                    // Sponsorluysa gösterimi artır
                    if (userId !== currentUser?.id && userData.is_sponsored) {
                        supabase.from('profiles')
                            .update({ sponsor_views: (userData.sponsor_views || 0) + 1 })
                            .eq('id', userId)
                            .then();
                    }

                    setProfile(newProfile);
                    return newProfile;
                }
            }
            return null;
        } catch (error) {
            console.log("Profile error:", error);
            return null;
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

    const submitRating = async () => {
        if (ratingValue === 0) {
            Alert.alert("Uyarı", "Lütfen bir puan seçin.");
            return;
        }
        
        setSubmittingRating(true);
        try {
            const { error } = await supabase.from('dietitian_ratings').upsert({
                dietitian_id: userId,
                user_id: currentUser?.id,
                rating: ratingValue,
                created_at: new Date().toISOString()
            }, { 
                onConflict: 'user_id,dietitian_id' 
            });

            if (error) throw error;

            Alert.alert("Başarılı", "Değerlendirmeniz iletildi.");
            setShowRatingModal(false);
            setRatingValue(0);
            fetchProfile(); // Verileri anlık güncelle
        } catch (e: any) {
            console.error("Rating error:", e);
            Alert.alert("Hata", "Puan kaydedilirken bir sorun oluştu.");
        } finally {
            setSubmittingRating(false);
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

    const isPrivateHidden = profile?.is_private && relationship !== 'following' && relationship !== 'friend' && profile?.role !== 'dietitian';

    const handleStatPress = (type: 'followers' | 'following') => {
        // Gizli değilse veya takip ediyorsak görebiliriz
        const canView = !isPrivateHidden || (relationship as string) === 'friend' || (relationship as string) === 'following' || profile?.role === 'dietitian';

        if (canView && userId) {
            router.push({
                pathname: '/follow-list' as any,
                params: { type, userId: userId }
            });
        } else if (!canView) {
            Alert.alert("Gizli Profil", "Takipçileri görmek için bu kullanıcıyı takip etmelisiniz.");
        }
    };

    const renderEmpty = () => {
        if (isPrivateHidden) {
            return (
                <View style={styles.privateProfileContainer}>
                    <Ionicons name="lock-closed-outline" size={50} color={subTextColor} />
                    <Text style={[styles.privateProfileText, { color: textColor }]}>Bu hesap gizli</Text>
                    <Text style={[styles.privateProfileSubText, { color: subTextColor }]}>
                        Fotoğraflarını ve videolarını görmek için bu hesabı takip et.
                    </Text>
                </View>
            );
        }
        return (
            <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: subTextColor }]}>Henüz gönderi yok.</Text>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={{ backgroundColor: bgColor }}>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.fullName, { color: textColor }]}>
                                {userId === currentUser?.id ? `${currentUser?.ad} ${currentUser?.soyad}` : `${profile?.ad || profile?.first_name || ''} ${profile?.soyad || profile?.last_name || ''}`.trim()}
                            </Text>
                            {profile?.role === 'dietitian' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 193, 7, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                    <Ionicons name="star" size={14} color="#FFC107" />
                                    <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: 'bold', color: '#FFC107' }}>
                                        {profile?.average_rating || '5.0'} ({profile?.rating_count || 0} değerlendirme)
                                    </Text>
                                </View>
                                </View>
                            )}
                        </View>
                        
                        {profile?.role === 'dietitian' && userId !== currentUser?.id && (
                            <TouchableOpacity 
                                style={{ padding: 8, alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => setShowRatingModal(true)}
                            >
                                <Ionicons name="star-outline" size={22} color={primaryColor} />
                                <Text style={{ fontSize: 9, color: primaryColor, textAlign: 'center', marginTop: 2, fontWeight: '600' }}>Puan Ver</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {profile?.role === 'dietitian' ? (
                        <View style={{ marginTop: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <Ionicons name="location-outline" size={14} color={subTextColor} style={{ marginRight: 4 }} />
                                <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.location}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <Ionicons name="medal-outline" size={14} color={subTextColor} style={{ marginRight: 4 }} />
                                <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.specialty} | {profile?.experience} yıl tecrübe</Text>
                            </View>
                            <Text style={[styles.bioText, { color: textColor, marginTop: 4, lineHeight: 20 }]}>{profile?.bio}</Text>
                        </View>
                    ) : (
                        <View>
                            <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.bio || 'Henüz biyografi eklenmemiş.'}</Text>
                            
                            {/* ROZETLER / BAŞARILAR VİTRİNİ */}
                            {featuredBadges.length > 0 ? (
                                <View style={styles.badgesContainer}>
                                    <Text style={[styles.sectionTitle, { color: textColor }]}>Öne Çıkan Başarılar</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                                        {allBadges.filter(b => featuredBadges.includes(b.id)).map((badge) => (
                                            <TouchableOpacity 
                                                key={badge.id} 
                                                style={styles.badgeItem}
                                                onPress={() => Alert.alert(badge.name, badge.desc)}
                                            >
                                                <View style={[styles.badgeIconBg, { backgroundColor: badge.color + '20' }]}>
                                                    <Ionicons name={badge.icon as any} size={24} color={badge.color} />
                                                </View>
                                                <Text style={[styles.badgeLabel, { color: subTextColor }]}>{badge.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            ) : (
                                userId === currentUser?.id && (
                                    <TouchableOpacity 
                                        style={[styles.badgesContainer, { alignItems: 'center', paddingVertical: 10 }]}
                                        onPress={() => router.push('/tracking' as any)}
                                    >
                                        <Text style={{ color: subTextColor, fontSize: 12, fontStyle: 'italic' }}>
                                            Henüz bir başarı sergilemedin. Takip sayfasından ekleyebilirsin.
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
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
                                Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Hata', 'Arama başlatılamadı.'));
                            } else {
                                Alert.alert('Bilgi', 'İşletme henüz iletişim numarası girmemiş.');
                            }
                        }}>
                            <Ionicons name="call-outline" size={18} color={primaryColor} />
                            <Text style={[styles.businessButtonText, { color: textColor }]}>İletişim</Text>
                        </TouchableOpacity>

                        {profile?.businessData?.menu_url && (
                            <TouchableOpacity style={[styles.businessButton, { backgroundColor: isDark ? '#1a1a1a' : '#fafafa', borderColor: borderColor }]} onPress={() => setShowMenuModal(true)}>
                                <Ionicons name="restaurant-outline" size={18} color={primaryColor} />
                                <Text style={[styles.businessButtonText, { color: textColor }]}>Menü</Text>
                            </TouchableOpacity>
                        )}
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
                            onPress={() => router.push({ pathname: '/chat' as any, params: { userId: userId, username: profile?.username } })}
                        >
                            <Text style={[styles.messageButtonText, { color: textColor }]}>Mesaj</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* TAB SWITCHER */}
                <View style={[styles.tabContainer, { borderTopColor: borderColor }]}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 0 && styles.activeTab]}
                        onPress={() => setActiveTab(0)}
                    >
                        <Ionicons name="grid-outline" size={24} color={activeTab === 0 ? primaryColor : subTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 1 && styles.activeTab]}
                        onPress={() => setActiveTab(1)}
                    >
                        <Ionicons name="restaurant-outline" size={26} color={activeTab === 1 ? primaryColor : subTextColor} />
                    </TouchableOpacity>
                </View>
        </View>
    );

    const filteredData = activeTab === 0 
        ? posts.filter(p => !p.is_recipe) 
        : posts.filter(p => p.is_recipe);

    const listData = isPrivateHidden ? [] : filteredData;

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

            <FlatList
                data={listData}
                keyExtractor={(item) => item.id}
                numColumns={3}
                key={activeTab} // To handle column changes if any
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.gridItem, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}
                        onPress={() => {
                            const pathname = item.is_recipe ? '/recipe-detail' : '/post-detail';
                            const params = item.is_recipe ? { recipeId: item.id, filterUserId: userId } : { postId: item.id, filterUserId: userId };
                            router.push({ pathname: pathname as any, params });
                        }}
                    >
                        <Image 
                          source={{ uri: item.image_url?.split(',')[0] }} 
                          style={styles.gridImage} 
                          contentFit="cover" 
                          transition={200} 
                        />
                        {item.image_url?.includes(',') && (
                            <View style={styles.multiImageIndicator}>
                                <Ionicons name="copy" size={14} color="#fff" />
                            </View>
                        )}
                        {item.is_recipe && (
                            <View style={styles.recipeIndicator}>
                                <Ionicons name="restaurant" size={16} color="#fff" />
                            </View>
                        )}
                        {!item.image_url && (
                          <View style={styles.placeholderContainerSmall}>
                            <Ionicons name="image-outline" size={24} color={subTextColor} />
                          </View>
                        )}
                    </TouchableOpacity>
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={5}
                removeClippedSubviews={true}
            />

            <Modal
                visible={showRatingModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowRatingModal(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.ratingContainer, { backgroundColor: bgColor }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: textColor }]}>Diyetisyeni Değerlendir</Text>
                            <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                                <Ionicons name="close" size={24} color={textColor} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRatingValue(star)}>
                                    <Ionicons 
                                        name={ratingValue >= star ? "star" : "star-outline"} 
                                        size={40} 
                                        color={ratingValue >= star ? "#FFC107" : subTextColor} 
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity 
                            style={[styles.submitRatingButton, { backgroundColor: primaryColor, marginTop: 10 }]} 
                            onPress={submitRating}
                            disabled={submittingRating || ratingValue === 0}
                        >
                            {submittingRating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitRatingText}>Puanı Gönder</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

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

            {/* Menu Modal */}
            <Modal
                visible={showMenuModal}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setShowMenuModal(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowMenuModal(false)} style={styles.modalCloseButton}>
                            <Ionicons name="close" size={30} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            İşletme Menüsü {menuImages.length > 1 ? `(${activeMenuIndex + 1}/${menuImages.length})` : ''}
                        </Text>
                        <View style={{ width: 30 }} />
                    </View>
                    
                    {menuImages.length > 0 ? (
                        <FlatList
                            data={menuImages}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                setActiveMenuIndex(index);
                            }}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item }) => (
                                <ScrollView 
                                    contentContainerStyle={{ width: width, justifyContent: 'center' }} 
                                    minimumZoomScale={1} 
                                    maximumZoomScale={3}
                                >
                                    <Image
                                        source={{ uri: item }}
                                        style={{ width: width, height: width * 1.5, alignSelf: 'center' }}
                                        contentFit="contain"
                                        cachePolicy="none"
                                        onError={(e) => console.log("Menu image render error:", e)}
                                    />
                                </ScrollView>
                            )}
                        />
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={{ color: '#fff', marginTop: 10 }}>Menü yükleniyor...</Text>
                        </View>
                    )}
                </SafeAreaView>
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
    actionButtons: { paddingHorizontal: 20, marginTop: 15, marginBottom: 20 },
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
    placeholderContainerSmall: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
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
    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    bottomSheet: { 
        width: '100%',
        backgroundColor: '#fff',
        borderTopLeftRadius: 25, 
        borderTopRightRadius: 25, 
        padding: 20, 
        paddingBottom: 40, 
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sheetTitle: { fontSize: 18, fontWeight: 'bold' },
    sheetMessage: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
    removeButton: { padding: 15, borderRadius: 10, alignItems: 'center' },
    removeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    // Badge Styles
    badgesContainer: {
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 0.5,
        borderTopColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    badgesScroll: {
        flexDirection: 'row',
    },
    badgeItem: {
        alignItems: 'center',
        marginRight: 20,
        width: 70,
    },
    badgeIconBg: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    badgeLabel: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#000'
    },
    modalCloseButton: {
        padding: 5
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    // RATING MODAL STYLES
    ratingContainer: {
        width: '92%',
        padding: 25,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    starsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginVertical: 20,
    },
    commentInput: {
        width: '100%',
        height: 100,
        borderRadius: 12,
        padding: 15,
        fontSize: 14,
        textAlignVertical: 'top',
        borderWidth: 1,
        marginBottom: 20,
    },
    submitRatingButton: {
        width: '100%',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitRatingText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    recipeIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
    multiImageIndicator: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 10,
        borderTopWidth: 0.5,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: THEME_COLOR,
    },
});
