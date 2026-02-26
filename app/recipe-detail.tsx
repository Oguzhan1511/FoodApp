import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from './services/supabaseConfig';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RecipeDetailScreen() {
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
    const inputBg = isDark ? '#1e1e1e' : '#f9f9f9';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';

    const recipeId = params.recipeId as string;

    const [post, setPost] = useState<any>(null);
    const [postOwner, setPostOwner] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');

    // Toggle for Recipe Details
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (recipeId) {
            fetchPostDetails();
            fetchComments();
        }
    }, [recipeId]);

    const fetchPostDetails = async () => {
        try {
            const { data: postData, error: postError } = await supabase
                .from('posts')
                .select('*')
                .eq('id', recipeId)
                .single();

            if (postError) throw postError;
            setPost(postData);
            setLikeCount(postData.likes || 0);

            // Fetch Owner
            let ownerData = null;
            const { data: profileData } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', postData.user_id)
                .single();

            if (profileData) {
                ownerData = profileData;
            } else {
                const { data: dietData } = await supabase
                    .from('dietitians')
                    .select('username, profile_picture')
                    .eq('id', postData.user_id)
                    .single();

                if (dietData) {
                    ownerData = {
                        username: dietData.username,
                        avatar_url: dietData.profile_picture
                    };
                }
            }
            setPostOwner(ownerData);

            if (user?.id) {
                const { data: likeData } = await supabase
                    .from('post_likes')
                    .select('id')
                    .eq('post_id', recipeId)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (likeData) setLiked(true);

                const { data: saveData } = await supabase
                    .from('saved_posts')
                    .select('id')
                    .eq('post_id', recipeId)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (saveData) setSaved(true);
            }

        } catch (error) {
            console.error("Recipe detail error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async () => {
        try {
            const { data: commentsData, error } = await supabase
                .from('comments')
                .select('*')
                .eq('post_id', recipeId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (!commentsData || commentsData.length === 0) {
                setComments([]);
                return;
            }

            const userIds = [...new Set(commentsData.map(c => c.user_id))];

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', userIds);

            const { data: dietitians } = await supabase
                .from('dietitians')
                .select('id, username, profile_picture')
                .in('id', userIds);

            const userMap: Record<string, { username: string, avatar_url?: string }> = {};

            profiles?.forEach(p => {
                userMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
            });

            dietitians?.forEach(d => {
                if (!userMap[d.id]) {
                    userMap[d.id] = { username: d.username, avatar_url: d.profile_picture };
                }
            });

            const enrichedComments = commentsData.map(c => ({
                ...c,
                username: userMap[c.user_id]?.username || 'Bilinmeyen Kullanıcı',
                avatar_url: userMap[c.user_id]?.avatar_url
            }));

            setComments(enrichedComments);
        } catch (err) {
            console.error("Comment fetch error:", err);
        }
    };

    const handleLike = async () => {
        if (!user) return;
        const previousLiked = liked;
        const previousCount = likeCount;

        const newLiked = !liked;
        const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

        setLiked(newLiked);
        setLikeCount(newCount);

        try {
            if (newLiked) {
                const { error } = await supabase.from('post_likes').insert([{ post_id: recipeId, user_id: user.id }]);
                if (error) throw error;
                await supabase.from('posts').update({ likes: newCount }).eq('id', recipeId);
            } else {
                const { error } = await supabase.from('post_likes').delete().eq('post_id', recipeId).eq('user_id', user.id);
                if (error) throw error;
                await supabase.from('posts').update({ likes: newCount }).eq('id', recipeId);
            }
        } catch (error) {
            console.error("Like error:", error);
            setLiked(previousLiked);
            setLikeCount(previousCount);
        }
    };

    const handleToggleSave = async () => {
        if (!user) return;
        const previousSaved = saved;
        setSaved(!saved);

        try {
            if (!previousSaved) {
                const { error } = await supabase.from('saved_posts').insert({ post_id: recipeId, user_id: user.id });
                if (error) throw error;
            } else {
                const { error } = await supabase.from('saved_posts').delete().eq('post_id', recipeId).eq('user_id', user.id);
                if (error) throw error;
            }
        } catch (e) {
            console.error("Save error:", e);
            setSaved(previousSaved);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim() || !user) return;
        const commentText = newComment.trim();
        setNewComment('');

        try {
            const { error } = await supabase
                .from('comments')
                .insert([{
                    post_id: recipeId,
                    user_id: user.id,
                    content: commentText
                }]);

            if (error) {
                console.error("Send comment error:", error);
                setNewComment(commentText);
                return;
            }
            fetchComments();
        } catch (err) {
            console.error(err);
            setNewComment(commentText);
        }
    };

    const toggleDetails = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowDetails(!showDetails);
    };

    if (loading) return <View style={[styles.center, { backgroundColor: bgColor }]}><ActivityIndicator size="large" color={primaryColor} /></View>;
    if (!post) return <View style={[styles.center, { backgroundColor: bgColor }]}><Text style={{ color: textColor }}>Tarif bulunamadı.</Text></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>Tarif Detayı</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* USER HEADER */}
                <TouchableOpacity
                    style={styles.userHeader}
                    onPress={() => router.push({ pathname: '/user-profile', params: { userId: post.user_id } })}
                >
                    <Image
                        source={{ uri: postOwner?.avatar_url || `https://ui-avatars.com/api/?name=${postOwner?.username || 'U'}&background=800020&color=fff` }}
                        style={styles.avatarSymbol}
                        contentFit="cover"
                    />
                    <Text style={[styles.username, { color: textColor }]}>{postOwner?.username ? `@${postOwner.username}` : 'Kullanıcı'}</Text>
                </TouchableOpacity>

                {/* POST IMAGE */}
                <Image
                    source={{ uri: post.image_url }}
                    style={styles.postImage}
                    contentFit="cover"
                />

                {/* ACTIONS */}
                <View style={styles.actions}>
                    <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
                        <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? (isDark ? "#ff4d4d" : "red") : textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Ionicons name="chatbubble-outline" size={26} color={textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleToggleSave} style={styles.actionBtn}>
                        <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={26} color={textColor} />
                    </TouchableOpacity>
                </View>

                {/* INFO CONTAINER */}
                <View style={styles.infoContainer}>
                    <Text style={[styles.likeText, { color: textColor }]}>{likeCount} beğenme</Text>

                    {/* CAPTION */}
                    {post.description ? (
                        <View style={styles.captionRow}>
                            <Text style={[styles.captionUsername, { color: textColor }]}>{postOwner?.username ? `@${postOwner.username}` : 'Kullanıcı'}</Text>
                            <Text style={[styles.captionText, { color: textColor }]}>{post.description}</Text>
                        </View>
                    ) : null}

                    {/* NEW: EXPANDABLE RECIPE DETAILS */}
                    <TouchableOpacity onPress={toggleDetails} style={styles.toggleBtn}>
                        <Text style={[styles.toggleText, { color: subTextColor }]}>
                            {showDetails ? "Detayları Gizle" : "Tarif Detayını Gör"}
                        </Text>
                        <Ionicons name={showDetails ? "chevron-up" : "chevron-down"} size={16} color={subTextColor} />
                    </TouchableOpacity>

                    {showDetails && (
                        <View style={[styles.recipeDetails, { backgroundColor: isDark ? '#1e1e1e' : '#f8f9fa' }]}>
                            {post.title && <Text style={[styles.recipeTitle, { color: textColor }]}>{post.title}</Text>}
                            {post.calories > 0 && <Text style={[styles.calories, { color: primaryColor }]}>🔥 {post.calories} kcal</Text>}

                            <Text style={[styles.sectionTitle, { color: textColor }]}>Malzemeler ve Yapılış</Text>
                            <Text style={[styles.recipeText, { color: textColor }]}>{post.ingredients}</Text>
                        </View>
                    )}

                    <Text style={[styles.dateText, { color: subTextColor }]}>{new Date(post.created_at).toLocaleDateString()}</Text>
                </View>

                {/* COMMENTS */}
                <View style={styles.commentsSection}>
                    {comments.map(comment => (
                        <View key={comment.id} style={styles.commentRow}>
                            <Text style={[styles.commentUser, { color: textColor }]}>
                                {comment.username ? `@${comment.username}` : 'Kullanıcı'}
                            </Text>
                            <Text style={[styles.commentText, { color: textColor }]}>{comment.content}</Text>
                        </View>
                    ))}
                    {comments.length === 0 && (
                        <Text style={{ color: subTextColor, fontSize: 13, marginTop: 5 }}>Henüz yorum yok.</Text>
                    )}
                </View>

            </ScrollView>

            {/* INPUT */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
                <View style={[styles.inputContainer, { borderColor: borderColor }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                        placeholder="Yorum yap..."
                        placeholderTextColor={subTextColor}
                        value={newComment}
                        onChangeText={setNewComment}
                    />
                    <TouchableOpacity onPress={handleSendComment}>
                        <Text style={[styles.sendText, { color: isDark ? '#4dabf5' : '#0095f6' }]}>Paylaş</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 0.5, borderColor: '#eee' },
    title: { fontSize: 18, fontWeight: 'bold' },
    scrollContent: { paddingBottom: 20 },
    userHeader: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    avatarSymbol: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd', marginRight: 10 },
    username: { fontWeight: 'bold', fontSize: 14 },
    postImage: { width: '100%', aspectRatio: 4 / 5 },
    actions: { flexDirection: 'row', padding: 10 },
    actionBtn: { marginRight: 15 },
    infoContainer: { paddingHorizontal: 12 },
    likeText: { fontWeight: 'bold', marginBottom: 5 },
    captionRow: { flexDirection: 'row', marginBottom: 5, flexWrap: 'wrap' },
    captionUsername: { fontWeight: 'bold', marginRight: 5 },
    captionText: { color: '#333' },
    dateText: { color: '#999', fontSize: 12, marginTop: 5 },
    commentsSection: { paddingHorizontal: 12, marginTop: 10 },
    commentRow: { flexDirection: 'row', marginBottom: 5, flexWrap: 'wrap' },
    commentUser: { fontWeight: 'bold', marginRight: 5, fontSize: 13 },
    commentText: { fontSize: 13 },
    inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 0.5, borderColor: '#eee', alignItems: 'center' },
    input: { flex: 1, height: 40, backgroundColor: '#f9f9f9', borderRadius: 20, paddingHorizontal: 15 },
    sendText: { color: '#0095f6', fontWeight: 'bold', marginLeft: 10 },

    // New Styles
    toggleBtn: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
    toggleText: { fontSize: 14, marginRight: 5, fontWeight: '600' },
    recipeDetails: { padding: 15, borderRadius: 12, marginTop: 5, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    recipeTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
    calories: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 6, textDecorationLine: 'none', color: '#666' },
    recipeText: { fontSize: 15, lineHeight: 24 }
});
