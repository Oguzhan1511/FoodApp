import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    SafeAreaView,
    ScrollView,
    FlatList,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/firebaseConfig';
import { supabase } from '../../services/supabaseConfig';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');
const THEME_COLOR = '#800020';
const IMAGE_SIZE = width / 3;

export default function ProfileScreen() {
    const router = useRouter();
    const { user: contextUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    // Theme Colors
    const isDark = theme === 'dark';
    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#f0f0f0';
    const modalBg = isDark ? '#1e1e1e' : '#ffffff';

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
    const [activeTab, setActiveTab] = useState(0);
    const [imageSource, setImageSource] = useState<string | null>(null);
    const [postsData, setPostsData] = useState<any[]>([]);
    const [recipes, setRecipes] = useState<any[]>([]); // Renamed from savedPosts
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [settingsView, setSettingsView] = useState<'main' | 'privacy' | 'general'>('main');
    const [isPrivate, setIsPrivate] = useState(false);
    const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);
    const slideAnim = React.useRef(new Animated.Value(width)).current;

    const allBadges = [
        { id: 'first_log', name: 'İlk Adım', icon: 'footsteps', color: '#4CAF50', desc: 'İlk besin kaydını tamamladın!' },
        { id: 'water_master', name: 'Su Ejderhası', icon: 'water', color: '#2196F3', desc: 'Günlük su hedefini 2L üzerine çıkardın.' },
        { id: 'streak_3', name: '3 Günlük Seri', icon: 'flame', color: '#FF5722', desc: 'Üst üste 3 gün kayıt yaparak kazanılır.' },
        { id: 'early_bird', name: 'Erkenci Kuş', icon: 'sunny', color: '#FFC107', desc: 'Sabah 09:00 öncesi kahvaltı kaydı yaparak kazanılır.' },
        { id: 'macro_hero', name: 'Makro Kahramanı', icon: 'medal', color: '#9C27B0', desc: 'Tüm makro hedeflerine tam isabet tutturunca kazanılır.' }
    ];

    const openSettings = () => {
        setSettingsVisible(true);
        setSettingsView('main');

        Animated.timing(slideAnim, {
            toValue: 0, // Slide to 0 (covering 100% of screen)
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeSettings = () => {
        Animated.timing(slideAnim, {
            toValue: width,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setSettingsVisible(false);
        });
    };

    useEffect(() => {
        const fetchImage = async () => {
            // Priority: contextUser -> profile
            const url = contextUser?.avatar_url || (profile?.role === 'dietitian' ? profile?.profile_picture : profile?.avatar_url);

            if (!url) {
                // Daha güçlü bir isim belirleme mantığı (fallback zinciri)
                const nameForAvatar = contextUser?.ad || profile?.ad || profile?.first_name || contextUser?.username || profile?.username || 'User';
                setImageSource(`https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&background=800020&color=fff&size=256`);
                return;
            }

            try {
                // If it is a supabase storage URL, try to generate a signed URL
                if (url.includes('supabasestorage') || url.includes('supabase.co')) {
                    // Extract path after 'avatars/'
                    const pathParts = url.split('/avatars/');
                    if (pathParts.length > 1) {
                        const path = pathParts[pathParts.length - 1].split('?')[0];

                        // Create Signed URL (valid for 1 hour)
                        const { data, error } = await supabase.storage
                            .from('avatars')
                            .createSignedUrl(path, 3600); // 60 minutes

                        if (error) {
                            console.log("Signed URL error, reusing original:", error.message);
                            setImageSource(url);
                            return;
                        }

                        if (data?.signedUrl) {
                            console.log("Using Signed URL:", data.signedUrl);
                            setImageSource(data.signedUrl);
                            return;
                        }
                    }
                }

                // Fallback
                console.log("Using Fallback/Original URL:", url);
                setImageSource(url);

            } catch (e) {
                console.log("Unexpected image error:", e);
                setImageSource(url);
            }
        };

        if (profile) {
            setIsPrivate(profile.is_private || false);
            fetchImage();
        }
    }, [profile, contextUser?.avatar_url]);


    useFocusEffect(
        useCallback(() => {
            if (contextUser?.id) {
                // Her şeyi paralel başlat
                Promise.all([
                    fetchProfile(),
                    fetchStats(contextUser.id),
                    fetchPosts(contextUser.id),
                    fetchRecipes(contextUser.id),
                    loadFeaturedBadges(contextUser.id)
                ]);
            } else {
                fetchProfile();
            }
        }, [contextUser?.id])
    );

    const loadFeaturedBadges = async (uid: string) => {
        try {
            const stored = await AsyncStorage.getItem(`featuredBadges_${uid}`);
            if (stored) setFeaturedBadges(JSON.parse(stored));
            else setFeaturedBadges([]);
        } catch (e) { console.error(e); }
    };

    const fetchPosts = async (uid: string) => {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('user_id', uid)
                .eq('is_recipe', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setPostsData(data);
                setStats(prev => ({ ...prev, posts: data.length }));
            }
        } catch (error) {
            console.log("Postları çekme hatası:", error);
        }
    };

    const fetchRecipes = async (uid: string) => {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('user_id', uid)
                .eq('is_recipe', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setRecipes(data);
        } catch (error) {
            console.log("Tarifleri çekme hatası:", error);
        }
    };

    const fetchStats = async (uid: string) => {
        try {
            // Tüm istatistikleri paralel çek
            const [followersRes, followingRes, dietFollowRes, dietAsFollowerRes] = await Promise.all([
                supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', uid).eq('status', 'accepted'),
                supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid).eq('status', 'accepted'),
                supabase.from('dietitian_follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
                supabase.from('dietitian_follows').select('id', { count: 'exact', head: true }).eq('dietitian_id', uid)
            ]);

            const followerCount = (followersRes.count || 0) + (dietAsFollowerRes.count || 0);
            const followingCount = (followingRes.count || 0) + (dietFollowRes.count || 0);

            setStats(prev => ({
                ...prev,
                followers: followerCount,
                following: followingCount
            }));
        } catch (err) {
            console.log("Stats fetch error:", err);
        }
    };

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            if (!user) {
                setLoading(false);
                return;
            }

            // Diyetisyen ve normal profil kontrolünü paralel yap
            const [dietitianRes, profileRes] = await Promise.all([
                supabase.from('dietitians').select('*').eq('id', user.uid).single(),
                supabase.from('profiles').select('*').eq('id', user.uid).single()
            ]);

            if (dietitianRes.data) {
                // Puanlama verilerini çek
                const { data: ratingsData } = await supabase
                    .from('dietitian_ratings')
                    .select('rating')
                    .eq('dietitian_id', user.uid);
                
                const count = ratingsData?.length || 0;
                const avg = count > 0 
                    ? (ratingsData!.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1) 
                    : '5.0';

                setProfile({ 
                    ...dietitianRes.data, 
                    role: 'dietitian',
                    rating_avg: avg,
                    rating_count: count
                });
            } else if (profileRes.data) {
                setProfile({ ...profileRes.data, role: 'user' });
            }
        } catch (error) {
            console.log("Profil çekme hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            logout();
            await auth.signOut();
            router.replace('./index');
        } catch (error: any) {
            Alert.alert("Hata", "Çıkış yapılamadı");
        }
    };

    const togglePrivacy = async (value: boolean) => {
        setIsPrivate(value);
        try {
            const table = profile?.role === 'dietitian' ? 'dietitians' : 'profiles';
            const { error } = await supabase
                .from(table)
                .update({ is_private: value })
                .eq('id', contextUser?.id);

            if (error) throw error;

            // Update local profile state as well to reflect change immediately if needed elsewhere
            setProfile((prev: any) => ({ ...prev, is_private: value }));

        } catch (error) {
            console.log("Privacy update error:", error);
            setIsPrivate(!value); // Revert on error
            Alert.alert("Hata", "Gizlilik ayarı güncellenemedi.");
        }
    };

    const handleChangeAccountType = () => {
        Alert.alert(
            "Hesap Türü",
            "Profilinizi hangi hesap türüne çevirmek istiyorsunuz?",
            [
                { text: "İptal", style: "cancel" },
                { text: "Bireysel Hesap", onPress: () => updateAccountType('personal') },
                { text: "İşletme (Ticari)", onPress: () => updateAccountType('business') },
                { text: "Diyetisyen", onPress: () => updateAccountType('dietitian') }
            ]
        );
    };

    const updateAccountType = async (type: string) => {
        if (!contextUser?.id) return;
        
        if (type === 'dietitian') {
            closeSettings();
            Alert.alert("Bilgi", "Diyetisyen hesabına geçişte diploma ve sertifika bilgilerinizi doğrulamanız gerekmektedir.", [
                { text: "Devam Et", onPress: () => router.push({ pathname: '/DietitianDetailsScreen' as any, params: { uid: contextUser.id } }) },
                { text: "Vazgeç", style: "cancel" }
            ]);
            return;
        }

        if (type === 'business') {
            closeSettings();
            Alert.alert("İşletme Hesabına Geçiş", "İşletme sayfasına geçebilmek için lütfen işletme iletişim ve adres bilgilerinizi tanımlayın.", [
                { text: "Devam Et", onPress: () => router.push({ pathname: '/edit-profile' as any, params: { intent: 'become_business' } }) },
                { text: "Vazgeç", style: "cancel" }
            ]);
            return;
        }

        try {
            // Sadece Bireysele Dönüş anlık kaydolur
            if (profile?.role !== 'dietitian') {
                const { error } = await supabase
                    .from('profiles')
                    .update({ account_type: type })
                    .eq('id', contextUser.id);
                
                if (error) throw error;
                
                setProfile((prev: any) => ({ ...prev, account_type: type }));
                closeSettings();
                Alert.alert("Başarılı", "Bireysel hesaba dönüş uygulandı.");
            } else {
                Alert.alert("Hata", "Diyetisyen hesapları otomatik geri döndürülemez. Destek ile iletişime geçin.");
            }
        } catch (e: any) {
            Alert.alert("Hata", "Hesap türü değiştirilirken bir hata oluştu: " + e.message);
        }
    };

    if (loading && !contextUser) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={THEME_COLOR} />
            </View>
        );
    }

    const renderHeader = () => (
        <View style={{ backgroundColor: bgColor }}>
            <View style={styles.profileInfoContainer}>
                    <Image
                        source={imageSource}
                        style={[styles.avatar, { backgroundColor: borderColor }]}
                        contentFit="cover"
                        transition={500}
                        onError={(e) => console.log("Profile Image Load Error:", e)}
                    />

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.posts}</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Gönderi</Text>
                        </View>

                        <TouchableOpacity style={styles.statItem} onPress={() => contextUser?.id && router.push({ pathname: '/follow-list' as any, params: { type: 'followers', userId: contextUser.id } })}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.followers}</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Takipçi</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.statItem} onPress={() => contextUser?.id && router.push({ pathname: '/follow-list' as any, params: { type: 'following', userId: contextUser.id } })}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.following}</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Takip</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* İSİM VE BİO */}
                <View style={styles.bioContainer}>
                    <Text style={[styles.fullName, { color: textColor }]}>
                        {contextUser?.ad || profile?.ad || profile?.first_name} {contextUser?.soyad || profile?.soyad || profile?.last_name}
                    </Text>

                    {profile?.role === 'dietitian' ? (
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 193, 7, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                    <Ionicons name="star" size={14} color="#FFC107" />
                                    <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: 'bold', color: '#FFC107' }}>
                                        {profile?.rating_avg || '5.0'} ({profile?.rating_count || 0} değerlendirme)
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.bioText, { color: subTextColor }]}>📍 {profile?.location}</Text>

                            {!profile?.is_verified && (
                                <View style={[styles.pendingBadge, { backgroundColor: isDark ? '#332b00' : '#fff3cd', borderColor: isDark ? '#665c00' : '#ffeeba' }]}>
                                    <Ionicons name="time-outline" size={16} color={isDark ? '#ffca2c' : '#856404'} />
                                    <Text style={[styles.pendingText, { color: isDark ? '#ffca2c' : '#856404' }]}> Onay Bekliyor</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View>
                            <Text style={[styles.bioText, { color: subTextColor }]}>{profile?.bio || 'Sağlıklı yaşam için Foodap kullanıyor. 🥑'}</Text>
                            
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
                                <TouchableOpacity 
                                    style={[styles.badgesContainer, { alignItems: 'center', paddingVertical: 10 }]}
                                    onPress={() => router.push('/tracking' as any)}
                                >
                                    <Text style={{ color: subTextColor, fontSize: 12, fontStyle: 'italic' }}>
                                        Henüz bir başarı sergilemedin. Takip sayfasından ekleyebilirsin.
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {profile?.account_type === 'business' && (
                    <View style={styles.businessButtonsContainer}>
                        <TouchableOpacity style={[styles.businessButton, { backgroundColor: isDark ? '#1a1a1a' : '#fafafa', borderColor: borderColor }]} onPress={() => Alert.alert('Yol Tarifi', 'Müşterileriniz bu butona tıklayarak işletmenize yol tarifi alır.')}>
                            <Ionicons name="location-outline" size={18} color={THEME_COLOR} />
                            <Text style={[styles.businessButtonText, { color: textColor }]}>Yol Tarifi (Önizleme)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.businessButton, { backgroundColor: isDark ? '#1a1a1a' : '#fafafa', borderColor: borderColor }]} onPress={() => router.push('/edit-profile' as any)}>
                            <Ionicons name="restaurant-outline" size={18} color={THEME_COLOR} />
                            <Text style={[styles.businessButtonText, { color: textColor }]}>Menüyü Düzenle</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* BUTONLAR */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.editButton, { backgroundColor: borderColor }]} onPress={() => router.push('/edit-profile' as any)}>
                        <Text style={[styles.buttonText, { color: textColor }]}>Profili Düzenle</Text>
                    </TouchableOpacity>
                </View>

                {/* TABLAR */}
                <View style={[styles.tabContainer, { borderTopColor: borderColor }]}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 0 && styles.activeTab]}
                        onPress={() => setActiveTab(0)}
                    >
                        <Ionicons name="grid-outline" size={24} color={activeTab === 0 ? THEME_COLOR : subTextColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 1 && styles.activeTab]}
                        onPress={() => setActiveTab(1)}
                    >
                        <Ionicons name="restaurant-outline" size={26} color={activeTab === 1 ? THEME_COLOR : subTextColor} />
                    </TouchableOpacity>
                </View>
        </View>
    );

    const renderGridItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push({ 
                pathname: (activeTab === 0 ? '/post-detail' : '/recipe-detail') as any, 
                params: activeTab === 0 
                    ? { postId: item.id, filterUserId: contextUser?.id } 
                    : { recipeId: item.id, filterUserId: contextUser?.id } 
            })}
        >
            <Image
                source={{ uri: item.image_url?.split(',')[0] }}
                style={styles.gridImage}
                contentFit="cover"
                transition={200}
            />
            {activeTab === 1 && (
                <View style={styles.recipeIndicator}>
                    <Ionicons name="restaurant" size={16} color="#fff" />
                </View>
            )}
            {activeTab === 1 && (
                <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 2, borderRadius: 4 }}>
                    <Text style={{ color: 'white', fontSize: 10 }}>{item.calories} kcal</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    const listData = activeTab === 0 ? postsData : recipes;
    
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={[styles.header, { backgroundColor: bgColor, borderBottomColor: borderColor }]}>
                <Text style={[styles.headerUsername, { color: textColor }]}>
                    {contextUser?.username
                        ? `@${contextUser.username}`
                        : (profile?.username ? `@${profile.username}` : 'Profil')}
                </Text>
                <TouchableOpacity onPress={openSettings}>
                    <Ionicons name="menu-outline" size={30} color={THEME_COLOR} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={listData}
                keyExtractor={(item) => item.id}
                renderItem={renderGridItem}
                ListHeaderComponent={renderHeader}
                numColumns={3}
                key={activeTab === 0 ? 'posts' : 'recipes'} // Sütun hatalarını önlemek için key değiştiriyoruz
                showsVerticalScrollIndicator={false}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={5}
                removeClippedSubviews={true}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name={activeTab === 0 ? "images-outline" : "restaurant-outline"} size={40} color="#ccc" />
                        <Text style={[styles.emptyText, { color: subTextColor }]}>
                            {activeTab === 0 ? "Henüz bir gönderi yok." : "Henüz tarif yok."}
                        </Text>
                    </View>
                }
            />

            {settingsVisible && (
                <TouchableWithoutFeedback onPress={closeSettings}>
                    <View style={styles.overlay} />
                </TouchableWithoutFeedback>
            )}

            <Animated.View
                style={[
                    styles.drawer,
                    {
                        transform: [{ translateX: slideAnim }]
                    }
                ]}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={[styles.drawerContent, { backgroundColor: modalBg }]}>
                        {settingsView === 'main' ? (
                            <>
                                <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
                                    <Text style={[styles.modalTitle, { color: textColor }]}>Ayarlar</Text>
                                    <TouchableOpacity onPress={closeSettings}>
                                        <Ionicons name="close-circle-outline" size={26} color={textColor} />
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.separator, { backgroundColor: borderColor }]} />

                                {profile?.role === 'dietitian' && (
                                    <>
                                        <View style={[styles.modalOption, { borderBottomColor: borderColor }]}>
                                            <View style={styles.optionLeft}>
                                                <Ionicons name="wallet-outline" size={22} color={textColor} />
                                                <Text style={[styles.optionText, { color: textColor }]}>
                                                    Bakiye: {profile?.balance || 0} ₺
                                                </Text>
                                            </View>
                                        </View>
                                        {/* Optional: Add a Withdraw button or similar here later */}
                                    </>
                                )}

                                <TouchableOpacity style={[styles.modalOption, { borderBottomColor: borderColor }]} onPress={() => toggleTheme()}>
                                    <View style={styles.optionLeft}>
                                        <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Koyu Tema</Text>
                                    </View>
                                    <Switch
                                        trackColor={{ false: "#767577", true: THEME_COLOR }}
                                        thumbColor={"#f4f3f4"}
                                        onValueChange={toggleTheme}
                                        value={isDark}
                                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                    onPress={() => {
                                        closeSettings();
                                        router.push('/promote-post' as any);
                                    }}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="megaphone-outline" size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Reklam ve Tanıtım</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                    onPress={() => {
                                        closeSettings();
                                        router.push('/activity-log' as any);
                                    }}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="pulse-outline" size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Aktivitelerim</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                    onPress={() => setSettingsView('general')}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="settings-outline" size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Genel Ayarlar</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                    onPress={handleChangeAccountType}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="briefcase-outline" size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Hesap Türü (Geçiş)</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                    onPress={() => setSettingsView('privacy')}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="lock-closed-outline" size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Hesap Gizliliği</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalOption}
                                    onPress={() => {
                                        closeSettings();
                                        handleSignOut();
                                    }}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="log-out-outline" size={22} color="#d9534f" />
                                        <Text style={[styles.optionText, { color: '#d9534f' }]}>Çıkış Yap</Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        ) : settingsView === 'privacy' ? (
                            <>
                                <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => setSettingsView('main')} style={{ marginRight: 10 }}>
                                            <Ionicons name="arrow-back" size={24} color={textColor} />
                                        </TouchableOpacity>
                                        <Text style={[styles.modalTitle, { color: textColor }]}>Hesap Gizliliği</Text>
                                    </View>
                                    <TouchableOpacity onPress={closeSettings}>
                                        <Ionicons name="close-circle-outline" size={26} color={textColor} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.separator} />

                                <View style={styles.privacyOption}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.privacyTitle, { color: textColor }]}>Gizli Profil</Text>
                                        <Text style={[styles.privacyDescription, { color: subTextColor }]}>
                                            Profiliniz gizli olduğunda, sadece sizi takip edenler gönderilerinizi görebilir.
                                        </Text>
                                    </View>
                                    <Switch
                                        trackColor={{ false: "#767577", true: "#f8d7da" }}
                                        thumbColor={isPrivate ? THEME_COLOR : "#f4f3f4"}
                                        onValueChange={togglePrivacy}
                                        value={isPrivate}
                                        style={{ transform: [{ scaleX: 1 }, { scaleY: 1 }] }}
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => setSettingsView('main')} style={{ marginRight: 10 }}>
                                            <Ionicons name="arrow-back" size={24} color={textColor} />
                                        </TouchableOpacity>
                                        <Text style={[styles.modalTitle, { color: textColor }]}>Genel Ayarlar</Text>
                                    </View>
                                    <TouchableOpacity onPress={closeSettings}>
                                        <Ionicons name="close-circle-outline" size={26} color={textColor} />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ padding: 20 }}>
                                    <TouchableOpacity
                                        style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                        onPress={() => {
                                            closeSettings();
                                            router.push('/edit-profile' as any);
                                        }}
                                    >
                                        <View style={styles.optionLeft}>
                                            <Ionicons name="person-outline" size={22} color={textColor} />
                                            <Text style={[styles.optionText, { color: textColor }]}>Profili Düzenle</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                        onPress={() => {
                                            closeSettings();
                                            router.push('/forgot-password' as any);
                                        }}
                                    >
                                        <View style={styles.optionLeft}>
                                            <Ionicons name="key-outline" size={22} color={textColor} />
                                            <Text style={[styles.optionText, { color: textColor }]}>Şifre Değiştir</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={subTextColor} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.modalOption, { borderBottomColor: borderColor }]}
                                        onPress={() => Alert.alert("Bilgi", "FoodApp v1.0.4\nSağlıklı yaşam asistanınız.")}
                                    >
                                        <View style={styles.optionLeft}>
                                            <Ionicons name="information-circle-outline" size={22} color={textColor} />
                                            <Text style={[styles.optionText, { color: textColor }]}>Uygulama Hakkında</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.modalOption}
                                        onPress={() => Alert.alert("Yardım", "Destek için support@foodapp.com adresine mail atabilirsiniz.")}
                                    >
                                        <View style={styles.optionLeft}>
                                            <Ionicons name="help-circle-outline" size={22} color={textColor} />
                                            <Text style={[styles.optionText, { color: textColor }]}>Yardım ve Destek</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </SafeAreaView>
            </Animated.View>
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
        backgroundColor: '#ffffff',
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
    pendingBadge: {
        flexDirection: 'row',
        backgroundColor: '#fff3cd',
        padding: 10,
        borderRadius: 10,
        marginTop: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ffeeba'
    },
    pendingText: { color: '#856404', fontWeight: 'bold', fontSize: 13 },
    actionButtons: { paddingHorizontal: 20, marginTop: 15 },
    editButton: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, alignItems: 'center' },
    buttonText: { fontWeight: 'bold', color: '#333' },
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
    tabContainer: { flexDirection: 'row', marginTop: 25, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: THEME_COLOR },
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingBottom: 40 },
    emptyText: { color: '#999', marginTop: 10, fontSize: 14 },
    postsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    gridItem: { width: IMAGE_SIZE, height: IMAGE_SIZE, padding: 1 },
    gridImage: { flex: 1, backgroundColor: '#f0f0f0' },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 999,
    },
    drawer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: width,
        zIndex: 1000,
    },
    drawerContent: {
        flex: 1,
        backgroundColor: 'white',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    separator: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginBottom: 10,
    },
    modalOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f0f0f0',
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 16,
        marginLeft: 15,
        color: '#333',
    },
    privacyOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
    },
    privacyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    privacyDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        paddingRight: 10,
    },
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
    placeholderContainerSmall: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recipeIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
    badgeLabel: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
});


