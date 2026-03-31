import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from './services/supabaseConfig';

const THEME_COLOR = '#800020';

interface UserProfile {
  id: string;
  username: string;
  ad: string;
  soyad: string;
  avatar_url?: string | null;
}

export default function FriendsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#121212' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const subTextColor = isDark ? '#aaaaaa' : '#666666';
  const inputBg = isDark ? '#1e1e1e' : '#f2f2f2';
  const cardBg = isDark ? '#1e1e1e' : '#f9f9f9';
  const borderColor = isDark ? '#333333' : '#eeeeee';
  const iconColor = isDark ? '#ffffff' : '#333333';

  const uid = user?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [unreadSenders, setUnreadSenders] = useState<Set<string>>(new Set());
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string, created_at: string, sender_id: string }>>({});

  // Real-time listener
  useEffect(() => {
    if (!uid) return;

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${uid}`,
        },
        (payload) => {
          const newMessage = payload.new;
          setUnreadSenders((prev) => {
            const next = new Set(prev);
            next.add(newMessage.sender_id);
            return next;
          });
          if (uid) fetchLastMessages(uid);
        }
      )
      .subscribe();

    const fetchUnreadStatus = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', uid)
        .eq('is_read', false);

      if (!error && data) {
        const senders = new Set(data.map(m => m.sender_id));
        setUnreadSenders(senders);
      }
    };

    fetchUnreadStatus();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);

  // Data Fetching
  useEffect(() => {
    if (uid) {
      fetchFriends(uid);
      fetchRequests(uid);
      fetchGroups(uid);
      fetchLastMessages(uid);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) fetchLastMessages(uid);
  }, [groups]);

  const fetchLastMessages = async (currentUid: string) => {
    // 1. Fetch Direct Messages (Sender or Receiver is ME)
    const { data: directData } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUid},receiver_id.eq.${currentUid}`)
      .order('created_at', { ascending: false })
      .limit(100);

    // 2. Fetch Group Messages
    const groupIds = groups.map(g => g.id);
    let groupData: any[] = [];
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) groupData = data;
    }

    const allMessages = [...(directData || []), ...groupData];
    allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const latestMap: Record<string, any> = {};

    allMessages.forEach(msg => {
      const partnerId = msg.group_id
        ? msg.group_id
        : (msg.sender_id === currentUid ? msg.receiver_id : msg.sender_id);

      if (partnerId && !latestMap[partnerId]) {
        latestMap[partnerId] = {
          content: msg.content.startsWith('DIET_') ? '📷 Medya/Plan' : (msg.content.startsWith('POST_SHARE:::') ? '📸 Gönderi paylaştı' : msg.content),
          created_at: msg.created_at,
          sender_id: msg.sender_id // Save sender_id
        };
      }
    });

    setLastMessages(latestMap);
  };

  const fetchGroups = async (currentUid: string) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('group:group_id(*)')
      .eq('user_id', currentUid);

    if (error) {
      console.error("Grup çekme hatası:", error);
    } else {
      const rawGroups = data.map((item: any) => item.group);
      const uniqueGroups = Array.from(new Map(rawGroups.map((g: any) => [g.id, g])).values());
      setGroups(uniqueGroups);
    }
  };

  const fetchFriends = async (currentUid: string) => {
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id, following_id')
      .eq('status', 'accepted')
      .or(`follower_id.eq.${currentUid},following_id.eq.${currentUid}`);

    if (error) {
      console.error("Liste Çekme Hatası:", error);
      return;
    }

    if (data && data.length > 0) {
      const uniqueIds = new Set<string>();
      data.forEach(d => {
        uniqueIds.add(d.follower_id === currentUid ? d.following_id : d.follower_id);
      });
      const idsArray = Array.from(uniqueIds);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, ad, soyad, avatar_url')
        .in('id', idsArray);

      if (profiles) {
        setFriends(profiles as any);
      }
    } else {
        setFriends([]);
    }
  };

  const fetchRequests = async (currentUid: string) => {
    const { data: requestsData, error: reqError } = await supabase
      .from('user_follows')
      .select('id, follower_id')
      .eq('following_id', currentUid)
      .eq('status', 'pending');

    if (reqError) {
      console.error("İstekleri Çekme Hatası:", reqError);
    } else if (requestsData && requestsData.length > 0) {
      const requesterIds = requestsData.map(r => r.follower_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, ad, soyad, avatar_url')
        .in('id', requesterIds);

      if (profiles) {
        const fullRequests = requestsData.map(req => ({
             id: req.id,
             requester: profiles.find(p => p.id === req.follower_id)
        })).filter(r => r.requester);
        setRequests(fullRequests);
      }
    } else {
        setRequests([]);
    }
  };

  const handleResponse = async (friendshipId: string, action: 'accept' | 'reject') => {
    try {
      if (action === 'accept') {
        const { error } = await supabase
          .from('user_follows')
          .update({ status: 'accepted' })
          .eq('id', friendshipId);
        if (error) throw error;

        // Trigger Notification for the requester
        const request = requests.find(r => r.id === friendshipId);
        if (request) {
          await supabase.from('notifications').insert([{
            user_id: request.requester.id,
            actor_id: uid,
            type: 'friend_accept',
            content: 'accept_request'
          }]);

          const { data: actorProfile } = await supabase.from('profiles').select('is_private, username').eq('id', request.requester.id).single();

          // Zaten takip ediyor mu veya istek atmış mı kontrol et
          const { data: existingFollowData } = await supabase
              .from('user_follows')
              .select('id')
              .eq('follower_id', uid)
              .eq('following_id', request.requester.id)
              .maybeSingle();

          if (existingFollowData) {
              Alert.alert("Başarılı", "Takip isteği kabul edildi!");
          } else {
              Alert.alert(
                  "Takip İsteği Kabul Edildi",
                  `@${actorProfile?.username || 'Kullanıcı'} artık sizi takip ediyor. Siz de onu takip etmek ister misiniz?`,
                  [
                      { text: "Hayır", style: "cancel" },
                      {
                          text: "Sen de Takip Et",
                          onPress: async () => {
                              const isPublic = !actorProfile?.is_private;
                              await supabase.from('user_follows').insert([{
                                  follower_id: uid,
                                  following_id: request.requester.id,
                                  status: isPublic ? 'accepted' : 'pending'
                              }]);
                              
                              await supabase.from('notifications').insert([{
                                  user_id: request.requester.id,
                                  actor_id: uid,
                                  type: isPublic ? 'friend_accept' : 'friend_request',
                                  content: isPublic ? 'direct_follow' : null
                              }]);
                              
                              Alert.alert("Başarılı", isPublic ? "Kullanıcıyı takip etmeye başladınız." : "Takip isteği gönderildi.");
                          }
                      }
                  ]
              );
          }
        } else {
            Alert.alert("Başarılı", "Takip isteği kabul edildi!");
        }
      } else {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('id', friendshipId);
        if (error) throw error;
        Alert.alert("Bilgi", "İstek reddedildi.");
      }
      if (uid) {
        fetchRequests(uid);
        fetchFriends(uid);
      }
    } catch (error: any) {
      Alert.alert("Hata", "İşlem hatası: " + error.message);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Şimdi';
    if (diffMins < 60) return `${diffMins}dk`;
    if (diffHours < 24) return `${diffHours}s`;
    return `${diffDays}g`;
  };

  // MERGE & FILTER
  const combinedList = [
    ...groups.map(g => ({ type: 'group', id: g.id, name: g.name, username: null, data: g })),
    ...friends.map(f => ({ type: 'friend', id: f.id, name: `${f.ad} ${f.soyad}`, username: f.username, data: f }))
  ];

  const filteredList = combinedList.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={{ marginTop: 10 }}>Oturum yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Sohbetler</Text>
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
        placeholder="Ara..."
        placeholderTextColor={subTextColor}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {requests.length > 0 && (
        <View>
          <Text style={[styles.sectionTitle, { color: subTextColor }]}>Gelen İstekler ({requests.length})</Text>
          {requests.map((req) => (
            <View key={req.id} style={[styles.requestRow, { backgroundColor: cardBg, borderColor: borderColor }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.requestName, { color: textColor }]}>{req.requester.ad} {req.requester.soyad}</Text>
                <Text style={[styles.requestUsername, { color: subTextColor }]}>{req.requester.username ? req.requester.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.acceptButton} onPress={() => handleResponse(req.id, 'accept')}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton} onPress={() => handleResponse(req.id, 'reject')}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Calculate display list filtering out empty chats */}
      {(() => {
        const displayList = filteredList
          .filter(item => item.type === 'group' || lastMessages[item.id])
          .sort((a, b) => {
            const msgA = lastMessages[a.id];
            const msgB = lastMessages[b.id];
            const timeA = msgA ? new Date(msgA.created_at).getTime() : 0;
            const timeB = msgB ? new Date(msgB.created_at).getTime() : 0;
            return timeB - timeA;
          });

        return (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 10 }}>
              <Text style={[styles.subtitle, { color: isDark ? '#ff4d4d' : THEME_COLOR, marginTop: 0, marginBottom: 0 }]}>
                Sohbetler ({displayList.length})
              </Text>
              <TouchableOpacity onPress={() => router.push('/create-chat')}>
                <Ionicons name="create-outline" size={24} color={isDark ? '#ff4d4d' : THEME_COLOR} />
              </TouchableOpacity>
            </View>

            {displayList.length === 0 ? (
              <Text style={[styles.emptyText, { color: subTextColor }]}>
                {searchQuery ? "Sonuç bulunamadı." : "Henüz sohbetiniz yok."}
              </Text>
            ) : (
              displayList.map((item) => {
                const isGroup = item.type === 'group';
                const hasUnread = unreadSenders.has(item.id);
                const lastMsg = lastMessages[item.id];
                const avatarUrl = isGroup ? null : item.data.avatar_url;
                const defaultImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff`;

                return (
                  <TouchableOpacity
                    key={`${item.type}-${item.id}`}
                    style={[styles.chatRow, { borderBottomColor: borderColor }]}
                    onLongPress={() => {
                      if (isGroup) {
                        Alert.alert(
                          "Sohbeti Sil",
                          "Bu sohbeti kalıcı olarak silmek istiyor musunuz?",
                          [
                            { text: "Vazgeç", style: "cancel" },
                            {
                              text: "Sil",
                              style: "destructive",
                              onPress: async () => {
                                const { error } = await supabase
                                  .from('group_members')
                                  .delete()
                                  .eq('group_id', item.id)
                                  .eq('user_id', uid);
                                if (error) {
                                  Alert.alert("Hata", "Silinemedi: " + error.message);
                                } else {
                                  if (uid) fetchGroups(uid);
                                }
                              }
                            }
                          ]
                        );
                      } else {
                        // Friend Chat Delete - Only Delete Messages
                        Alert.alert(
                          "Sohbeti Sil",
                          "Bu sohbeti silmek istediğinize emin misiniz? (Arkadaşınız silinmez, sadece mesaj geçmişi silinir).",
                          [
                            { text: "Vazgeç", style: "cancel" },
                            {
                              text: "Sil",
                              style: "destructive",
                              onPress: async () => {
                                const { error } = await supabase
                                  .from('messages')
                                  .delete()
                                  .or(`and(sender_id.eq.${uid},receiver_id.eq.${item.id}),and(sender_id.eq.${item.id},receiver_id.eq.${uid})`);

                                if (error) {
                                  Alert.alert("Hata", "Silinemedi: " + error.message);
                                } else {
                                  if (uid) fetchLastMessages(uid);
                                }
                              }
                            }
                          ]
                        );
                      }
                    }}
                    onPress={() => {
                      if (isGroup) {
                        router.push({ pathname: '/chat', params: { groupId: item.id, groupName: item.name, avatarUrl: avatarUrl } });
                      } else {
                        const f = item.data;
                        setUnreadSenders(prev => {
                          const next = new Set(prev);
                          next.delete(f.id);
                          return next;
                        });
                        router.push({ pathname: "/chat", params: { userId: f.id, username: f.username, avatarUrl: f.avatar_url } });
                      }
                    }}
                  >
                    <Image
                      source={{ uri: avatarUrl || defaultImage }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                    <View style={styles.chatInfo}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.chatName, { color: textColor }]}>{item.name}</Text>
                        <Text style={styles.timeText}>
                          {lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={[styles.lastMsgText, { color: subTextColor }]} numberOfLines={1}>
                          {lastMsg ? (lastMsg.sender_id === uid ? `Siz: ${lastMsg.content}` : lastMsg.content) : 'Sohbet başlatın...'}
                        </Text>
                        {hasUnread && <View style={styles.unreadDot} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginLeft: 15 },
  input: { padding: 12, borderRadius: 10, marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  subtitle: { fontSize: 18, fontWeight: 'bold' },
  emptyText: { fontStyle: 'italic', marginTop: 10, textAlign: 'center' },

  // Request Styles
  requestRow: {
    flexDirection: 'row', alignItems: 'center', padding: 15,
    borderRadius: 10, marginBottom: 10, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  requestName: { fontWeight: 'bold', fontSize: 16 },
  requestUsername: { fontSize: 12 },
  actionButtons: { flexDirection: 'row', gap: 10 },
  acceptButton: { backgroundColor: '#4CAF50', padding: 10, borderRadius: 20 },
  rejectButton: { backgroundColor: '#F44336', padding: 10, borderRadius: 20 },

  // Chat Row Styles
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#ddd'
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#999'
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  lastMsgText: {
    fontSize: 14,
    flex: 1,
    marginRight: 10
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME_COLOR // '#800020'
  },
});