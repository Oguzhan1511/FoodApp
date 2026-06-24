import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseConfig';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    username: string;
    avatar_url: string | null;
    parent_id: string | null;
    like_count: number;
    is_liked: boolean;
    is_hidden: boolean;
    replies?: Comment[];
}

interface CommentBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    postId: string;
    postOwnerId: string;
}

export default function CommentBottomSheet({ isVisible, onClose, postId, postOwnerId }: CommentBottomSheetProps) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyTo, setReplyTo] = useState<Comment | null>(null);

    // Theme Colors
    const bgColor = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const inputBg = isDark ? '#2a2a2a' : '#f5f5f5';
    const borderColor = isDark ? '#333333' : '#eeeeee';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';

    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10
            }).start();
            fetchComments();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [isVisible]);

    const fetchComments = async () => {
        if (!postId) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(c => c.user_id))];

                // Fetch profiles
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', userIds);

                // Fetch dietitians
                const { data: dietitians } = await supabase
                    .from('dietitians')
                    .select('id, username, profile_picture')
                    .in('id', userIds);

                // Fetch my likes if user logged in
                const { data: myLikes } = user ? await supabase
                    .from('comment_likes')
                    .select('comment_id')
                    .eq('user_id', user.id)
                    .in('comment_id', data.map(c => c.id)) : { data: [] };

                // Fetch all like counts
                const { data: likeCounts } = await supabase
                    .rpc('get_comment_like_counts', { comment_ids: data.map(c => c.id) });
                // Note: get_comment_like_counts RPC might not exist, using a fallback fetch or Map later

                const userMap: Record<string, any> = {};
                profiles?.forEach(p => userMap[p.id] = p);
                dietitians?.forEach(d => userMap[d.id] = { ...d, avatar_url: d.profile_picture });

                const myLikesSet = new Set(myLikes?.map(l => l.comment_id));

                const enriched: Comment[] = data.map(c => ({
                    ...c,
                    username: userMap[c.user_id]?.username || 'Kullanıcı',
                    avatar_url: userMap[c.user_id]?.avatar_url || null,
                    is_liked: myLikesSet.has(c.id),
                    is_hidden: c.is_hidden || false,
                    like_count: 0 // Will handle via a separate count or RPC
                }));

                // Fetching individual counts logic (since RPC might not be there)
                const { data: allLikesData } = await supabase
                    .from('comment_likes')
                    .select('comment_id')
                    .in('comment_id', data.map(c => c.id));

                const countMap: Record<string, number> = {};
                allLikesData?.forEach(l => {
                    countMap[l.comment_id] = (countMap[l.comment_id] || 0) + 1;
                });

                enriched.forEach(c => {
                    c.like_count = countMap[c.id] || 0;
                });

                // Group by parent-child
                const roots = enriched.filter(c => !c.parent_id);
                const children = enriched.filter(c => c.parent_id);

                roots.forEach(parent => {
                    parent.replies = children.filter(child => child.parent_id === parent.id);
                });

                setComments(roots);
            } else {
                setComments([]);
            }
        } catch (error) {
            console.error("Fetch comments error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim() || !user || isSubmitting) return;

        const commentText = newComment.trim();
        setIsSubmitting(true);
        setNewComment('');
        Keyboard.dismiss();

        try {
            const { error } = await supabase
                .from('comments')
                .insert([{
                    post_id: postId,
                    user_id: user.id,
                    content: commentText,
                    parent_id: replyTo ? replyTo.id : null
                }]);

            if (error) throw error;

            // Trigger Notification
            if (replyTo) {
                // Notifying the comment owner about reply
                if (replyTo.user_id !== user.id) {
                    await supabase.from('notifications').insert([{
                        user_id: replyTo.user_id,
                        actor_id: user.id,
                        type: 'comment_reply',
                        post_id: postId,
                        content: commentText
                    }]);
                }
            } else if (postOwnerId !== user.id) {
                // Notifying the post owner about comment
                await supabase.from('notifications').insert([{
                    user_id: postOwnerId,
                    actor_id: user.id,
                    type: 'comment',
                    post_id: postId,
                    content: commentText
                }]);
            }

            setReplyTo(null);
            fetchComments();
        } catch (err) {
            console.error("Post comment error:", err);
            setNewComment(commentText);
            alert("Yorum gönderilemedi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleLikeComment = async (comment: Comment) => {
        if (!user) return;
        try {
            if (comment.is_liked) {
                await supabase
                    .from('comment_likes')
                    .delete()
                    .eq('comment_id', comment.id)
                    .eq('user_id', user.id);
            } else {
                await supabase
                    .from('comment_likes')
                    .insert({ comment_id: comment.id, user_id: user.id });

                if (comment.user_id !== user.id) {
                    await supabase.from('notifications').insert([{
                        user_id: comment.user_id,
                        actor_id: user.id,
                        type: 'comment_like',
                        post_id: postId
                    }]);
                }
            }
            fetchComments();
        } catch (err) {
            console.error("Like comment error:", err);
        }
    };

    const handleToggleHideComment = async (comment: Comment) => {
        const commentId = comment.id;
        const newHiddenStatus = !comment.is_hidden;

        console.log("--- Moderation Action ---");
        console.log("Action: Toggle Hide");
        console.log("Comment ID:", commentId, "Type:", typeof commentId);
        console.log("New Status:", newHiddenStatus);
        console.log("Current User:", user?.id);
        console.log("Post Owner:", postOwnerId);

        if (!user || user.id !== postOwnerId) {
            console.log("Permission denied: Current user is not the post owner");
            alert("Sadece kendi gönderinizdeki yorumları gizleyebilirsiniz.");
            return;
        }

        try {
            const { data, error, status, statusText } = await supabase
                .from('comments')
                .update({ is_hidden: newHiddenStatus })
                .eq('id', commentId)
                .select(); // select() help us see if rows were actually affected

            console.log("Supabase Response Status:", status, statusText);

            if (error) {
                console.error("Supabase error detail:", error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn("Update finished but 0 rows affected. Check RLS or ID.");
                alert("Yorum güncellenemedi. Yetki sorunu (RLS) olabilir.");
            } else {
                console.log("Update success! Row updated:", data[0]);
                fetchComments();
            }
        } catch (err) {
            console.error("Critical error in hiding comment:", err);
            alert("Gizleme işlemi başarısız. Lütfen internet bağlantınızı ve yetkilerinizi kontrol edin.");
        }
    };

    const handleClose = () => {
        setReplyTo(null);
        setNewComment('');
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true
        }).start(() => onClose());
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={() => { }}>
                        <Animated.View
                            style={[
                                styles.container,
                                {
                                    backgroundColor: bgColor,
                                    transform: [{ translateY: slideAnim }]
                                }
                            ]}
                        >
                            <View style={[styles.handle, { backgroundColor: borderColor }]} />

                            <View style={styles.header}>
                                <Text style={[styles.title, { color: textColor }]}>Yorumlar</Text>
                                <TouchableOpacity onPress={handleClose}>
                                    <Ionicons name="close" size={24} color={textColor} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.commentsList}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 20 }} />
                                ) : comments.length === 0 ? (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
                                        <Ionicons name="chatbubble-ellipses-outline" size={60} color={subTextColor} />
                                        <Text style={[styles.emptyText, { color: subTextColor }]}>İlk yorumu sen yap!</Text>
                                    </View>
                                ) : (
                                    comments.map((item) => {
                                        const isOwner = user?.id === postOwnerId;
                                        const isCommenter = user?.id === item.user_id;

                                        // DEBUG: LOG RENDERING INFO
                                        // console.log(`Rendering comment ${item.id} - is_hidden: ${item.is_hidden}, isOwner: ${isOwner}, isCommenter: ${isCommenter}`);

                                        // Filter: Only post owner (and maybe author) should see hidden comments
                                        // If hidden and user is not owner, don't show (even to author if user feels it's not hidden)
                                        if (item.is_hidden && !isOwner) return null;

                                        return (
                                            <View key={item.id} style={{ opacity: item.is_hidden ? 0.5 : 1 }}>
                                                <View style={styles.commentItem}>
                                                    <Image
                                                        source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.username}&background=random` }}
                                                        style={styles.avatar}
                                                        contentFit="cover"
                                                    />
                                                    <View style={styles.commentContent}>
                                                        <View style={styles.commentHeader}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Text style={[styles.commentUser, { color: textColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                                                                {item.is_hidden && (
                                                                    <View style={styles.hiddenBadge}>
                                                                        <Ionicons name="eye-off" size={10} color="#fff" />
                                                                        <Text style={styles.hiddenText}>Gizlendi</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text style={[styles.commentDate, { color: subTextColor }]}>
                                                                {new Date(item.created_at).toLocaleDateString('tr-TR')}
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.commentText, { color: textColor }]}>{item.content}</Text>

                                                        <View style={styles.commentActions}>
                                                            {!item.is_hidden && (
                                                                <TouchableOpacity onPress={() => handleToggleLikeComment(item)} style={styles.actionItem}>
                                                                    <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={16} color={item.is_liked ? "#ff3b30" : subTextColor} />
                                                                    <Text style={[styles.actionText, { color: subTextColor }]}>{item.like_count || 0}</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                            {!item.is_hidden && (
                                                                <TouchableOpacity onPress={() => setReplyTo(item)} style={styles.actionItem}>
                                                                    <Text style={[styles.actionText, { color: subTextColor, fontWeight: 'bold' }]}>Yanıtla</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                            {isOwner && (
                                                                <TouchableOpacity onPress={() => handleToggleHideComment(item)} style={styles.actionItem}>
                                                                    <Text style={[styles.actionText, { color: primaryColor, fontWeight: 'bold' }]}>
                                                                        {item.is_hidden ? 'Göster' : 'Gizle'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Replies */}
                                                {item.replies && item.replies.map(reply => {
                                                    const isReplyOwner = user?.id === reply.user_id;
                                                    if (reply.is_hidden && !isOwner) return null;

                                                    return (
                                                        <View key={reply.id} style={[styles.commentItem, styles.replyItem, { opacity: reply.is_hidden ? 0.5 : 1 }]}>
                                                            <Image
                                                                source={{ uri: reply.avatar_url || `https://ui-avatars.com/api/?name=${reply.username}&background=random` }}
                                                                style={styles.replyAvatar}
                                                                contentFit="cover"
                                                            />
                                                            <View style={styles.commentContent}>
                                                                <View style={styles.commentHeader}>
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                        <Text style={[styles.commentUser, { color: textColor }]}>{reply.username ? reply.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                                                                        {reply.is_hidden && (
                                                                            <View style={styles.hiddenBadge}>
                                                                                <Ionicons name="eye-off" size={8} color="#fff" />
                                                                                <Text style={[styles.hiddenText, { fontSize: 8 }]}>Gizlendi</Text>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                    <Text style={[styles.commentDate, { color: subTextColor }]}>
                                                                        {new Date(reply.created_at).toLocaleDateString('tr-TR')}
                                                                    </Text>
                                                                </View>
                                                                <Text style={[styles.commentText, { color: textColor }]}>{reply.content}</Text>
                                                                <View style={styles.commentActions}>
                                                                    {!reply.is_hidden && (
                                                                        <TouchableOpacity onPress={() => handleToggleLikeComment(reply)} style={styles.actionItem}>
                                                                            <Ionicons name={reply.is_liked ? "heart" : "heart-outline"} size={14} color={reply.is_liked ? "#ff3b30" : subTextColor} />
                                                                            <Text style={[styles.actionText, { color: subTextColor }]}>{reply.like_count || 0}</Text>
                                                                        </TouchableOpacity>
                                                                    )}
                                                                    {isOwner && (
                                                                        <TouchableOpacity onPress={() => handleToggleHideComment(reply)} style={styles.actionItem}>
                                                                            <Text style={[styles.actionText, { color: primaryColor, fontWeight: 'bold' }]}>
                                                                                {reply.is_hidden ? 'Göster' : 'Gizle'}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>

                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                            >
                                {replyTo && (
                                    <View style={[styles.replyHeader, { backgroundColor: inputBg }]}>
                                        <Text style={[styles.replyHeaderText, { color: subTextColor }]}>
                                            {replyTo.username ? replyTo.username.replace(/^@/, '') : 'Kullanıcı'} kullanıcısına yanıt veriliyor
                                        </Text>
                                        <TouchableOpacity onPress={() => setReplyTo(null)}>
                                            <Ionicons name="close-circle" size={18} color={subTextColor} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View style={[styles.inputWrapper, { borderColor: borderColor }]}>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                        placeholder="Yorum yap..."
                                        placeholderTextColor={subTextColor}
                                        value={newComment}
                                        onChangeText={setNewComment}
                                        multiline
                                    />
                                    <TouchableOpacity
                                        onPress={handleSendComment}
                                        disabled={!newComment.trim() || isSubmitting}
                                    >
                                        <Text style={[
                                            styles.sendButton,
                                            { color: newComment.trim() ? (isDark ? '#4dabf5' : '#0095f6') : subTextColor }
                                        ]}>
                                            Paylaş
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    container: {
        height: SCREEN_HEIGHT * 0.7,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 10
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    commentsList: {
        flex: 1
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    replyItem: {
        marginLeft: 45,
        marginTop: 5,
        marginBottom: 15
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12
    },
    replyAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 10
    },
    commentContent: {
        flex: 1
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    commentUser: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    commentText: {
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 6
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    actionText: {
        fontSize: 12,
    },
    commentDate: {
        fontSize: 11,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 15,
        fontStyle: 'italic'
    },
    hiddenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#666',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
        gap: 4
    },
    hiddenText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold'
    },
    replyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    replyHeaderText: {
        fontSize: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 0.5,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10
    },
    input: {
        flex: 1,
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        fontSize: 14,
        maxHeight: 100
    },
    sendButton: {
        marginLeft: 12,
        fontWeight: 'bold',
        fontSize: 14
    }
});
