import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from './services/supabaseConfig';

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
    const inputBg = isDark ? '#1e1e1e' : '#f9f9f9';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';
    const postId = params.postId as string;

    const [post, setPost] = useState<any>(null);
    const [postOwner, setPostOwner] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        if (postId) {
            fetchPostDetails();
            fetchComments();
        }
    }, [postId]);

    const fetchPostDetails = async () => {
        try {
            // 1. Post Detayı
            const { data: postData, error: postError } = await supabase
                .from('posts')
                .select('*')
                .eq('id', postId)
                .single();

            if (postError) throw postError;
            setPost(postData);
            setLikeCount(postData.likes || 0);

            // 2. Kullanıcı Bilgisi (Post Sahibi)
            let ownerData = null;

            // Önce profiles tablosuna bak
            const { data: profileData } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', postData.user_id)
                .single();

            if (profileData) {
                ownerData = profileData;
            } else {
                // Yoksa dietitians tablosuna bak
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
                // 3. Beğeni Durumu Kontrolü
                const { data: likeData } = await supabase
                    .from('post_likes')
                    .select('id')
                    .eq('post_id', postId)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (likeData) setLiked(true);

                // 4. Kaydetme Durumu Kontrolü
                const { data: saveData } = await supabase
                    .from('saved_posts')
                    .select('id')
                    .eq('post_id', postId)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (saveData) setSaved(true);
            }

        } catch (error) {
            console.error("Post detay hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async () => {
        try {
            console.log("Yorumlar çekiliyor...");
            const { data: commentsData, error } = await supabase
                .from('comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Yorum çekme hatası:", error);
                return;
            }

            if (!commentsData || commentsData.length === 0) {
                setComments([]);
                return;
            }

            // Yorum yapan kullanıcıların bilgilerini al
            const userIds = [...new Set(commentsData.map(c => c.user_id))];

            // Profiles ve Dietitians tablolarından kullanıcıları bul
            // Not: `in` operatörü ile toplu çekiyoruz
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', userIds);

            const { data: dietitians } = await supabase
                .from('dietitians')
                .select('id, username, profile_picture')
                .in('id', userIds);

            // Kullanıcıları bir map'e koyarak hızlı erişim sağla
            const userMap: Record<string, { username: string, avatar_url?: string }> = {};

            profiles?.forEach(p => {
                userMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
            });

            dietitians?.forEach(d => {
                // Eğer hem profile hem dietitian varsa, hangisi öncelikli? Genelde çakışmaz ama önlem alalım.
                if (!userMap[d.id]) {
                    userMap[d.id] = { username: d.username, avatar_url: d.profile_picture };
                }
            });

            // Yorumları kullanıcı verisiyle birleştir
            const enrichedComments = commentsData.map(c => ({
                ...c,
                username: userMap[c.user_id]?.username || 'Bilinmeyen Kullanıcı',
                avatar_url: userMap[c.user_id]?.avatar_url
            }));

            setComments(enrichedComments);

        } catch (err) {
            console.error("Yorum işlem hatası:", err);
        }
    };

    const handleLike = async () => {
        if (!user) return;

        const previousLiked = liked;
        const previousCount = likeCount;

        // Optimistik güncelleme
        const newLiked = !liked;
        const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

        setLiked(newLiked);
        setLikeCount(newCount);

        try {
            if (newLiked) {
                // Beğeni Ekle
                const { error: likeError } = await supabase
                    .from('post_likes')
                    .insert([{ post_id: postId, user_id: user.id }]);

                if (likeError) throw likeError;

                // Sayaç Arttır
                await supabase
                    .from('posts')
                    .update({ likes: newCount })
                    .eq('id', postId);

            } else {
                // Beğeni Kaldır
                const { error: unlikeError } = await supabase
                    .from('post_likes')
                    .delete()
                    .eq('post_id', postId)
                    .eq('user_id', user.id);

                if (unlikeError) throw unlikeError;

                // Sayaç Azalt
                await supabase
                    .from('posts')
                    .update({ likes: newCount })
                    .eq('id', postId);
            }

        } catch (error) {
            console.error("Like işlemi hatası:", error);
            // Hata durumunda geri al
            setLiked(previousLiked);
            setLikeCount(previousCount);
        }
    };

    const handleToggleSave = async () => {
        if (!user) return;
        const previousSaved = saved;
        setSaved(!saved); // Optimistic

        try {
            if (!previousSaved) {
                // Save
                const { error } = await supabase.from('saved_posts').insert({ post_id: postId, user_id: user.id });
                if (error) throw error;
            } else {
                // Unsave
                const { error } = await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', user.id);
                if (error) throw error;
            }
        } catch (e) {
            console.error("Save toggle error:", e);
            setSaved(previousSaved); // Revert
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim() || !user) return;

        const commentText = newComment.trim();
        setNewComment(''); // Temizle hemen

        try {
            const { error } = await supabase
                .from('comments')
                .insert([{
                    post_id: postId,
                    user_id: user.id,
                    content: commentText
                }]);

            if (error) {
                console.error("Yorum gönderme hatası:", error);
                alert("Yorum gönderilemedi.");
                setNewComment(commentText); // Geri koy
                return;
            }

            // Listeyi güncelle
            fetchComments();

        } catch (err) {
            console.error("Yorum hatası:", err);
            setNewComment(commentText);
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: bgColor }]}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        );
    }

    if (!post) {
        return (
            <View style={[styles.center, { backgroundColor: bgColor }]}>
                <Text style={{ color: textColor }}>Gönderi bulunamadı.</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>Gönderi</Text>
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

                {/* LIKES & CAPTION */}
                <View style={styles.infoContainer}>
                    <Text style={[styles.likeText, { color: textColor }]}>{likeCount} beğenme</Text>

                    {post.description ? (
                        <View style={styles.captionRow}>
                            <Text style={[styles.captionUsername, { color: textColor }]}>{postOwner?.username ? `@${postOwner.username}` : 'Kullanıcı'}</Text>
                            <Text style={[styles.captionText, { color: textColor }]}>{post.description}</Text>
                        </View>
                    ) : null}

                    <Text style={[styles.dateText, { color: subTextColor }]}>{new Date(post.created_at).toLocaleDateString()}</Text>
                </View>

                {/* COMMENTS SECTION */}
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

            {/* COMMENT INPUT */}
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
    captionRow: { flexDirection: 'row', marginBottom: 5 },
    captionUsername: { fontWeight: 'bold', marginRight: 5 },
    captionText: { color: '#333' },
    dateText: { color: '#999', fontSize: 12, marginTop: 5 },
    commentsSection: { paddingHorizontal: 12, marginTop: 10 },
    commentRow: { flexDirection: 'row', marginBottom: 5 },
    commentUser: { fontWeight: 'bold', marginRight: 5, fontSize: 13 },
    commentText: { fontSize: 13 },
    inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 0.5, borderColor: '#eee', alignItems: 'center' },
    input: { flex: 1, height: 40, backgroundColor: '#f9f9f9', borderRadius: 20, paddingHorizontal: 15 },
    sendText: { color: '#0095f6', fontWeight: 'bold', marginLeft: 10 }
});
