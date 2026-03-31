import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { supabase } from '../services/supabaseConfig';

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

  useEffect(() => {
    if (uid) {
      checkIfDietitian();
    }
  }, [uid]);

  useEffect(() => {
    if (isDietitian) {
      fetchInbox();
    } else {
      fetchDietitians();
      if (uid) fetchFollowingStatus();
    }
  }, [isDietitian, uid]);


  const checkIfDietitian = async () => {
    const { data } = await supabase
      .from('dietitians')
      .select('id')
      .eq('id', uid)
      .single();

    if (data) setIsDietitian(true);
  };

  const fetchInbox = async () => {
    setLoading(true);
    try {
      // 1. Fetch messages where receiver is me
      const { data: messages, error } = await supabase
        .from('messages')
        .select('sender_id, content, created_at')
        .eq('receiver_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!messages || messages.length === 0) {
        setInboxUsers([]);
        setLoading(false);
        return;
      }

      // Group by sender to find unique users
      const uniqueSenders = new Map();
      messages.forEach(msg => {
        if (!uniqueSenders.has(msg.sender_id)) {
          uniqueSenders.set(msg.sender_id, msg);
        }
      });

      const senderIds = Array.from(uniqueSenders.keys());

      // 2. Fetch Profiles of these senders
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, ad, soyad, avatar_url')
        .in('id', senderIds);

      // 3. Check Friendship status to exclude friends?
      // The request said: "diyetisyene mesaj atan kullanıcıları görsün arkadaşı olmayan"
      // So we filter out friends.

      const { data: friends } = await supabase
        .from('friendships')
        .select('requester, receiver')
        .or(`requester.eq.${uid},receiver.eq.${uid}`)
        .eq('status', 'accepted');

      const friendIds = new Set();
      friends?.forEach(f => {
        friendIds.add(f.requester === uid ? f.receiver : f.requester);
      });

      const filteredProfiles = profiles?.filter(p => !friendIds.has(p.id)) || [];

      const list = filteredProfiles.map(p => ({
        ...p,
        last_message: uniqueSenders.get(p.id)?.content,
        message_time: uniqueSenders.get(p.id)?.created_at
      }));

      setInboxUsers(list);

    } catch (error) {
      console.error("Inbox load error:", error);
    } finally {
      setLoading(false);
    }
  };


  // 1. Diyetisyenleri Çek (veya Ara)
  const fetchDietitians = async (queryText = '') => {
    setLoading(true);
    let query = supabase
      .from('dietitians')
      .select('id, username, first_name, last_name, is_verified');

    if (queryText.length > 0) {
      query = query.or(`username.ilike.%${queryText}%,first_name.ilike.%${queryText}%,last_name.ilike.%${queryText}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Diyetisyenleri çekme hatası:', error);
    } else {
      setDietitians(data || []);
    }
    setLoading(false);
  };

  // 2. Takip Durumlarını Çek
  const fetchFollowingStatus = async () => {
    if (!uid) return;
    const { data, error } = await supabase
      .from('dietitian_follows')
      .select('dietitian_id')
      .eq('follower_id', uid);

    if (error) {
      console.error('Takip verisi hatası:', error);
    } else if (data) {
      const ids = new Set(data.map((item) => item.dietitian_id));
      setFollowingIds(ids);
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
          <TouchableOpacity onPress={() => router.push({ pathname: '/user-profile', params: { userId: item.id } })}>
            <View style={styles.avatarPlaceholder}>
              <Text style={{ fontSize: 20, color: '#white', fontWeight: 'bold' }}>
                {item.first_name?.[0]}{item.last_name?.[0]}
              </Text>
            </View>
          </TouchableOpacity>
          <View>
            <Text style={[styles.name, { color: textColor }]}>
              {item.first_name} {item.last_name}
              {item.is_verified && <Ionicons name="checkmark-circle" size={16} color="#4CAF50" style={{ marginLeft: 5 }} />}
            </Text>
            <Text style={[styles.username, { color: subTextColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Diyetisyen'}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
            onPress={() => router.push({ pathname: '/chat', params: { userId: item.id, username: item.username } })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={primaryColor} />
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

  const renderInboxItem = ({ item }: { item: InboxUser }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg, borderColor: borderColor }]}
      onPress={() => router.push({ pathname: '/chat', params: { userId: item.id, username: item.username } })}
    >
      <View style={styles.infoContainer}>
        <Image
          source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.ad}+${item.soyad}` }}
          style={styles.inboxAvatar}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.name, { color: textColor }]}>{item.ad} {item.soyad}</Text>
            <Text style={{ fontSize: 10, color: subTextColor }}>
              {item.message_time && new Date(item.message_time).toLocaleDateString()}
            </Text>
          </View>
          <Text numberOfLines={1} style={{ color: subTextColor, fontSize: 13, marginTop: 2 }}>
            {item.last_message}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    minWidth: 80,
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
    fontSize: 12,
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
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
