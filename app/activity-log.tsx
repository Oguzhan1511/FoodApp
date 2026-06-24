import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseConfig';
import { useTheme } from '../context/ThemeContext';

type TabType = 'likes' | 'comments' | 'saved';

export default function ActivityLogScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#f0f0f0';
    const activeTabColor = isDark ? '#333333' : '#f0f0f0';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';

    const [activeTab, setActiveTab] = useState<TabType>('likes');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetchActivity();
        }
    }, [user, activeTab]);

    const fetchActivity = async () => {
        setLoading(true);
        setData([]);

        try {
            if (activeTab === 'likes') {
                const { data: likes } = await supabase
                    .from('post_likes')
                    .select(`
                        id,
                        created_at,
                        post_id,
                        posts:post_id (
                            id, image_url, description
                        )
                    `)
                    .eq('user_id', user?.id)
                    .order('created_at', { ascending: false });

                if (likes) {
                    const formatted = likes.map((item: any) => ({
                        id: item.id,
                        type: 'like',
                        date: item.created_at,
                        postId: item.post_id,
                        postImage: item.posts?.image_url,
                        postDesc: item.posts?.description
                    })).filter((i: any) => i.postImage); // Filter out deleted posts
                    setData(formatted);
                }

            } else if (activeTab === 'comments') {
                const { data: comments } = await supabase
                    .from('comments')
                    .select(`
                        id,
                        created_at,
                        content,
                        post_id,
                        posts:post_id (
                            id, image_url
                        )
                    `)
                    .eq('user_id', user?.id)
                    .order('created_at', { ascending: false });

                if (comments) {
                    const formatted = comments.map((item: any) => ({
                        id: item.id,
                        type: 'comment',
                        content: item.content,
                        date: item.created_at,
                        postId: item.post_id,
                        postImage: item.posts?.image_url
                    })).filter((i: any) => i.postImage);
                    setData(formatted);
                }

            } else if (activeTab === 'saved') {
                const { data: saved } = await supabase
                    .from('saved_posts')
                    .select(`
                        id,
                        created_at,
                        post_id,
                        posts:post_id (
                            id, image_url, description
                        )
                    `)
                    .eq('user_id', user?.id) // Assuming user_id is correct type now
                    .order('created_at', { ascending: false });

                if (saved) {
                    const formatted = saved.map((item: any) => ({
                        id: item.id,
                        type: 'saved',
                        date: item.created_at,
                        postId: item.post_id,
                        postImage: item.posts?.image_url,
                        postDesc: item.posts?.description
                    })).filter((i: any) => i.postImage);
                    setData(formatted);
                }
            }
        } catch (error) {
            console.log("Activity fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        return (
            <TouchableOpacity
                style={[styles.itemContainer, { borderBottomColor: borderColor }]}
                onPress={() => router.push({ pathname: '/post-detail' as any, params: { postId: item.postId } })}
            >
                <Image
                    source={{ uri: item.postImage }}
                    style={[styles.itemImage, { backgroundColor: borderColor }]}
                    contentFit="cover"
                />
                <View style={styles.itemContent}>
                    {item.type === 'like' && (
                        <Text style={[styles.itemText, { color: textColor }]}>
                            Bir gönderiyi beğendin.
                            {item.postDesc && <Text style={{ color: subTextColor }}> "{item.postDesc.substring(0, 30)}..."</Text>}
                        </Text>
                    )}
                    {item.type === 'comment' && (
                        <Text style={[styles.itemText, { color: textColor }]}>
                            Yorum yaptın: <Text style={{ fontWeight: 'bold' }}>"{item.content}"</Text>
                        </Text>
                    )}
                    {item.type === 'saved' && (
                        <Text style={[styles.itemText, { color: textColor }]}>
                            Bir gönderiyi kaydettin.
                        </Text>
                    )}
                    <Text style={[styles.itemDate, { color: subTextColor }]}>
                        {new Date(item.date).toLocaleDateString('tr-TR')} • {new Date(item.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={subTextColor} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Hareketler</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'likes' && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('likes')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'likes' ? primaryColor : subTextColor }]}>Beğeniler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'comments' && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('comments')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'comments' ? primaryColor : subTextColor }]}>Yorumlar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'saved' && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
                    onPress={() => setActiveTab('saved')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'saved' ? primaryColor : subTextColor }]}>Kaydedilenler</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : data.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons
                        name={activeTab === 'likes' ? "heart-dislike-outline" : activeTab === 'comments' ? "chatbubble-outline" : "bookmark-outline"}
                        size={50}
                        color={subTextColor}
                    />
                    <Text style={[styles.emptyText, { color: subTextColor }]}>
                        {activeTab === 'likes' ? 'Henüz beğeni yok.' : activeTab === 'comments' ? 'Henüz yorum yok.' : 'Henüz kaydedilen yok.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 0.5,
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
    },
    tabText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 10,
        fontSize: 14,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 0.5,
    },
    itemImage: {
        width: 50,
        height: 50,
        borderRadius: 5,
        marginRight: 15,
    },
    itemContent: {
        flex: 1,
        marginRight: 10,
    },
    itemText: {
        fontSize: 14,
        marginBottom: 4,
    },
    itemDate: {
        fontSize: 12,
    },
});
