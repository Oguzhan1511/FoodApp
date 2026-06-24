import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Keyboard,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabaseConfig';

const { width } = Dimensions.get('window');

interface UserProfile {
    id: string;
    username: string;
    ad: string;
    soyad: string;
    avatar_url?: string;
}

interface DiscoverPost {
    id: string;
    image_url: string;
    user_id: string;
    username?: string; // For display if needed, though grid is just images
}

export default function DiscoverScreen() {
    const router = useRouter();
    const { search } = useLocalSearchParams<{ search?: string }>();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#f5f5f5';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaaaaa' : '#666';
    const cardBg = isDark ? '#1e1e1e' : '#fff';
    const inputBg = isDark ? '#333' : '#e0e0e0';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';

    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<UserProfile[]>([]);
    const [postResults, setPostResults] = useState<DiscoverPost[]>([]);
    const [loading, setLoading] = useState(false);

    const [feedPosts, setFeedPosts] = useState<DiscoverPost[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchDiscoverFeed();
        if (search) {
            handleSearch(search);
        }
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search]);

    const fetchDiscoverFeed = async () => {
        try {
            setFeedLoading(true);
            const myId = user?.id;

            // ========== 1. KULLANICININ İLGİ ALANLARINI ANALİZ ET ==========
            let topTags: string[] = [];
            let likedPostIds = new Set<string>();

            if (myId) {
                // Son 30 beğeniyi çek
                const { data: recentLikes } = await supabase
                    .from('post_likes')
                    .select('post_id')
                    .eq('user_id', myId)
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (recentLikes && recentLikes.length > 0) {
                    const likedIds = recentLikes.map(l => l.post_id);
                    likedIds.forEach(id => likedPostIds.add(id));

                    // Beğenilen postların tag'lerini çek
                    const { data: likedPosts } = await supabase
                        .from('posts')
                        .select('tags')
                        .in('id', likedIds);

                    if (likedPosts) {
                        const tagCounts: Record<string, number> = {};
                        likedPosts.forEach(p => {
                            if (p.tags) {
                                p.tags.split(',').map((t: string) => t.trim().toLowerCase()).forEach((t: string) => {
                                    if (t && t.length > 1) tagCounts[t] = (tagCounts[t] || 0) + 1;
                                });
                            }
                        });
                        // En çok beğenilen 5 tag
                        topTags = Object.entries(tagCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(e => e[0]);
                    }
                }
            }

            // ========== 2. FARKLI KAYNAKLARDAN POST ÇEK ==========
            const allPostsMap = new Map<string, any>();

            // 2a. İlgi alanına göre postlar (tag eşleşmesi)
            if (topTags.length > 0) {
                const tagFilters = topTags.map(tag => `tags.ilike.%${tag}%`).join(',');
                const { data: interestPosts } = await supabase
                    .from('posts')
                    .select('id, image_url, user_id, created_at, tags, likes, is_sponsored')
                    .or(tagFilters)
                    .order('likes', { ascending: false })
                    .limit(30);

                interestPosts?.forEach(p => {
                    // İlgi skoru hesapla
                    const matchCount = topTags.filter(tag => 
                        p.tags?.toLowerCase().includes(tag)
                    ).length;
                    allPostsMap.set(p.id, { ...p, _score: matchCount * 10 + (p.likes || 0), _source: 'interest' });
                });
            }

            // 2b. Popüler/Trend postlar (çok beğenilen)
            const { data: trendingPosts } = await supabase
                .from('posts')
                .select('id, image_url, user_id, created_at, tags, likes, is_sponsored')
                .order('likes', { ascending: false })
                .limit(20);

            trendingPosts?.forEach(p => {
                if (!allPostsMap.has(p.id)) {
                    allPostsMap.set(p.id, { ...p, _score: (p.likes || 0), _source: 'trending' });
                }
            });

            // 2c. Yeni postlar (keşif çeşitliliği için)
            const { data: recentPosts } = await supabase
                .from('posts')
                .select('id, image_url, user_id, created_at, tags, likes, is_sponsored')
                .order('created_at', { ascending: false })
                .limit(30);

            recentPosts?.forEach(p => {
                if (!allPostsMap.has(p.id)) {
                    allPostsMap.set(p.id, { ...p, _score: 1, _source: 'recent' });
                }
            });

            // 2d. Sponsorlu postları boost et
            allPostsMap.forEach((post, id) => {
                if (post.is_sponsored) {
                    post._score += 15;
                }
            });

            let allPosts = Array.from(allPostsMap.values());

            // Kendi beğendiklerini aşağıya it (zaten gördü)
            allPosts = allPosts.map(p => ({
                ...p,
                _score: likedPostIds.has(p.id) ? p._score * 0.3 : p._score
            }));

            // ========== 3. GİZLİLİK FİLTRESİ ==========
            if (allPosts.length > 0) {
                const userIds = [...new Set(allPosts.map(p => p.user_id))];

                const [profilesRes, dietitiansRes] = await Promise.all([
                    supabase.from('profiles').select('id, is_private').in('id', userIds),
                    supabase.from('dietitians').select('id').in('id', userIds)
                ]);

                const privateUserIds = new Set<string>();
                const dietitianIds = new Set<string>();

                profilesRes.data?.forEach(p => {
                    if (p.is_private) privateUserIds.add(p.id);
                });
                dietitiansRes.data?.forEach(d => dietitianIds.add(d.id));

                allPosts = allPosts.filter(p => {
                    if (dietitianIds.has(p.user_id)) return true;
                    if (privateUserIds.has(p.user_id)) return false;
                    return true;
                });
            }

            // ========== 4. SIRALAMA & KARİŞTIRMA ==========
            // Skora göre sırala ama hafif rastgelelik ekle (her yenilemede farklı akış)
            allPosts.sort((a, b) => {
                const noise = (Math.random() - 0.5) * 5; // ±2.5 puan rastgelelik
                return (b._score + noise) - (a._score + noise);
            });

            setFeedPosts(allPosts.slice(0, 60));

        } catch (error) {
            console.error("Feed error:", error);
        } finally {
            setFeedLoading(false);
            setRefreshing(false);
        }
    };

    const debouncedSearch = useCallback((text: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSearchQuery(text);

        if (text.length < 2) {
            setResults([]);
            setPostResults([]);
            return;
        }

        debounceRef.current = setTimeout(() => {
            handleSearch(text);
        }, 300);
    }, []);

    const handleSearch = async (text: string) => {
        if (text.length < 2) return;

        setLoading(true);
        try {
            // Kullanıcı sorgusu
            const userQuery = supabase
                .from('profiles')
                .select('id, username, ad, soyad, avatar_url, bio')
                .or(`username.ilike.%${text}%,ad.ilike.%${text}%,soyad.ilike.%${text}%,bio.ilike.%${text}%`)
                .neq('id', user?.id || '')
                .limit(10);

            const postQuery = supabase
                .from('posts')
                .select('id, image_url, user_id, tags')
                .ilike('tags', `%${text}%`)
                .order('created_at', { ascending: false })
                .limit(21);

            const [userRes, postRes] = await Promise.all([userQuery, postQuery]);

            let finalUsers = userRes.data || [];
            let returnedPosts = postRes.data || [];

            // Eğer gönderiler bulunduysa, o gönderileri atan kullanıcıları da Keşfet listesine ekleyelim
            if (returnedPosts.length > 0) {
                // Gönderi sahiplerinin ID'lerini benzersiz bir listeye alalım
                const postCreatorIds = [...new Set(returnedPosts.map(p => p.user_id))];
                
                // Zaten 'Kullanıcılar' listesinde (finalUsers) olmayanları bulalım ve kendimiz olmasın
                const missingUserIds = postCreatorIds.filter(
                    id => id !== user?.id && !finalUsers.some(u => u.id === id)
                );

                if (missingUserIds.length > 0) {
                    // Eksik kullanıcıların profil detaylarını çekelim
                    const { data: missingProfiles } = await supabase
                        .from('profiles')
                        .select('id, username, ad, soyad, avatar_url, bio')
                        .in('id', missingUserIds)
                        .limit(10); // Performans için sınır koyabiliriz

                    if (missingProfiles) {
                        finalUsers = [...finalUsers, ...missingProfiles];
                    }
                }
            }

            setResults(finalUsers);
            setPostResults(returnedPosts);

        } catch (error) {
            console.error("Arama exception:", error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDiscoverFeed();
    };

    const renderResultItem = ({ item }: { item: UserProfile }) => (
        <TouchableOpacity
            style={[styles.resultItem, { backgroundColor: cardBg }]}
            onPress={() => router.push({ pathname: '/user-profile' as any, params: { userId: item.id } })}
        >
            <Image
                source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.username}&background=random` }}
                style={styles.avatar}
                contentFit="cover"
            />
            <View>
                <Text style={[styles.resultName, { color: textColor }]}>{item.ad} {item.soyad}</Text>
                <Text style={[styles.resultUsername, { color: subTextColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={subTextColor} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
    );

    const renderPostItem = ({ item }: { item: DiscoverPost }) => (
        <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push({ pathname: '/post-detail' as any, params: { postId: item.id } })}
        >
            <Image
                source={{ uri: item.image_url?.split(',')[0] }}
                style={styles.gridImage}
                contentFit="cover"
                transition={200}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* SEARCH BAR */}
            <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
                <Ionicons name="search" size={20} color={subTextColor} style={{ marginRight: 10 }} />
                <TextInput
                    style={[styles.searchInput, { color: textColor }]}
                    placeholder="Kullanıcı ara..."
                    placeholderTextColor={subTextColor}
                    value={searchQuery}
                    onChangeText={debouncedSearch}
                    autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setResults([]); setPostResults([]); Keyboard.dismiss(); }}>
                        <Ionicons name="close-circle" size={20} color={subTextColor} />
                    </TouchableOpacity>
                )}
            </View>

            {/* CONTENT */}
            {searchQuery.length > 0 ? (
                // SEARCH RESULTS
                loading ? (
                    <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 20 }} />
                ) : (
                    <ScrollView style={{ flex: 1 }}>
                        {results.length > 0 && (
                            <View style={{ padding: 15 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor, marginBottom: 10 }}>Kullanıcılar</Text>
                                {results.map(item => (
                                    <View key={item.id}>{renderResultItem({ item })}</View>
                                ))}
                            </View>
                        )}
                        {postResults.length > 0 && (
                            <View style={{ paddingHorizontal: 0 }}>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor, marginBottom: 10, paddingHorizontal: 15 }}>İlgili Gönderiler</Text>
                                <View style={styles.postsGrid}>
                                    {postResults.map(item => (
                                        <View key={item.id}>{renderPostItem({ item })}</View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {results.length === 0 && postResults.length === 0 && (
                            <Text style={[styles.emptyText, { color: subTextColor }]}>Sonuç bulunamadı.</Text>
                        )}
                    </ScrollView>
                )
            ) : (
                // DISCOVER GRID
                feedLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={primaryColor} />
                    </View>
                ) : (
                    <FlatList
                        key="discover-grid"
                        data={feedPosts}
                        keyExtractor={item => item.id}
                        renderItem={renderPostItem}
                        numColumns={3}
                        contentContainerStyle={styles.gridContainer}
                        initialNumToRender={12}
                        maxToRenderPerBatch={12}
                        windowSize={5}
                        removeClippedSubviews={true}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
                        }
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Ionicons name="compass-outline" size={64} color={isDark ? '#333' : '#ddd'} />
                                <Text style={[styles.text, { color: textColor }]}>Keşfet</Text>
                                <Text style={[styles.subText, { color: subTextColor }]}>Henüz gönderi yok.</Text>
                            </View>
                        }
                    />
                )
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 15,
        marginBottom: 10,
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 25,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 10,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginBottom: 10,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: '#ccc',
    },
    resultName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    resultUsername: {
        fontSize: 14,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.7,
        marginTop: 50
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
    },
    subText: {
        marginTop: 10,
        fontSize: 14,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
    },
    // GRID STYLES
    gridContainer: {
        paddingBottom: 20,
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridItem: {
        width: width / 3,
        height: width / 3,
        borderColor: '#fff',
        borderWidth: 0.5,
    },
    gridImage: {
        width: '100%',
        height: '100%',
    }
});
