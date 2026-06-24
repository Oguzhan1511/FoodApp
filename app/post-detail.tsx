import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
    ScrollView,
    Dimensions
} from 'react-native';
import CommentBottomSheet from '../components/CommentBottomSheet';
import LikesBottomSheet from '../components/LikesBottomSheet';
import ShareBottomSheet from '../components/ShareBottomSheet';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';
import { DynamicImage } from '../components/DynamicImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const borderColor = isDark ? '#333333' : '#eee';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';
    
    const initialPostId = params.postId as string;

    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const flatListRef = React.useRef<FlatList>(null);
    const [initialIndex, setInitialIndex] = useState(0);
    const [listOpacity, setListOpacity] = useState(0);
    
    // Bottom Sheets State
    const [commentSheetVisible, setCommentSheetVisible] = useState(false);
    const [likesSheetVisible, setLikesSheetVisible] = useState(false);
    const [shareSheetVisible, setShareSheetVisible] = useState(false);
    const [activePostId, setActivePostId] = useState<string>('');
    const [activePostOwnerId, setActivePostOwnerId] = useState<string>('');

    useEffect(() => {
        if (initialPostId) {
            fetchFeed();
        }
    }, [initialPostId]);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const filterUserId = params.filterUserId as string;

            // 1. İlk (Tıklanan) Gönderiyi Çek
            const { data: mainPost } = await supabase.from('posts').select('*').eq('id', initialPostId).single();
            
            // 2. Diğer Gönderileri Çek (Artık listeyi kronolojik yapmak için filterUserId varsa neq kullanmıyoruz)
            let query = supabase.from('posts').select('*').eq('is_recipe', false);
            
            if (filterUserId) {
                // Profil modu: tüm postları kronolojik getir
                query = query.eq('user_id', filterUserId).order('created_at', { ascending: false });
            } else {
                // Keşfet modu: tıklanan hariç diğer popülerler
                query = query.neq('id', initialPostId).order('likes', { ascending: false }).limit(15);
            }

            const { data: otherPosts } = await query;
                
            let feedData = [];
            if (filterUserId) {
                feedData = otherPosts || [];
                if (mainPost && !feedData.some((p: any) => p.id === mainPost.id)) {
                    feedData.push(mainPost);
                    feedData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
            } else {
                if (mainPost) feedData.push(mainPost);
                if (otherPosts) feedData = [...feedData, ...otherPosts];
            }
            
            const targetIdx = feedData.findIndex((p: any) => p.id === initialPostId);
            setInitialIndex(targetIdx !== -1 ? targetIdx : 0);
            
            if (feedData.length === 0) {
                setPosts([]);
                setLoading(false);
                return;
            }

            // 3. Zenginleştirme (Kullanıcılar, Beğeniler, Yorumlar)
            const postIds = feedData.map(p => p.id);
            const userIds = [...new Set(feedData.map(p => p.user_id))];

            const [
                { data: profiles },
                { data: dietitians },
                { data: myLikes },
                { data: mySaves },
                { data: commentsData }
            ] = await Promise.all([
                supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
                supabase.from('dietitians').select('id, username, profile_picture').in('id', userIds),
                user?.id ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds) : { data: [] },
                user?.id ? supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds) : { data: [] },
                supabase.from('comments').select('*').in('post_id', postIds).eq('is_hidden', false)
            ]);

            const userMap: Record<string, { username: string, avatarUrl: string }> = {};
            profiles?.forEach(p => userMap[p.id] = { username: p.username, avatarUrl: p.avatar_url });
            dietitians?.forEach(d => { if(!userMap[d.id]) userMap[d.id] = { username: d.username, avatarUrl: d.profile_picture }; });

            const likedSet = new Set(myLikes?.map(l => l.post_id) || []);
            const savedSet = new Set(mySaves?.map(s => s.post_id) || []);

            const enriched = feedData.map(p => {
                const owner = userMap[p.user_id] || { username: 'Bilinmeyen', avatarUrl: `https://ui-avatars.com/api/?name=U&background=800020&color=fff` };
                const postComments = commentsData?.filter(c => c.post_id === p.id) || [];
                return {
                    ...p,
                    username: owner.username,
                    userAvatar: owner.avatarUrl,
                    isLiked: likedSet.has(p.id),
                    isSaved: savedSet.has(p.id),
                    likeCount: p.likes || 0,
                    previewComments: postComments.slice(0, 2).map(c => ({
                        ...c,
                        username: userMap[c.user_id]?.username || 'Bilinmeyen'
                    })),
                    totalComments: postComments.length
                };
            });

            setPosts(enriched);
            
            // Eğer kaydırma gerekmeyecekse hemen göster
            if (targetIdx <= 0) {
                setListOpacity(1);
            }
        } catch (e) {
            console.error("Feed error:", e);
        } finally {
            setLoading(false);
        }
    };

    // Data yüklendikten sonra scroll işlemini yap ve görünürlüğü aç
    useEffect(() => {
        if (posts.length > 0 && initialIndex > 0 && listOpacity === 0) {
            const timer1 = setTimeout(() => {
                if (flatListRef.current) {
                    flatListRef.current.scrollToIndex({ index: initialIndex, animated: false, viewPosition: 0 });
                }
                const timer2 = setTimeout(() => {
                    setListOpacity(1);
                }, 100);
                return () => clearTimeout(timer2);
            }, 100);
            return () => clearTimeout(timer1);
        }
    }, [posts, initialIndex, listOpacity]);

    const handleToggleLike = async (id: string, currentlyLiked: boolean) => {
        if (!user) return;
        
        // Optimistic
        setPosts(prev => prev.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    isLiked: !currentlyLiked,
                    likeCount: !currentlyLiked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1)
                };
            }
            return p;
        }));

        try {
            if (!currentlyLiked) {
                await supabase.from('post_likes').insert({ post_id: id, user_id: user.id });
                const post = posts.find(p => p.id === id);
                await supabase.from('posts').update({ likes: (post?.likeCount || 0) + 1 }).eq('id', id);
                
                if (post && post.user_id !== user.id) {
                    await supabase.from('notifications').insert([{
                        user_id: post.user_id,
                        actor_id: user.id,
                        type: 'like',
                        post_id: id
                    }]);
                }
            } else {
                await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id);
                const post = posts.find(p => p.id === id);
                await supabase.from('posts').update({ likes: Math.max(0, (post?.likeCount || 0) - 1) }).eq('id', id);
            }
        } catch (e) {
            console.log("Like error", e);
        }
    };

    const handleToggleSave = async (id: string, currentlySaved: boolean) => {
        if (!user) return;
        setPosts(prev => prev.map(p => p.id === id ? { ...p, isSaved: !currentlySaved } : p));

        try {
            if (!currentlySaved) {
                await supabase.from('saved_posts').insert({ post_id: id, user_id: user.id });
            } else {
                await supabase.from('saved_posts').delete().eq('post_id', id).eq('user_id', user.id);
            }
        } catch (e) {
            console.log("Save error", e);
        }
    };

    const handleBoostPost = async (post: any) => {
        router.push({ pathname: '/promote-post' as any, params: { postId: post.id } });
    };

    const openCommentSheet = (postId: string, ownerId: string) => {
        setActivePostId(postId);
        setActivePostOwnerId(ownerId);
        setCommentSheetVisible(true);
    };

    const openLikesSheet = (postId: string) => {
        setActivePostId(postId);
        setLikesSheetVisible(true);
    };

    const openShareSheet = (postId: string) => {
        setActivePostId(postId);
        setShareSheetVisible(true);
    };

    const handleReport = async (postId: string, reason: string) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('post_reports').insert({
                post_id: postId,
                reporter_id: user.id,
                reason: reason
            });
            if (error) throw error;
            Alert.alert("Başarılı", "Şikayetiniz iletildi.");
        } catch (e) {
            Alert.alert("Hata", "Şikayet gönderilemedi.");
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const images = item.image_url ? item.image_url.split(',') : [];

        return (
            <View style={[styles.postContainer, { borderBottomColor: borderColor }]}>
                {/* USER HEADER */}
                <View style={styles.userHeader}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => router.push({ pathname: '/user-profile' as any, params: { userId: item.user_id } })}
                    >
                        <Image
                            source={{ uri: item.userAvatar || `https://ui-avatars.com/api/?name=U&background=800020&color=fff` }}
                            style={styles.avatarSymbol}
                            contentFit="cover"
                        />
                        <View>
                            <Text style={[styles.username, { color: textColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => {
                            if (item.user_id === user?.id) {
                                Alert.alert(
                                    "Seçenekler",
                                    "Bu gönderi için ne yapmak istersiniz?",
                                    [
                                        { text: "Vazgeç", style: "cancel" },
                                        { text: "Gönderiyi Sil", style: "destructive", onPress: async () => {
                                            try {
                                                const { error } = await supabase.from('posts').delete().eq('id', item.id);
                                                if (error) throw error;
                                                // Eğer tek bir post bakılıyorsa geri dön, liste ise state'den çıkar
                                                if (posts.length === 1) {
                                                    router.back();
                                                } else {
                                                    setPosts(prev => prev.filter(p => p.id !== item.id));
                                                }
                                            } catch (e) {
                                                Alert.alert('Hata', 'Silinemedi.');
                                            }
                                        }}
                                    ]
                                );
                            } else {
                                Alert.alert("Seçenekler", "Bu gönderi için ne yapmak istersiniz?", [
                                    { text: "Vazgeç", style: "cancel" },
                                    { 
                                        text: "Şikayet Et", 
                                        style: "destructive",
                                        onPress: () => {
                                            Alert.alert(
                                                "Şikayet Et",
                                                "Neden şikayet ediyorsunuz?",
                                                [
                                                    { text: "Vazgeç", style: "cancel" },
                                                    { text: "Spam", onPress: () => handleReport(item.id, "Spam") },
                                                    { text: "Uygunsuz İçerik", onPress: () => handleReport(item.id, "Uygunsuz") },
                                                    { text: "Yanlış Bilgi", onPress: () => handleReport(item.id, "Yanlış Bilgi") },
                                                ]
                                            );
                                        }
                                    }
                                ]);
                            }
                        }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={24} color={textColor} />
                    </TouchableOpacity>
                </View>

                {/* POST IMAGE */}
                <View style={styles.imageWrapper}>
                  {images.length > 0 ? (
                    <ScrollView 
                        horizontal 
                        pagingEnabled 
                        showsHorizontalScrollIndicator={false}
                    >
                        {images.map((uri: string, index: number) => (
                            <View key={index} style={{ width: SCREEN_WIDTH }}>
                                <DynamicImage
                                    uri={uri}
                                    style={styles.postImage}
                                />
                                {images.length > 1 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: 10,
                                        right: 10,
                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 12,
                                    }}>
                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                            {index + 1}/{images.length}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.placeholderContainer}>
                      <Ionicons name="image-outline" size={48} color={subTextColor} />
                    </View>
                  )}

                  {item.is_recipe && (
                    <TouchableOpacity 
                        style={styles.recipeBadge}
                        onPress={() => router.push({ pathname: '/recipe-detail' as any, params: { recipeId: item.id } })}
                    >
                        <Ionicons name="restaurant" size={16} color="#fff" />
                        <Text style={styles.recipeBadgeText}>Tarifi Gör</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* ACTIONS */}
                <View style={styles.actions}>
                    <TouchableOpacity onPress={() => handleToggleLike(item.id, item.isLiked)} style={styles.actionBtn}>
                        <Ionicons name={item.isLiked ? "heart" : "heart-outline"} size={28} color={item.isLiked ? (isDark ? "#ff4d4d" : "red") : textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openCommentSheet(item.id, item.user_id)} style={styles.actionBtn}>
                        <Ionicons name="chatbubble-outline" size={26} color={textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openShareSheet(item.id)} style={styles.actionBtn}>
                        <Ionicons name="paper-plane-outline" size={26} color={textColor} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => handleToggleSave(item.id, item.isSaved)}>
                        <Ionicons name={item.isSaved ? "bookmark" : "bookmark-outline"} size={26} color={textColor} />
                    </TouchableOpacity>
                </View>

                {/* LIKES & CAPTION */}
                <View style={styles.infoContainer}>
                    <TouchableOpacity onPress={() => openLikesSheet(item.id)}>
                        <Text style={[styles.likeText, { color: textColor }]}>{item.likeCount} beğenme</Text>
                    </TouchableOpacity>

                    {item.description ? (
                        <View style={styles.captionRow}>
                            <Text style={[styles.captionUsername, { color: textColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                            <Text style={[styles.captionText, { color: textColor }]}>{item.description}</Text>
                        </View>
                    ) : null}

                    {/* ETİKETLER */}
                    {item.tags ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, marginBottom: 5 }}>
                            {item.tags.split(',').map((tag: string, index: number) => {
                                const cleanTag = tag.trim();
                                if(!cleanTag) return null;
                                return (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={{ backgroundColor: isDark ? '#333' : '#eee', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8, marginBottom: 5 }}
                                        onPress={() => router.push({ pathname: '/discover' as any, params: { search: cleanTag } })}
                                    >
                                        <Text style={{ color: isDark ? '#ccc' : '#555', fontSize: 12 }}>#{cleanTag}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : null}

                    {item.is_recipe && (
                        <TouchableOpacity 
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                marginTop: 5, 
                                marginBottom: 10,
                                paddingVertical: 10,
                                borderTopWidth: 0.5,
                                borderTopColor: isDark ? '#333' : '#f0f0f0',
                                borderBottomWidth: 0.5,
                                borderBottomColor: isDark ? '#333' : '#f0f0f0'
                            }}
                            onPress={() => router.push({ pathname: '/recipe-detail' as any, params: { recipeId: item.id } })}
                        >
                            <Ionicons name="restaurant-outline" size={20} color={primaryColor} />
                            <Text style={{ color: primaryColor, fontWeight: 'bold', marginLeft: 10, fontSize: 15 }}>Tarifi Gör</Text>
                            <Ionicons name="chevron-forward" size={18} color={primaryColor} style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                    )}

                    <Text style={[styles.dateText, { color: subTextColor }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>

                {/* PREVIEW COMMENTS */}
                <View style={styles.commentsSection}>
                    <TouchableOpacity onPress={() => openCommentSheet(item.id, item.user_id)}>
                        <Text style={{ color: subTextColor, fontSize: 14, marginBottom: 5 }}>
                            {item.totalComments > 0 ? `${item.totalComments} yorumun tümünü gör` : 'İlk yorumu yaz...'}
                        </Text>
                    </TouchableOpacity>
                    {item.previewComments?.map((comment: any) => (
                        <View key={comment.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={{ fontWeight: 'bold', marginRight: 5, color: textColor, fontSize: 13 }}>
                                {comment.username ? comment.username.replace(/^@/, '') : 'Bilinmeyen'}
                            </Text>
                            <Text style={{ color: textColor, fontSize: 13 }}>{comment.content}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>
                    {params.filterUserId ? 'Gönderiler' : 'Keşfet'}
                </Text>
                <View style={{ width: 28 }} />
            </View>

            {loading ? (
                <View style={[styles.center, { backgroundColor: bgColor }]}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            ) : posts.length === 0 ? (
                <View style={[styles.center, { backgroundColor: bgColor }]}>
                    <Text style={{ color: textColor }}>Gönderi bulunamadı.</Text>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={posts}
                    style={{ opacity: listOpacity }}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    initialNumToRender={50} // Ensure items up to index are rendered for scrollToIndex
                    onScrollToIndexFailed={(info) => {
                        setTimeout(() => {
                            if (flatListRef.current) {
                                flatListRef.current.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
                            }
                        }, 200);
                    }}
                />
            )}

            <CommentBottomSheet
                isVisible={commentSheetVisible}
                onClose={() => setCommentSheetVisible(false)}
                postId={activePostId}
                postOwnerId={activePostOwnerId}
            />
            <ShareBottomSheet
                isVisible={shareSheetVisible}
                onClose={() => setShareSheetVisible(false)}
                postId={activePostId}
            />
            <LikesBottomSheet
                isVisible={likesSheetVisible}
                onClose={() => setLikesSheetVisible(false)}
                postId={activePostId}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 0.5 },
    title: { fontSize: 18, fontWeight: 'bold' },
    
    postContainer: { borderBottomWidth: 0.5, paddingBottom: 15, marginBottom: 10 },
    userHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10 },
    avatarSymbol: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd', marginRight: 10 },
    username: { fontWeight: 'bold', fontSize: 14 },
    imageWrapper: { width: '100%' },
    postImage: { width: '100%' },
    placeholderContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    actions: { flexDirection: 'row', padding: 10, alignItems: 'center' },
    actionBtn: { marginRight: 15 },
    infoContainer: { paddingHorizontal: 12 },
    likeText: { fontWeight: 'bold', marginBottom: 5 },
    captionRow: { flexDirection: 'row', marginBottom: 5 },
    captionUsername: { fontWeight: 'bold', marginRight: 5 },
    captionText: { color: '#333' },
    dateText: { color: '#999', fontSize: 12, marginTop: 5 },
    commentsSection: { paddingHorizontal: 12, marginTop: 5 },
    recipeBadge: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    recipeBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
