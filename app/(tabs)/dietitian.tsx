import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabaseConfig';

const THEME_COLOR = '#800020';

interface Dietitian {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  profile_picture?: string;
}

interface InboxUser {
  id: string;
  username: string;
  ad: string;
  soyad: string;
  avatar_url?: string;
  last_message?: string;
  message_time?: string;
}

export default function DietitianScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Dynamic Colors
  const bgColor = isDark ? '#121212' : '#fff';
  const textColor = isDark ? '#fff' : '#000';
  const subTextColor = isDark ? '#aaa' : '#666';
  const cardBg = isDark ? '#1e1e1e' : '#fff';
  const borderColor = isDark ? '#333' : '#eee';
  const inputBg = isDark ? '#1e1e1e' : '#f5f5f5';
  const primaryColor = isDark ? '#ff4d4d' : '#800020';

  const uid = user?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [dietitians, setDietitians] = useState<Dietitian[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [isDietitian, setIsDietitian] = useState(false);
  const [inboxUsers, setInboxUsers] = useState<InboxUser[]>([]);
  const [userDietitianChats, setUserDietitianChats] = useState<any[]>([]);

  useEffect(() => {
    if (uid) {
      checkIfDietitian();
    }
  }, [uid]);

  const loadData = useCallback(() => {
    if (isDietitian) {
      fetchInbox();
    } else {
      fetchDietitians();
      if (uid) {
        fetchFollowingStatus();
        fetchUserDietitianChats();
      }
    }
  }, [isDietitian, uid]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!uid) return;

    // Gerçek zamanlı mesaj dinleyicisi
    const channel = supabase
      .channel(`dietitian-realtime-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.receiver_id === uid || newMsg.sender_id === uid) {
            // Mesaj gelince (veya gidince) listeleri yenile
            if (isDietitian) {
              fetchInbox();
            } else {
              fetchUserDietitianChats();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, isDietitian]);


  const checkIfDietitian = async () => {
    const { data } = await supabase
      .from('dietitians')
      .select('id')
      .eq('id', uid)
      .single();

    if (data) setIsDietitian(true);
  };

  // Diyetisyen'in mesaj kutusunu çek (kendisine yazan kullanıcılar)
  const fetchInbox = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // 1. Diyetisyene gelen/giden tüm mesajları çek
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) {
        setInboxUsers([]);
        return;
      }

      // 2. Her partner'dan en son mesajı bul ve okunmamışları say
      const latestMap = new Map<string, any>();
      const unreadCounts = new Map<string, number>();
      
      messages.forEach(msg => {
        const partnerId = msg.sender_id === uid ? msg.receiver_id : msg.sender_id;
        if (partnerId && !latestMap.has(partnerId)) {
          latestMap.set(partnerId, msg);
        }
        if (msg.receiver_id === uid && !msg.is_read) {
          unreadCounts.set(partnerId, (unreadCounts.get(partnerId) || 0) + 1);
        }
      });

      const partnerIds = Array.from(latestMap.keys());
      if (partnerIds.length === 0) return;

      // 3. Partner profillerini çek
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, ad, soyad, avatar_url')
        .in('id', partnerIds);

      if (profiles) {
        const inboxList: any[] = profiles.map(p => ({
          id: p.id,
          username: p.username,
          ad: p.ad || '',
          soyad: p.soyad || '',
          avatar_url: p.avatar_url,
          last_message: latestMap.get(p.id)?.content,
          message_time: latestMap.get(p.id)?.created_at,
          unread_count: unreadCounts.get(p.id) || 0
        }));
        // Sort by message time
        inboxList.sort((a, b) => new Date(b.message_time).getTime() - new Date(a.message_time).getTime());
        setInboxUsers(inboxList);
      }
    } catch (e) {
      console.error('fetchInbox hatası:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDietitianChats = async () => {
    if (!uid) return;
    try {
      // 1. Kullanıcının tüm mesajlarını çek
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) return;

      // 2. Partner ID'leri bul ve okunmamışları say
      const partnerIds = new Set<string>();
      const latestMap = new Map();
      const unreadCounts = new Map<string, number>();
      
      messages.forEach(msg => {
        const pId = msg.sender_id === uid ? msg.receiver_id : msg.sender_id;
        if (pId && !latestMap.has(pId)) {
          latestMap.set(pId, msg);
          partnerIds.add(pId);
        }
        if (msg.receiver_id === uid && !msg.is_read) {
          unreadCounts.set(pId, (unreadCounts.get(pId) || 0) + 1);
        }
      });

      // 3. Hangileri diyetisyen kontrol et
      const { data: dietitians } = await supabase
        .from('dietitians')
        .select('id, username, first_name, last_name, profile_picture')
        .in('id', Array.from(partnerIds));

      if (dietitians && dietitians.length > 0) {
        const chats = dietitians.map(d => ({
          ...d,
          last_message: latestMap.get(d.id)?.content,
          message_time: latestMap.get(d.id)?.created_at,
          unread_count: unreadCounts.get(d.id) || 0
        }));
        // Sort by message time
        chats.sort((a, b) => new Date(b.message_time).getTime() - new Date(a.message_time).getTime());
        setUserDietitianChats(chats);
      }
    } catch (e) {
      console.error(e);
    }
  };


  // 1. Diyetisyenleri Çek (veya Ara)
  const fetchDietitians = async (queryText = '') => {
    setLoading(true);
    try {
      let query = supabase
        .from('dietitians')
        .select('id, username, first_name, last_name, is_verified, profile_picture');

      if (queryText.length > 0) {
        query = query.or(`username.ilike.%${queryText}%,first_name.ilike.%${queryText}%,last_name.ilike.%${queryText}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Diyetisyenleri çekme hatası:', error.message, error.code, error.hint);
      } else {
        setDietitians(data || []);
      }
    } catch (e) {
      console.error('Diyetisyen fetch exception:', e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Takip Durumlarını Çek
  const fetchFollowingStatus = async () => {
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from('dietitian_follows')
        .select('dietitian_id')
        .eq('follower_id', uid);

      if (error) {
        // Tablo yoksa sessizce geç
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('dietitian_follows tablosu henüz oluşturulmamış, atlanıyor.');
          return;
        }
        console.error('Takip verisi hatası:', error.message, error.code, error.hint);
      } else if (data) {
        const ids = new Set(data.map((item) => item.dietitian_id));
        setFollowingIds(ids);
      }
    } catch (e) {
      console.error('Takip fetch exception:', e);
    }
  };

  // 3. Arama Handler
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!isDietitian) fetchDietitians(text);
  };

  const handleFollow = async (dietitianId: string) => {
    // ... same as before
    setActionLoading(dietitianId);
    try {
      const { error } = await supabase
        .from('dietitian_follows')
        .insert([{ follower_id: uid, dietitian_id: dietitianId }]);

      if (error) throw error;
      setFollowingIds(prev => new Set(prev).add(dietitianId));
    } catch (e) {
      Alert.alert("Hata", "Takip edilemedi.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfollow = async (dietitianId: string) => {
    // ... same as before
    setActionLoading(dietitianId);
    try {
      const { error } = await supabase
        .from('dietitian_follows')
        .delete()
        .eq('follower_id', uid)
        .eq('dietitian_id', dietitianId);

      if (error) throw error;
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(dietitianId);
        return next;
      });
    } catch (e) {
      Alert.alert("Hata", "Takip bırakılamadı.");
    } finally {
      setActionLoading(null);
    }
  };

  const renderDietitianItem = ({ item }: { item: Dietitian }) => {
    const isFollowing = followingIds.has(item.id);
    const isLoading = actionLoading === item.id;

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderColor }]}>
        <View style={styles.infoContainer}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/user-profile' as any, params: { userId: item.id } })}>
            <Image
              source={{ uri: item.profile_picture || `https://ui-avatars.com/api/?name=${item.first_name}+${item.last_name}&background=random&color=fff` }}
              style={styles.inboxAvatar}
            />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
              <Text numberOfLines={1} style={[styles.name, { color: textColor, marginRight: 4 }]}>
                {item.first_name} {item.last_name}
              </Text>
              {item.is_verified && <Ionicons name="checkmark-circle" size={15} color="#4CAF50" />}
            </View>
            <Text style={[styles.username, { color: subTextColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Diyetisyen'}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
            onPress={() => router.push({ 
              pathname: '/chat' as any, 
              params: { 
                userId: item.id, 
                username: `${item.first_name} ${item.last_name}`, 
                avatarUrl: item.profile_picture 
              } 
            })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton, { backgroundColor: isFollowing ? 'transparent' : primaryColor, borderColor: primaryColor }]}
            onPress={() => (isFollowing ? handleUnfollow(item.id) : handleFollow(item.id))}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? primaryColor : "#fff"} />
            ) : (
              <Text style={[styles.followButtonText, isFollowing && { color: primaryColor }]}>
                {isFollowing ? 'Takip Ediliyor' : 'Takip Et'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderInboxItem = ({ item }: { item: InboxUser | any }) => {
    const hasUnread = (item.unread_count || 0) > 0;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: borderColor }]}
        onPress={() => router.push({ 
          pathname: '/chat' as any, 
          params: { 
            userId: item.id, 
            username: `${item.ad || item.first_name || ''} ${item.soyad || item.last_name || ''}`.trim(), 
            avatarUrl: item.avatar_url || item.profile_picture 
          } 
        })}
      >
        <View style={styles.infoContainer}>
          <Image
            source={{ uri: item.avatar_url || item.profile_picture || `https://ui-avatars.com/api/?name=${item.ad || item.first_name}+${item.soyad || item.last_name}` }}
            style={styles.inboxAvatar}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.name, { color: textColor }]}>{item.ad || item.first_name} {item.soyad || item.last_name}</Text>
              <Text style={{ fontSize: 10, color: hasUnread ? '#25D366' : subTextColor }}>
                {item.message_time && new Date(item.message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <Text numberOfLines={1} style={{ color: subTextColor, fontSize: 13, fontStyle: hasUnread ? 'italic' : 'normal', flex: 1, marginRight: 10 }}>
                {item.last_message}
              </Text>
              {hasUnread && (
                <View style={{
                  backgroundColor: '#25D366',
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 5,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: primaryColor }]}>
          {isDietitian ? 'Mesaj Kutusu' : 'Diyetisyen Keşfet'}
        </Text>
      </View>

      {!isDietitian && (
        <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
          <Ionicons name="search" size={20} color={subTextColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Diyetisyen ara..."
            placeholderTextColor={subTextColor}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 20 }} />
      ) : (
        isDietitian ? (
          <FlatList
            data={inboxUsers}
            keyExtractor={item => item.id}
            renderItem={renderInboxItem}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: subTextColor }]}>Henüz yeni mesaj yok.</Text>}
          />
        ) : (
          <FlatList
            data={dietitians}
            keyExtractor={(item) => item.id}
            renderItem={renderDietitianItem}
            contentContainerStyle={styles.listContainer}
            ListHeaderComponent={
              userDietitianChats.length > 0 ? (
                <View style={{ marginBottom: 20 }}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Aktif Sohbetler</Text>
                  {userDietitianChats.map((chat) => {
                    const hasUnread = (chat.unread_count || 0) > 0;
                    return (
                      <TouchableOpacity
                        key={chat.id}
                        style={[styles.card, { backgroundColor: cardBg, borderColor: borderColor }]}
                        onPress={() => router.push({ 
                          pathname: '/chat' as any, 
                          params: { 
                            userId: chat.id, 
                            username: `${chat.first_name} ${chat.last_name}`.trim(), 
                            avatarUrl: chat.profile_picture 
                          } 
                        })}
                      >
                        <View style={styles.infoContainer}>
                          <Image
                            source={{ uri: chat.profile_picture || `https://ui-avatars.com/api/?name=${chat.first_name}+${chat.last_name}` }}
                            style={styles.inboxAvatar}
                          />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={[styles.name, { color: textColor }]}>{chat.first_name} {chat.last_name}</Text>
                              <Text style={{ fontSize: 10, color: hasUnread ? '#25D366' : subTextColor }}>
                                {chat.message_time && new Date(chat.message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                              <Text numberOfLines={1} style={{ color: subTextColor, fontSize: 13, fontStyle: hasUnread ? 'italic' : 'normal', flex: 1, marginRight: 10 }}>
                                {chat.last_message}
                              </Text>
                              {hasUnread && (
                                <View style={{
                                  backgroundColor: '#25D366',
                                  borderRadius: 10,
                                  minWidth: 20,
                                  height: 20,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  paddingHorizontal: 5,
                                }}>
                                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{chat.unread_count}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={[styles.sectionTitle, { color: textColor, marginTop: 10 }]}>Diyetisyenleri Keşfet</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: subTextColor }]}>Diyetisyen bulunamadı.</Text>
            }
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: THEME_COLOR,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
  },
  listContainer: {
    padding: 20,
    paddingTop: 5,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inboxAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#f0f0f0'
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  followButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
    minWidth: 70,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME_COLOR,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 11,
  },
  followingButtonText: {
    color: THEME_COLOR,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#888',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  messageBtn: {
    padding: 6,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  }
});
