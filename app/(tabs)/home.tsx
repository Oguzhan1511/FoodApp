import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router'; // 1. YÖNLENDİRME İÇİN BU EKLENDİ
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView, // Platform kontrolü için ekli kalsın
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// --- ÖRNEK VERİLER KALDIRILDI ---

import { useFocusEffect } from 'expo-router';
import CommentBottomSheet from '../../components/CommentBottomSheet';
import LikesBottomSheet from '../../components/LikesBottomSheet';
import ShareBottomSheet from '../../components/ShareBottomSheet';
import { useAuth } from '../AuthContext';
import { useStory } from '../StoryContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../services/supabaseConfig';

// ... (imports remain)

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export default function HomeScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { stories, fetchStories } = useStory();
  const isDark = theme === 'dark';

  // Dynamic Colors
  const bgColor = isDark ? '#121212' : '#f5f5f5';
  const cardColor = isDark ? '#1e1e1e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#333333';
  const subTextColor = isDark ? '#aaaaaa' : '#666666';
  const borderColor = isDark ? '#333333' : '#f0f0f0';
  const primaryColor = isDark ? '#ff4d4d' : '#A00020';

  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hasUnreadNotifications, setHasUnreadNotifications] = React.useState(false);

  // Comment & Share Bottom Sheet State
  const [commentSheetVisible, setCommentSheetVisible] = React.useState(false);
  const [activePost, setActivePost] = React.useState<{ id: string, ownerId: string } | null>(null);
  const [likesSheetVisible, setLikesSheetVisible] = React.useState(false);
  const [activeLikesPostId, setActiveLikesPostId] = React.useState<string | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = React.useState(false);
  const [sharePostId, setSharePostId] = React.useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        fetchFeed();
        fetchStories();
        checkUnreadNotifications();
      }
    }, [user?.id])
  );

  const checkUnreadNotifications = async () => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
      
      setHasUnreadNotifications(count !== null && count > 0);
    } catch (error) {
      console.log('Unread check error:', error);
    }
  };

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const myId = user?.id;
      if (!myId) return;

      // 1. Takip ettiklerimin ID'lerini bul
      const { data: followsData } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', myId)
        .eq('status', 'accepted');

      const friendIds = new Set<string>();
      followsData?.forEach((f: any) => {
        friendIds.add(f.following_id);
      });

      // 2. Takip ettiğim Diyetisyenlerin ID'lerini bul
      const { data: dietData } = await supabase
        .from('dietitian_follows')
        .select('dietitian_id')
        .eq('follower_id', myId);

      dietData?.forEach((d: any) => friendIds.add(d.dietitian_id));

      // Kendi gönderilerimizi de görelim
      friendIds.add(myId);

      const allIds = Array.from(friendIds);

      if (allIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // 3. Bu ID'lere ait postları çek
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', allIds)
        .order('created_at', { ascending: false });

      if (postError) console.error('Post error:', postError);

      if (!postData || postData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = postData.map(p => p.id);

      // 4. Bu postlara ait yorumları çek
      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      // 5. Post sahiplerinin ve yorum yapanların bilgilerini çek
      const postUserIds = postData.map(p => p.user_id);
      const commentUserIds = commentsData?.map(c => c.user_id) || [];

      // Tüm benzersiz kullanıcı ID'leri
      const allUserIds = [...new Set([...postUserIds, ...commentUserIds])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', allUserIds);

      const { data: dietitians } = await supabase
        .from('dietitians')
        .select('id, username, profile_picture')
        .in('id', allUserIds);

      // Map oluştur
      const userMap: Record<string, { username: string, avatar: string }> = {};

      profiles?.forEach(p => {
        userMap[p.id] = {
          username: p.username,
          avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}&background=random`
        };
      });

      dietitians?.forEach(d => {
        if (!userMap[d.id]) {
          userMap[d.id] = {
            username: d.username,
            avatar: d.profile_picture || `https://ui-avatars.com/api/?name=${d.username}&background=random`
          };
        }
      });

      // 6. Beğeni Durumlarını Çek
      const { data: myLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', myId)
        .in('post_id', postIds);

      const likedPostIds = new Set(myLikes?.map(l => l.post_id));

      // 7. Veriyi Birleştir
      // 7. Veriyi Birleştir

      // 7.1 Kaydedilenleri Çek
      const { data: savedData } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', myId)
        .in('post_id', postIds);

      const savedPostIds = new Set(savedData?.map(s => s.post_id));

      const enrichedPosts = postData.map(post => {
        // Bu posta ait yorumları bul ve kullanıcı adlarını ekle
        const postComments = (commentsData || [])
          .filter(c => c.post_id === post.id && !c.is_hidden)
          .map(c => ({
            ...c,
            username: userMap[c.user_id]?.username || 'Kullanıcı'
          }));

        return {
          ...post,
          username: userMap[post.user_id]?.username || 'Kullanıcı',
          userAvatar: userMap[post.user_id]?.avatar,
          time: new Date(post.created_at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          isLiked: likedPostIds.has(post.id),
          isSaved: savedPostIds.has(post.id),
          likeCount: post.likes || 0,
          comments: postComments
        };
      });

      setPosts(enrichedPosts);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };



  const handleToggleSave = async (postId: string, currentSaved: boolean) => {
    if (!user) return;

    // Optimistik UI
    setPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, isSaved: !currentSaved };
        }
        return p;
      })
    );

    try {
      if (!currentSaved) {
        // Kaydet
        const { error } = await supabase
          .from('saved_posts')
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      } else {
        // Kaldır
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Save error:", error);
      // Revert logic could go here
    }
  };

  const handleToggleLike = async (postId: string, currentLiked: boolean) => {
    if (!user) return;

    // 1. Optimistik UI Güncellemesi
    setPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id === postId) {
          const newLiked = !p.isLiked;
          return {
            ...p,
            isLiked: newLiked,
            likeCount: newLiked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1)
          };
        }
        return p;
      })
    );

    try {
      if (!currentLiked) {
        // Beğen
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;

        await supabase.rpc('increment_likes', { row_id: postId });

        const post = posts.find(p => p.id === postId);
        if (post) {
          await supabase.from('posts').update({ likes: post.likeCount + 1 }).eq('id', postId);

          // Trigger Notification
          if (post.user_id !== user.id) {
            await supabase.from('notifications').insert([{
              user_id: post.user_id,
              actor_id: user.id,
              type: 'like',
              post_id: postId
            }]);
          }
        }

      } else {
        // Vazgeç
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        const post = posts.find(p => p.id === postId);
        if (post) {
          await supabase.from('posts').update({ likes: Math.max(0, post.likeCount - 1) }).eq('id', postId);
        }
      }
    } catch (error) {
      console.error("Like error:", error);
      // Hata olursa geri al (Revert)
      // Basitlik adına burada tekrar fetchFeed yapabiliriz veya state'i geri alabiliriz.
      // Şimdilik console.log yeterli.
    }
  };

  // Sağa Kaydırma Hareketi (Kamera açar)
  const panGesture = Gesture.Pan()
    .activeOffsetX(10) // Hareketin başlaması için min X değişimi
    .onEnd((e) => {
      if (e.translationX > 50) { // Sağa doğru 50px'den fazla kaydırılırsa
        runOnJS(router.push)('/camera');
      }
    });

  const openCommentSheet = (postId: string, ownerId: string) => {
    setActivePost({ id: postId, ownerId });
    setCommentSheetVisible(true);
  };

  const openShareSheet = (postId: string) => {
    setSharePostId(postId);
    setShareSheetVisible(true);
  };

  const openLikesSheet = (postId: string) => {
    setActiveLikesPostId(postId);
    setLikesSheetVisible(true);
  };



  return (
    <GestureDetector gesture={panGesture}>
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        {/* 1. ÜST BAŞLIK (HEADER) */}
        <View style={[styles.header, { backgroundColor: bgColor }]}>
          <Text style={[styles.logoText, { color: primaryColor }]}>FoodApp</Text>

          <View style={styles.headerIcons}>
            {/* Bildirim İkonu */}
            <TouchableOpacity
              style={{ marginRight: 15 }}
              onPress={() => {
                setHasUnreadNotifications(false);
                router.push('/notifications');
              }}
            >
              <View>
                <Ionicons name="notifications-outline" size={26} color={textColor} />
                {hasUnreadNotifications && (
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    right: 2,
                    width: 10,
                    height: 10,
                    backgroundColor: '#ff3b30', // Modern iOS red
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: bgColor,
                  }} />
                )}
              </View>
            </TouchableOpacity>

            {/* 2. ARKADAŞLAR LİSTESİNE GİDEN BUTON */}
            <TouchableOpacity onPress={() => router.push('/friends')}>
              <Ionicons name="people-outline" size={26} color={textColor} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: bgColor }}>

          {/* 2. HİKAYELER ALANI (STORIES) */}
          <View style={styles.storiesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
              {stories.map((story) => (
                <View key={story.id} style={styles.storyItem}>
                  <TouchableOpacity
                    onPress={() => {
                      if (story.isMe && !story.hasStory) {
                        router.push({ pathname: '/camera', params: { mode: 'HIKAYE' } }); // Hikaye ekle modu ile git
                      } else {
                        router.push({ pathname: '/story-view', params: { userId: story.id } });
                      }
                    }}
                  >
                    <View style={[
                      styles.avatarContainer,
                      story.isMe && !story.hasStory && styles.myStoryBorder,
                      { borderColor: (story.isMe && !story.hasStory) ? borderColor : primaryColor }
                    ]}>
                      {story.isMe && !story.hasStory ? (
                        <View style={[styles.addStoryContainer, { backgroundColor: isDark ? '#333' : '#fff' }]}>
                          <Ionicons name="add" size={30} color={primaryColor} />
                        </View>
                      ) : (
                        <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                      )}
                    </View>
                  </TouchableOpacity>

                  <Text style={[styles.storyName, { color: textColor }]}>
                    {story.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />

          {/* 3. GÖNDERİLER (FEED) */}
          {loading ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : (
            <>
              {posts.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: subTextColor, textAlign: 'center' }}>
                    Henüz gönderi yok. Başka kullanıcıları veya diyetisyenleri takip ederek akışını renklendir!
                  </Text>
                </View>
              ) : (
                posts.map((post) => (
                  <View key={post.id} style={[styles.postContainer, { backgroundColor: cardColor }]}>

                    {/* Post Başlığı (User info) */}
                    <View style={styles.postHeader}>
                      <TouchableOpacity
                        style={styles.userInfo}
                        onPress={() => router.push({ pathname: "/user-profile", params: { userId: post.user_id } })}
                      >
                        <Image source={{ uri: post.userAvatar }} style={styles.postUserAvatar} />
                        <View>
                          <Text style={[styles.userName, { color: primaryColor }]}>{post.username}</Text>
                          <Text style={[styles.postTime, { color: subTextColor }]}>{post.time}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity>
                        <Ionicons name="ellipsis-horizontal" size={24} color={subTextColor} />
                      </TouchableOpacity>
                    </View>

                    {/* Post Görseli - Detaya Git */}
                    <TouchableOpacity onPress={() => router.push({ pathname: "/post-detail", params: { postId: post.id } })}>
                      <View style={styles.imageWrapper}>
                        <Image source={{ uri: post.image_url }} style={styles.postImage} />
                        {/* Kalori Rozeti */}
                        {post.calories && (
                          <View style={styles.kcalBadge}>
                            <FontAwesome5 name="fire" size={14} color="#FFD700" style={{ marginRight: 5 }} />
                            <Text style={styles.kcalText}>{post.calories} kcal</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Aksiyon Butonları (Like/Comment/Save) */}
                    <View style={styles.actionRow}>
                      <View style={styles.leftActions}>
                        <TouchableOpacity
                          style={{ marginRight: 15 }}
                          onPress={() => handleToggleLike(post.id, post.isLiked)}
                        >
                          <Ionicons
                            name={post.isLiked ? "heart" : "heart-outline"}
                            size={28}
                            color={post.isLiked ? primaryColor : textColor}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openCommentSheet(post.id, post.user_id)}>
                          <Ionicons name="chatbubble-outline" size={26} color={textColor} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openShareSheet(post.id)} style={{ marginLeft: 15 }}>
                          <Ionicons name="paper-plane-outline" size={26} color={textColor} />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity onPress={() => handleToggleSave(post.id, post.isSaved)}>
                        <Ionicons
                          name={post.isSaved ? "bookmark" : "bookmark-outline"}
                          size={26}
                          color={textColor}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Beğeni Sayısı */}
                    {post.likeCount > 0 && (
                      <TouchableOpacity 
                        style={{ paddingHorizontal: 10, marginBottom: 5 }}
                        onPress={() => openLikesSheet(post.id)}
                      >
                        <Text style={{ fontWeight: 'bold', color: textColor }}>{post.likeCount} beğenme</Text>
                      </TouchableOpacity>
                    )}

                    {/* Açıklama Kısmı */}
                    <View style={styles.captionContainer}>
                      <Text style={[styles.captionText, { color: textColor }]}>
                        <Text style={[styles.boldUserName, { color: primaryColor }]}>{post.username} </Text>
                        {post.description}
                      </Text>

                      {/* ETİKETLER */}
                      {post.tags ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                            {post.tags.split(',').map((tag: string, index: number) => {
                                const cleanTag = tag.trim();
                                if(!cleanTag) return null;
                                return (
                                    <View key={index} style={{ backgroundColor: isDark ? '#333' : '#f0f0f0', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8, marginBottom: 5 }}>
                                        <Text style={{ color: isDark ? '#ddd' : '#555', fontSize: 12 }}>#{cleanTag}</Text>
                                    </View>
                                );
                            })}
                        </View>
                      ) : null}
                    </View>

                    {/* Yorumlar Önizleme */}
                    {post.comments && post.comments.length > 0 && (
                      <View style={{ paddingHorizontal: 10, marginTop: 5 }}>
                        <TouchableOpacity onPress={() => openCommentSheet(post.id, post.user_id)}>
                          <Text style={{ color: subTextColor, marginBottom: 2 }}>
                            {post.comments.length} yorumun tümünü gör
                          </Text>
                        </TouchableOpacity>
                        {post.comments.filter((c: any) => !c.is_hidden).slice(0, 2).map((comment: any) => (
                          <View key={comment.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={{ fontWeight: 'bold', marginRight: 5, color: textColor, fontSize: 13 }}>
                              {comment.username ? comment.username.replace(/^@/, '') : 'Kullanıcı'}
                            </Text>
                            <Text style={{ color: textColor, fontSize: 13 }}>{comment.content}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}

          {/* Altta biraz boşluk bırakalım ki tab barın altında kalmasın */}
          <View style={{ height: 100 }} />
        </ScrollView>

        <CommentBottomSheet
          isVisible={commentSheetVisible}
          onClose={() => setCommentSheetVisible(false)}
          postId={activePost?.id || ''}
          postOwnerId={activePost?.ownerId || ''}
        />
        <ShareBottomSheet
          isVisible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          postId={sharePostId || ''}
        />
        <LikesBottomSheet
          isVisible={likesSheetVisible}
          onClose={() => setLikesSheetVisible(false)}
          postId={activeLikesPostId || ''}
        />
      </SafeAreaView>
    </GestureDetector>
  );
}

// --- STİLLER ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // Android'de status barın altına inmesini garantiye almak için:
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 10,
    // Ekstra üst boşluk (Gerekirse artırabilirsiniz)
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#A00020', // Görseldeki Bordo renk
  },
  headerIcons: {
    flexDirection: 'row',
  },
  // Stories
  storiesContainer: {
    paddingVertical: 15,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 15,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    borderColor: '#A00020',
    borderWidth: 2, // Kırmızı halka
    justifyContent: 'center',
    alignItems: 'center',
  },
  myStoryBorder: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addStoryContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#fff',
  },
  storyName: {
    marginTop: 5,
    fontSize: 12,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  // Post
  postContainer: {
    marginBottom: 20,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#A00020',
  },
  postTime: {
    fontSize: 11,
    color: '#888',
  },
  imageWrapper: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
    aspectRatio: 4 / 5, // Dikey foto desteği (0.8)
    resizeMode: 'cover'
  },
  kcalBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  kcalText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  captionContainer: {
    paddingHorizontal: 10,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  boldUserName: {
    fontWeight: 'bold',
    color: '#A00020',
  },
});