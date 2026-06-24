import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

const THEME_COLOR = '#800020';

interface FollowUser {
    id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    ad?: string; // For friends table compatibility
    soyad?: string; // For friends table compatibility
    role?: string; // 'dietitian' or 'user'
    avatar_url?: string | null;
}

export default function FollowListScreen() {
    const router = useRouter();
    const { type, userId } = useLocalSearchParams<{ type: 'followers' | 'following'; userId: string }>();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#f0f0f0';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';
    const cardBg = isDark ? '#1e1e1e' : '#ffffff';

    // Use passed userId or current user's id
    const targetId = userId || user?.id;

    const [loading, setLoading] = useState(true);
    const [list, setList] = useState<FollowUser[]>([]);

    useEffect(() => {
        if (targetId) {
            fetchList();
        }
    }, [targetId, type]);

    const fetchList = async () => {
        setLoading(true);
        setList([]);

        try {
            if (type === 'following') {
                // 1. Fetch Followed Users (Users I follow)
                const { data: followedData, error: followedError } = await supabase
                    .from('user_follows')
                    .select('following_id')
                    .eq('follower_id', targetId)
                    .eq('status', 'accepted');

                if (followedError) throw followedError;

                const followingIds = followedData?.map(f => f.following_id) || [];
                let friendList: any[] = [];
                
                if (followingIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, username, ad, soyad, avatar_url')
                        .in('id', followingIds);

                    friendList = (profiles || []).map((p: any) => ({
                        id: p.id,
                        username: p.username,
                        first_name: p.ad,
                        last_name: p.soyad,
                        role: 'user',
                        avatar_url: p.avatar_url
                    }));
                }

                // 2. Fetch Followed Dietitians
                const { data: dietitians, error: dietitiansError } = await supabase
                    .from('dietitian_follows')
                    .select(`
            dietitian:dietitians(id, username, first_name, last_name, profile_picture)
          `)
                    .eq('follower_id', targetId);

                if (dietitiansError) throw dietitiansError;

                const dietitianList = (dietitians || []).map((d: any) => ({
                    id: d.dietitian.id,
                    username: d.dietitian.username,
                    first_name: d.dietitian.first_name,
                    last_name: d.dietitian.last_name,
                    role: 'dietitian',
                    avatar_url: d.dietitian.profile_picture
                }));

                setList([...friendList, ...dietitianList]);

            } else if (type === 'followers') {
                // 1. Fetch Followers (Users following this profile)
                const { data: followersData, error: followersError } = await supabase
                    .from('user_follows')
                    .select('follower_id')
                    .eq('following_id', targetId)
                    .eq('status', 'accepted');

                if (followersError) throw followersError;

                const followerIds = followersData?.map(f => f.follower_id) || [];
                let friendList: any[] = [];
                
                if (followerIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, username, ad, soyad, avatar_url')
                        .in('id', followerIds);

                    friendList = (profiles || []).map((p: any) => ({
                        id: p.id,
                        username: p.username,
                        first_name: p.ad,
                        last_name: p.soyad,
                        role: 'user',
                        avatar_url: p.avatar_url
                    }));
                }

                // 2. Fetch Users following this Dietitian (If user is dietitian)
                const { data: followers, error: dietitianFollowersError } = await supabase
                    .from('dietitian_follows')
                    .select(`
                follower:profiles(id, username, ad, soyad, avatar_url) 
            `)
                    .eq('dietitian_id', targetId);

                let followerList: any[] = [];
                if (!dietitianFollowersError && followers) {
                    followerList = followers.map((f: any) => ({
                        id: f.follower.id,
                        username: f.follower.username,
                        first_name: f.follower.ad || '',
                        last_name: f.follower.soyad || '',
                        role: 'user',
                        avatar_url: f.follower.avatar_url
                    }));
                }

                setList([...friendList, ...followerList]);
            }

        } catch (error) {
            console.error('List fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: FollowUser }) => (
        <TouchableOpacity style={[styles.card, { borderBottomColor: borderColor }]} onPress={() => {
            router.push({
                pathname: '/user-profile' as any,
                params: { userId: item.id }
            });
        }}>
            <View style={[styles.avatar, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                    <Text style={[styles.avatarText, { color: subTextColor }]}>
                        {(item.first_name?.[0] || item.username?.[0] || '?').toUpperCase()}
                    </Text>
                )}
            </View>
            <View>
                <Text style={[styles.name, { color: textColor }]}>
                    {item.first_name} {item.last_name}
                </Text>
                <Text style={[styles.username, { color: subTextColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                {item.role === 'dietitian' && (
                    <Text style={[styles.badge, { color: primaryColor, backgroundColor: isDark ? '#300' : '#ffe6e6' }]}>
                        Diyetisyen
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>
                    {type === 'following' ? 'Takip Edilenler' : 'Takipçiler'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator color={primaryColor} size="large" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={list}
                    keyExtractor={(item, index) => item.id + index}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={[styles.empty, { color: subTextColor }]}>Liste boş.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    list: { padding: 20 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9'
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden'
    },
    avatarImage: {
        width: '100%',
        height: '100%'
    },
    avatarText: { fontSize: 20, fontWeight: 'bold', color: '#555' },
    name: { fontSize: 16, fontWeight: '600', color: '#333' },
    username: { fontSize: 14, color: '#666' },
    badge: {
        fontSize: 10,
        color: THEME_COLOR,
        backgroundColor: '#ffe6e6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
        alignSelf: 'flex-start'
    },
    empty: { textAlign: 'center', marginTop: 30, color: '#999' }
});
