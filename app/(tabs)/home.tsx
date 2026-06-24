import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router'; // 1. YÖNLENDİRME İÇİN BU EKLENDİ
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView, // Platform kontrolü için ekli kalsın
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { Image } from 'expo-image';

// --- ÖRNEK VERİLER KALDIRILDI ---

import { useFocusEffect } from 'expo-router';
import CommentBottomSheet from '../../components/CommentBottomSheet';
import LikesBottomSheet from '../../components/LikesBottomSheet';
import ShareBottomSheet from '../../components/ShareBottomSheet';
import { PostItem } from '../../components/PostItem';
import { useAuth } from '../../context/AuthContext';
import { useStory } from '../../context/StoryContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabaseConfig';
import * as Notifications from 'expo-notifications';

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

      // 1 & 2. Takip ettiklerimin ID'lerini paralel olarak bul
      const [followsRes, dietitianFollowsRes] = await Promise.all([
        supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', myId)
          .eq('status', 'accepted'),
        supabase
          .from('dietitian_follows')
          .select('dietitian_id')
          .eq('follower_id', myId)
      ]);

      const friendIds = new Set<string>();
      followsRes.data?.forEach((f: any) => friendIds.add(f.following_id));
      dietitianFollowsRes.data?.forEach((d: any) => friendIds.add(d.dietitian_id));
      friendIds.add(myId);

      const allIds = Array.from(friendIds);

      // 3. Postları ve Sponsorlu Gönderileri Çek
      let organicData: any[] = [];
      if (allIds.length > 0) {
        const { data } = await supabase
          .from('posts')
          .select('id, user_id, image_url, description, likes, created_at, is_recipe, title, calories, tags, is_sponsored, sponsor_budget, sponsor_views')
          .in('user_id', allIds)
          .order('created_at', { ascending: false });
        organicData = data || [];
      }

      const [sponsoredRes, recentLikesRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id, user_id, image_url, description, likes, created_at, is_recipe, title, calories, tags, is_sponsored, sponsor_budget, sponsor_views')
          .eq('is_sponsored', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', myId)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      let finalData = organicData;
      
      // 3.1 İlgi Alanı Analizi (Top Tags)
      let topTags: string[] = [];
      if (recentLikesRes.data && recentLikesRes.data.length > 0) {
        const likedIds = recentLikesRes.data.map(l => l.post_id);
        const { data: likedPostsTags } = await supabase
          .from('posts')
          .select('tags')
          .in('id', likedIds);
          
        if (likedPostsTags) {
          const tagCounts: Record<string, number> = {};
          likedPostsTags.forEach(p => {
            if (p.tags) {
              p.tags.split(',').map((t: string) => t.trim().toLowerCase()).forEach((t: string) => {
                if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
              });
            }
          });
          topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
        }
      }

      // 3.5 Sponsorlu Düzenleme
      if (sponsoredRes.data) {
        let activeAds = sponsoredRes.data.filter(p => 
          (p.sponsor_budget || 0) > (p.sponsor_views || 0) &&
          !finalData.some(fd => fd.id === p.id)
        );
        if (activeAds.length > 0) {
          if (topTags.length > 0) {
            activeAds.sort((a, b) => {
              const aHas = a.tags?.split(',').some((t:any) => topTags.includes(t.trim().toLowerCase())) ? 1 : 0;
              const bHas = b.tags?.split(',').some((t:any) => topTags.includes(t.trim().toLowerCase())) ? 1 : 0;
              return bHas - aHas;
            });
          }

          // Merge Ads
          const merged: any[] = [];
          let adIndex = 0;
          for (let i = 0; i < finalData.length; i++) {
            merged.push(finalData[i]);
            if ((i + 1) % 3 === 0 && adIndex < activeAds.length) {
              merged.push({ ...activeAds[adIndex++], _is_ad_render: true });
            }
          }
          // Kalan sponsorlu gönderileri sona ekle (veya hiç organik post yoksa direkt bunları göster)
          while (adIndex < activeAds.length) {
            merged.push({ ...activeAds[adIndex++], _is_ad_render: true });
          }
          finalData = merged;
        }
      }

      if (finalData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = finalData.map(p => p.id);
      
      // Tüm post ve yorum sahiplerinin ID'lerini topla
      const { data: allComments } = await supabase.from('comments').select('user_id').in('post_id', postIds);
      const commentUserIds = allComments?.map(c => c.user_id) || [];
      const postUserIds = finalData.map(p => p.user_id);
      const allUserIds = [...new Set([...postUserIds, ...commentUserIds])];

      // 4, 5, 6, 7. Diğer tüm detayları paralel çek
      const [commentsRes, profilesRes, dietitiansRes, myLikesRes, savedRes] = await Promise.all([
        supabase.from('comments').select('id, post_id, user_id, content, created_at, is_hidden').in('post_id', postIds).order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, username, avatar_url').in('id', allUserIds),
        supabase.from('dietitians').select('id, username, profile_picture').in('id', allUserIds),
        supabase.from('post_likes').select('post_id').eq('user_id', myId).in('post_id', postIds),
        supabase.from('saved_posts').select('post_id').eq('user_id', myId).in('post_id', postIds)
      ]);

      // User Map Oluştur
      const userMap: Record<string, { username: string, avatar: string }> = {};
      profilesRes.data?.forEach(p => {
        userMap[p.id] = { username: p.username, avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}&background=random` };
      });
      dietitiansRes.data?.forEach(d => {
        if (!userMap[d.id]) {
          userMap[d.id] = { username: d.username, avatar: d.profile_picture || `https://ui-avatars.com/api/?name=${d.username}&background=random` };
        }
      });

      const likedSet = new Set(myLikesRes.data?.map(l => l.post_id));
      const savedSet = new Set(savedRes.data?.map(s => s.post_id));

      const enrichedPosts = finalData.map(post => {
        const postComments = (commentsRes.data || [])
          .filter(c => c.post_id === post.id && !c.is_hidden)
          .map(c => ({ ...c, username: userMap[c.user_id]?.username || 'Kullanıcı' }));

        return {
          ...post,
          username: userMap[post.user_id]?.username || 'Kullanıcı',
          userAvatar: userMap[post.user_id]?.avatar,
          time: new Date(post.created_at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          isLiked: likedSet.has(post.id),
          isSaved: savedSet.has(post.id),
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



  const handleToggleSave = React.useCallback(async (postId: string, currentSaved: boolean) => {
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
  }, [user]);

  const handleToggleLike = React.useCallback(async (postId: string, currentLiked: boolean) => {
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
    }
  }, [user, posts]);

  // Kaydırma Hareketi (Sağ: Kamera, Sol: Arkadaşlar)
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Hareketin başlaması için min X değişimi
    .onEnd((e) => {
      if (e.translationX > 50) { // Sağa doğru 50px'den fazla kaydırılırsa (Kamera - Soldan gelir)
        runOnJS(router.push)('/camera' as any);
      } else if (e.translationX < -50) { // Sola doğru 50px'den fazla kaydırılırsa (Arkadaşlar - Sağdan gelir)
        runOnJS(router.push)('/friends' as any);
      }
    });

  const openCommentSheet = React.useCallback((postId: string, ownerId: string) => {
    setActivePost({ id: postId, ownerId });
    setCommentSheetVisible(true);
  }, []);

  const openShareSheet = React.useCallback((postId: string) => {
    setSharePostId(postId);
    setShareSheetVisible(true);
  }, []);

  const openLikesSheet = React.useCallback((postId: string) => {
    setActiveLikesPostId(postId);
    setLikesSheetVisible(true);
  }, []);

  const handleDeletePost = React.useCallback(async (postId: string) => {
    if (!user) return;
    try {
      setPosts(prev => prev.filter(p => p.id !== postId));
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) {
        throw error;
      }
    } catch (e) {
      console.log('Post delete error', e);
      Alert.alert('Hata', 'Gönderi silinirken bir hata oluştu.');
    }
  }, [user]);

  const renderItem = React.useCallback(({ item }: { item: any }) => (
    <PostItem
      post={item}
      cardColor={cardColor}
      primaryColor={primaryColor}
      textColor={textColor}
      subTextColor={subTextColor}
      isDark={isDark}
      currentUserId={user?.id}
      onToggleLike={handleToggleLike}
      onToggleSave={handleToggleSave}
      onOpenCommentSheet={openCommentSheet}
      onOpenShareSheet={openShareSheet}
      onOpenLikesSheet={openLikesSheet}
      onDeletePost={handleDeletePost}
    />
  ), [cardColor, primaryColor, textColor, subTextColor, isDark, user?.id, handleToggleLike, handleToggleSave, openCommentSheet, openShareSheet, openLikesSheet, handleDeletePost]);

  const renderHeader = React.useCallback(() => (
    <View style={[styles.storiesContainer, { backgroundColor: bgColor }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
        {/* Tüm Hikayeler (Önce "Sen", sonra diğerleri) */}
        {stories.map((storyUser: any) => {
          const isMe = storyUser.isMe;
          const hasStory = storyUser.hasStory;
          const allViewed = storyUser.allViewed;

          return (
            <View key={storyUser.id} style={styles.storyItem}>
              <TouchableOpacity 
                style={[
                  styles.avatarContainer, 
                  hasStory ? { borderColor: allViewed ? '#ddd' : primaryColor } : styles.myStoryBorder
                ]}
                onPress={() => {
                  if (hasStory) {
                    router.push({ pathname: '/story-view' as any, params: { userId: storyUser.id }});
                  } else if (isMe) {
                    router.push({ pathname: '/camera' as any, params: { mode: 'HIKAYE' } });
                  }
                }}
              >
                {/* Görsel Katmanı */}
                <View style={styles.addStoryContainer}>
                  <Image 
                    source={storyUser.avatar} 
                    style={[styles.storyAvatar, !hasStory && isMe && { opacity: 0.7 }]} 
                    contentFit="cover"
                    transition={200}
                    onError={(e) => console.log("Story Image Load Error:", e)}
                  />
                  {!hasStory && isMe && (
                    <View style={{ 
                      position: 'absolute', 
                      bottom: -2, 
                      right: -2, 
                      backgroundColor: primaryColor, 
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: bgColor
                    }}>
                      <Ionicons name="add" size={14} color="#fff" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <Text style={[styles.storyName, { color: textColor }]} numberOfLines={1}>
                {isMe ? 'Sen' : storyUser.name}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.divider} />
    </View>
  ), [stories, bgColor, primaryColor, textColor]);

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
                router.push('/notifications' as any);
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
            <TouchableOpacity onPress={() => router.push('/friends' as any)}>
              <Ionicons name="people-outline" size={26} color={textColor} />
            </TouchableOpacity>
          </View>
        </View>
        {/* 3. GÖNDERİLER (FEED) */}
        {loading ? (
          <View style={{ padding: 20 }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            // Optimizasyon Ayarları:
            initialNumToRender={3}      // İlk başta sadece 3 post yükle (Ekrana sığan)
            maxToRenderPerBatch={3}     // Scroll ettikçe 3'er 3'er çiz
            windowSize={5}              // Ekranda görünenin 2 üstü, 2 altını hafızada tut
            removeClippedSubviews={true} // Görünmeyen postları render ağacından sil (Android için harika)
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: subTextColor, textAlign: 'center' }}>
                  Henüz gönderi yok. Başka kullanıcıları veya diyetisyenleri takip ederek akışını renklendir!
                </Text>
              </View>
            }
          />
        )}

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