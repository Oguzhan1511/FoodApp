import React from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, Image, StyleSheet, ScrollView, Dimensions, Alert } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { DynamicImage } from './DynamicImage';
import { supabase } from '../services/supabaseConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostItemProps {
  post: any;
  cardColor: string;
  primaryColor: string;
  textColor: string;
  subTextColor: string;
  isDark: boolean;
  currentUserId?: string;
  onToggleLike: (postId: string, isLiked: boolean) => void;
  onToggleSave: (postId: string, isSaved: boolean) => void;
  onOpenCommentSheet: (postId: string, ownerId: string) => void;
  onOpenShareSheet: (postId: string) => void;
  onOpenLikesSheet: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
}

const PostItemComponent = ({
  post,
  cardColor,
  primaryColor,
  textColor,
  subTextColor,
  isDark,
  currentUserId,
  onToggleLike,
  onToggleSave,
  onOpenCommentSheet,
  onOpenShareSheet,
  onOpenLikesSheet,
  onDeletePost
}: PostItemProps) => {
  const [lastTap, setLastTap] = React.useState(0);
  const [showHeart, setShowHeart] = React.useState(false);
  const timerRef = React.useRef<any>(null);
  const images = post.image_url ? post.image_url.split(',') : [];

  const submitReport = async (postId: string, reason: string) => {
    if (!currentUserId) {
      Alert.alert("Hata", "Şikayet etmek için giriş yapmalısınız.");
      return;
    }
    try {
      const { error } = await supabase.from('post_reports').insert({
        post_id: postId,
        reporter_id: currentUserId,
        reason: reason
      });
      if (error) throw error;
      Alert.alert("Teşekkürler", "Şikayetiniz moderatörlerimize iletildi.");
    } catch (e) {
      console.error(e);
      Alert.alert("Hata", "İşlem şu an gerçekleştirilemiyor.");
    }
  };

  const handleImagePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // ÇİFT TIKLAMA TESPİT EDİLDİ
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      if (!post.isLiked) {
        onToggleLike(post.id, false);
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      setLastTap(0); // Reset
    } else {
      // İLK TIKLAMA VEYA TEK TIKLAMA
      setLastTap(now);
      
      // Navigasyonu biraz beklet (belki ikinci tık gelir)
      timerRef.current = setTimeout(() => {
        const pathname = post.is_recipe ? '/recipe-detail' : '/post-detail';
        const params = post.is_recipe ? { recipeId: post.id } : { postId: post.id };
        router.push({ pathname: pathname as any, params });
        timerRef.current = null;
      }, DOUBLE_PRESS_DELAY);
    }
  };

  // Oturum bazlı görüntülenme takibi (aynı reklamı tekrar tekrar saymamak için)
  const viewedPosts = React.useRef(new Set<string>());
 
   React.useEffect(() => {
     if (post.id && (post.is_sponsored || post._is_ad_render) && !viewedPosts.current.has(post.id)) {
         viewedPosts.current.add(post.id);
         incrementSponsorView(post.id);
     }
   }, [post.id]);
 
   const incrementSponsorView = async (postId: string) => {
     try {
         // Veritabanında sponsor_views sayısını 1 artır
         const { error } = await supabase.rpc('increment_sponsor_views', { row_id: postId, table_name: post._is_ad_render && post.username ? 'profiles' : 'posts' });
         
         // Eğer RPC yoksa (fallback)
         if (error) {
             const table = post._is_ad_render && post.username ? 'profiles' : 'posts';
             const { data: currentData } = await supabase.from(table).select('sponsor_views').eq('id', postId).single();
             const newCount = (currentData?.sponsor_views || 0) + 1;
             await supabase.from(table).update({ sponsor_views: newCount }).eq('id', postId);
         }
     } catch (e) {
         console.log("View increment error:", e);
     }
   };
 
   // Component unmount olduğunda timer'ı temizle
   React.useEffect(() => {
     return () => {
       if (timerRef.current) clearTimeout(timerRef.current);
     };
   }, []);

  return (
    <View style={[styles.postContainer, { backgroundColor: cardColor }]}>
      {/* Post Başlığı (User info) */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push({ pathname: '/user-profile' as any, params: { userId: post.user_id } })}
        >
          <Image source={{ uri: post.userAvatar }} style={styles.postUserAvatar} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.userName, { color: primaryColor }]}>{post.username}</Text>
              {post._is_ad_render && (
                <Text style={{ fontSize: 11, color: '#ff9900', marginLeft: 8, fontStyle: 'italic' }}>Sponsorlu</Text>
              )}
            </View>
            <Text style={[styles.postTime, { color: subTextColor }]}>{post.time}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (currentUserId && post.user_id === currentUserId) {
            Alert.alert(
              "Gönderiyi Sil",
              "Bu gönderiyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
              [
                { text: "İptal", style: "cancel" },
                { 
                  text: "Sil", 
                  style: "destructive", 
                  onPress: () => {
                    if (onDeletePost) onDeletePost(post.id);
                  } 
                }
              ]
            );
          } else {
            Alert.alert(
              "Seçenekler", 
              "Bu gönderi için ne yapmak istersiniz?", 
              [
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
                        { text: "Spam", onPress: () => submitReport(post.id, "Spam") },
                        { text: "Uygunsuz İçerik", onPress: () => submitReport(post.id, "Uygunsuz") },
                        { text: "Yanlış Bilgi", onPress: () => submitReport(post.id, "Yanlış Bilgi") },
                      ]
                    );
                  }
                }
              ]
            );
          }
        }}>
          <Ionicons name="ellipsis-horizontal" size={24} color={subTextColor} />
        </TouchableOpacity>
      </View>

      {/* Post Görseli - Detaya Git */}
      <View style={styles.imageWrapper}>
        {images.length > 0 ? (
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
          >
            {images.map((uri: string, index: number) => (
              <TouchableWithoutFeedback key={index} onPress={handleImagePress}>
                <View style={{ width: SCREEN_WIDTH }}>
                  <DynamicImage 
                    uri={uri} 
                    style={styles.postImage} 
                  />
                  {showHeart && (
                    <View style={styles.heartOverlay}>
                      <Ionicons name="heart" size={100} color="#fff" />
                    </View>
                  )}
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
              </TouchableWithoutFeedback>
            ))}
          </ScrollView>
        ) : (
          <TouchableWithoutFeedback onPress={handleImagePress}>
            <View style={styles.placeholderContainer}>
              <Ionicons name="image-outline" size={48} color={subTextColor} />
              <Text style={{ color: subTextColor, marginTop: 10 }}>Görsel yüklenemedi</Text>
            </View>
          </TouchableWithoutFeedback>
        )}
        
        {/* Sponsorlu Rozeti (Görsel Üzerinde) */}
        {post._is_ad_render && (
          <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#ffcc00', fontSize: 12, fontWeight: 'bold' }}>Sponsorlu 🚀</Text>
          </View>
        )}

        {/* Tarif Rozeti */}
        {post.is_recipe && (
          <View style={[styles.recipeTypeBadge, { position: 'absolute', top: 10, left: 10 }]}>
            <Ionicons name="restaurant" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.recipeTypeText}>TARİF</Text>
          </View>
        )}

        {/* Kalori Rozeti */}
        {post.calories && (
          <View style={styles.kcalBadge}>
            <FontAwesome5 name="fire" size={14} color="#FFD700" style={{ marginRight: 5 }} />
            <Text style={styles.kcalText}>{post.calories} kcal</Text>
          </View>
        )}
      </View>

      {/* Aksiyon Butonları (Like/Comment/Save) */}
      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={{ marginRight: 15 }}
            onPress={() => onToggleLike(post.id, post.isLiked)}
          >
            <Ionicons
              name={post.isLiked ? "heart" : "heart-outline"}
              size={28}
              color={post.isLiked ? primaryColor : textColor}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onOpenCommentSheet(post.id, post.user_id)}>
            <Ionicons name="chatbubble-outline" size={26} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onOpenShareSheet(post.id)} style={{ marginLeft: 15 }}>
            <Ionicons name="paper-plane-outline" size={26} color={textColor} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onToggleSave(post.id, post.isSaved)}>
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
          onPress={() => onOpenLikesSheet(post.id)}
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
                <TouchableOpacity 
                  key={index} 
                  style={{ backgroundColor: isDark ? '#333' : '#f0f0f0', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8, marginBottom: 5 }}
                  onPress={() => router.push({ pathname: '/discover' as any, params: { search: cleanTag } })}
                >
                  <Text style={{ color: isDark ? '#ddd' : '#666', fontSize: 12 }}>#{cleanTag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Yorumlar Önizleme */}
      {post.comments && post.comments.length > 0 && (
        <View style={{ paddingHorizontal: 10, marginTop: 5 }}>
          <TouchableOpacity onPress={() => onOpenCommentSheet(post.id, post.user_id)}>
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
  );
};

// React.memo ile sarmalayarak sadece kendi propları değiştiğinde render olmasını sağlıyoruz
export const PostItem = React.memo(PostItemComponent, (prevProps, nextProps) => {
  // Sadece post objesinin kritik alanları değiştiğinde re-render et
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.isLiked === nextProps.post.isLiked &&
    prevProps.post.isSaved === nextProps.post.isSaved &&
    prevProps.post.likeCount === nextProps.post.likeCount &&
    prevProps.post.comments?.length === nextProps.post.comments?.length
  );
});

const styles = StyleSheet.create({
  postContainer: {
    marginBottom: 15,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  postTime: {
    fontSize: 12,
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, // Kare format
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kcalBadge: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  kcalText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  recipeTypeBadge: {
    backgroundColor: 'rgba(128,0,32,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  recipeTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    paddingBottom: 10,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  boldUserName: {
    fontWeight: 'bold',
  },
});
