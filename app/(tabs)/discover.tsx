import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Keyboard,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../services/supabaseConfig';

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
    const [loading, setLoading] = useState(false);

    const [feedPosts, setFeedPosts] = useState<DiscoverPost[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchDiscoverFeed();
    }, []);

    const fetchDiscoverFeed = async () => {
        try {
            setFeedLoading(true);

            // 1. Fetch latest 50 posts
            const { data: posts, error } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            if (!posts || posts.length === 0) {
                setFeedPosts([]);
                return;
            }

            const userIds = [...new Set(posts.map(p => p.user_id))];

            // 2. Fetch User Profiles to check privacy
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, is_private')
                .in('id', userIds);

            // 3. Fetch Dietitians (always public)
            const { data: dietitians } = await supabase
                .from('dietitians')
                .select('id')
                .in('id', userIds);

            const privateUserIds = new Set<string>();
            const dietitianIds = new Set<string>();

            profiles?.forEach(p => {
                if (p.is_private) privateUserIds.add(p.id);
            });

            dietitians?.forEach(d => {
                dietitianIds.add(d.id);
            });

            // 4. Filter posts
            // Show if: User is Dietitian OR (User is NOT private)
            // Note: If user is not in profiles AND not in dietitians, we assume public or skip? 
            // Let's assume public if not explicitly private, but usually they should be in profiles.

            const filteredPosts = posts.filter(p => {
                const isDietitian = dietitianIds.has(p.user_id);
                const isPrivate = privateUserIds.has(p.user_id);

                // Diyetisyense göster. Değilse ve gizliyse gösterme.
                if (isDietitian) return true;
                if (isPrivate) return false;

                return true; // Public user
            });

            setFeedPosts(filteredPosts);

        } catch (error) {
            console.error("Feed error:", error);
        } finally {
            setFeedLoading(false);
            setRefreshing(false);
        }
    };

    const handleSearch = async (text: string) => {
        setSearchQuery(text);

        if (text.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            let query = supabase
                .from('profiles')
                .select('id, username, ad, soyad, avatar_url')
                .or(`username.ilike.%${text}%,ad.ilike.%${text}%,soyad.ilike.%${text}%`)
                .neq('id', user?.id || '');

            const { data, error } = await query;

            if (error) {
                console.error("Search error:", error);
            } else {
                setResults(data || []);
            }
        } catch (error) {
            console.error("Search exception:", error);
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
            onPress={() => router.push({ pathname: "/user-profile", params: { userId: item.id } })}
        >
            <Image
                source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.username}&background=random` }}
                style={styles.avatar}
                contentFit="cover"
            />
            <View>
                <Text style={[styles.resultName, { color: textColor }]}>{item.ad} {item.soyad}</Text>
                <Text style={[styles.resultUsername, { color: subTextColor }]}>@{item.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={subTextColor} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
    );

    const renderPostItem = ({ item }: { item: DiscoverPost }) => (
        <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push({ pathname: "/post-detail", params: { postId: item.id } })}
        >
            <Image
                source={{ uri: item.image_url }}
                style={styles.gridImage}
                contentFit="cover"
                transition={500}
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
                    onChangeText={handleSearch}
                    autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setResults([]); Keyboard.dismiss(); }}>
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
                    <FlatList
                        key="search-list"
                        data={results}
                        keyExtractor={item => item.id}
                        renderItem={renderResultItem}
                        contentContainerStyle={{ padding: 15 }}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: subTextColor }]}>Kullanıcı bulunamadı.</Text>
                        }
                    />
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
