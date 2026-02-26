import { Ionicons } from '@expo/vector-icons';
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
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { auth } from '../services/firebaseConfig';
import { supabase } from '../services/supabaseConfig';
import { useTheme } from '../ThemeContext';

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
    const [settingsView, setSettingsView] = useState<'main' | 'privacy'>('main');
    const [isPrivate, setIsPrivate] = useState(false);
    const slideAnim = React.useRef(new Animated.Value(width)).current;

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
            const url = profile?.role === 'dietitian' ? profile?.profile_picture : profile?.avatar_url;
            if (!url) {
                // Default avatar
                if (profile?.first_name) {
                    setImageSource(`https://ui-avatars.com/api/?name=${profile.first_name}&background=800020&color=fff`);
                } else {
                    setImageSource(null);
                }
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
    }, [profile]);


    useFocusEffect(
        useCallback(() => {
            fetchProfile();
            if (contextUser?.id) {
                fetchStats(contextUser.id);
                fetchPosts(contextUser.id);
            }
        }, [contextUser?.id])
    );

    useEffect(() => {
        if (contextUser?.id) {
            fetchStats(contextUser.id);
        }
    }, [contextUser?.id]);

    const fetchPosts = async (uid: string) => {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('user_id', uid)
                .eq('is_recipe', false) // Sadece normal postları getir
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setPostsData(data);
                // İstatistiklerdeki post sayısını güncelle
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

            if (data) {
                setRecipes(data);
            }
        } catch (error) {
            console.log("Tarifleri çekme hatası:", error);
        }
    };

    useEffect(() => {
        if (activeTab === 1 && contextUser?.id) {
            fetchRecipes(contextUser.id);
        }
    }, [activeTab, contextUser?.id]);

    const fetchStats = async (uid: string) => {
        try {
            // 1. Arkadaş sayısını hesapla (Friendships)
            const { count: friendCount, error: friendError } = await supabase
                .from('friendships')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'accepted')
                .or(`requester.eq.${uid},receiver.eq.${uid}`);

            // 2. Takip edilen diyetisyen sayısını hesapla
            const { count: followingDietitianCount, error: dietError } = await supabase
                .from('dietitian_follows')
                .select('id', { count: 'exact', head: true })
                .eq('follower_id', uid);

            // 3. (Eğer Diyetisyense) Takipçi sayısını hesapla
            let followerCount = friendCount || 0;

            // Eğer profil diyetisyense, onu takip edenleri ekle
            const { count: dietFollowers, error: dfError } = await supabase
                .from('dietitian_follows')
                .select('id', { count: 'exact', head: true })
                .eq('dietitian_id', uid);

            if (dietFollowers) {
                followerCount += dietFollowers;
            }

            if (friendError) console.log("Arkadaş istatistik hatası:", friendError);
            if (dietError) console.log("Diyetisyen takip istatistik hatası:", dietError);

            setStats(prev => ({
                ...prev,
                followers: followerCount,
                following: (friendCount || 0) + (followingDietitianCount || 0)
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

            // 1. Try fetching as dietitian
            const { data: dietitian } = await supabase
                .from('dietitians')
                .select('*')
                .eq('id', user.uid)
                .single();

            if (dietitian) {
                setProfile({ ...dietitian, role: 'dietitian' });
            } else {
                // 2. Fallback to regular profile
                const { data: userData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.uid)
                    .single();

                console.log("Fetched User Profile:", userData); // DEBUG LOG
                console.log("Avatar URL in DB:", userData?.avatar_url); // DEBUG LOG

                if (userData) {
                    setProfile({ ...userData, role: 'user' });
                }
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

    const renderPostsGrid = () => {
        if (postsData.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="images-outline" size={40} color="#ccc" />
                    <Text style={styles.emptyText}>Henüz bir gönderi yok.</Text>
                </View>
            );
        }

        return (
            <View style={styles.postsGrid}>
                {postsData.map((post) => (
                    <TouchableOpacity
                        key={post.id}
                        style={styles.gridItem}
                        onPress={() => router.push({ pathname: '/post-detail', params: { postId: post.id } })}
                    >
                        <Image
                            source={{ uri: post.image_url }}
                            style={styles.gridImage}
                            contentFit="cover"
                            transition={200}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    if (loading && !contextUser) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={THEME_COLOR} />
            </View>
        );
    }

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

            <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: bgColor }}>
                <View style={styles.profileInfoContainer}>
                    <Image
                        source={imageSource}
                        style={[styles.avatar, { backgroundColor: borderColor }]}
                        contentFit="cover"
                        transition={500}
                    />

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.posts}</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Gönderi</Text>
                        </View>

                        <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/follow-list', params: { type: 'followers', userId: contextUser?.id } })}>
                            <Text style={[styles.statNumber, { color: textColor }]}>
                                {profile?.role === 'dietitian' ? profile?.rating_avg : stats.followers}
                            </Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>{profile?.role === 'dietitian' ? 'Puan' : 'Takipçi'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/follow-list', params: { type: 'following', userId: contextUser?.id } })}>
                            <Text style={[styles.statNumber, { color: textColor }]}>{stats.following}</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Takip</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* İSİM VE BİO */}
                <View style={styles.bioContainer}>
                    <Text style={[styles.fullName, { color: textColor }]}>{profile?.first_name} {profile?.last_name}</Text>

                    {profile?.role === 'dietitian' ? (
                        <View>
                            <Text style={[styles.bioText, { color: subTextColor }]}>📍 {profile?.location}</Text>
                            <Text style={[styles.bioText, { color: subTextColor }]}>📜 Diploma No: {profile?.diploma_no}</Text>

                            {!profile?.is_verified && (
                                <View style={[styles.pendingBadge, { backgroundColor: isDark ? '#332b00' : '#fff3cd', borderColor: isDark ? '#665c00' : '#ffeeba' }]}>
                                    <Ionicons name="time-outline" size={16} color={isDark ? '#ffca2c' : '#856404'} />
                                    <Text style={[styles.pendingText, { color: isDark ? '#ffca2c' : '#856404' }]}> Onay Bekliyor</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <Text style={[styles.bioText, { color: subTextColor }]}>Sağlıklı yaşam için Foodap kullanıyor. 🥑</Text>
                    )}
                </View>

                {/* BUTONLAR */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.editButton, { backgroundColor: borderColor }]} onPress={() => router.push('/edit-profile')}>
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

                {/* POST CONTENT */}
                {activeTab === 0 ? (
                    renderPostsGrid()
                ) : (
                    recipes.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="restaurant-outline" size={40} color="#ccc" />
                            <Text style={[styles.emptyText, { color: subTextColor }]}>Henüz tarif yok.</Text>
                        </View>
                    ) : (
                        <View style={styles.postsGrid}>
                            {recipes.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.gridItem}
                                    onPress={() => router.push({ pathname: '/recipe-detail', params: { recipeId: item.id } })}
                                >
                                    <Image
                                        source={{ uri: item.image_url }}
                                        style={styles.gridImage}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                    <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 2, borderRadius: 4 }}>
                                        <Text style={{ color: 'white', fontSize: 10 }}>{item.calories} kcal</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )
                )}
            </ScrollView>

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
                                        router.push('/activity-log');
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
                                    onPress={() => {
                                        closeSettings();
                                    }}
                                >
                                    <View style={styles.optionLeft}>
                                        <Ionicons name="settings-outline" size={22} color={textColor} />
                                        <Text style={[styles.optionText, { color: textColor }]}>Genel Ayarlar</Text>
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
                        ) : (
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
    actionButtons: { paddingHorizontal: 20, marginTop: 20 },
    editButton: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, alignItems: 'center' },
    buttonText: { fontWeight: 'bold', color: '#333' },
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
});


