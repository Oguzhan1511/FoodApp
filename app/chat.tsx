import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
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

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  group_id?: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const SharedPostBubble = ({ postId, isMe, router }: any) => {
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postOwnerUsername, setPostOwnerUsername] = useState<string | null>(null);
  const [postOwnerAvatar, setPostOwnerAvatar] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const textColorValue = isMe ? '#fff' : (isDark ? '#e0e0e0' : '#333');

  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('image_url, user_id')
          .eq('id', postId)
          .single();
          
        if (postError) throw postError;
          
        if (postData) {
          setPostImage(postData.image_url);
          
          if (postData.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', postData.user_id)
              .single();
              
            if (profileData) {
              setPostOwnerUsername(profileData.username);
              setPostOwnerAvatar(profileData.avatar_url);
            }
          }
        }
      } catch (err) {
        console.log("Post fetch error:", err);
      }
    };
    fetchPostDetails();
  }, [postId]);

  return (
    <View style={{ marginTop: 4 }}>
      <TouchableOpacity
        style={{ borderRadius: 12, alignItems: 'flex-start' }}
        onPress={() => router.push({ pathname: '/post-detail', params: { postId } })}
        activeOpacity={0.8}
      >
        {postOwnerUsername && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            {postOwnerAvatar ? (
              <Image 
                source={{ uri: postOwnerAvatar }} 
                style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6 }} 
              />
            ) : (
              <Ionicons name="person-circle-outline" size={20} color={textColorValue} style={{ opacity: 0.8, marginRight: 6 }} />
            )}
            <Text style={{ color: textColorValue, fontSize: 13, fontWeight: '700', opacity: 0.9 }}>
              {postOwnerUsername}
            </Text>
          </View>
        )}
        
        {postImage ? (
          <Image source={{ uri: postImage }} style={{ width: 180, height: 180, borderRadius: 12 }} contentFit="cover" />
        ) : (
          <View style={{ width: 180, height: 180, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={textColorValue} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { userId, username, dietPlanData, groupId, groupName, avatarUrl, openSearch } = useLocalSearchParams<{ 
    userId?: string; 
    username?: string; 
    dietPlanData?: string; 
    groupId?: string; 
    groupName?: string; 
    avatarUrl?: string; 
    openSearch?: string;
  }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#121212' : '#f2f2f2';
  const textColor = isDark ? '#ffffff' : '#333333';
  const subTextColor = isDark ? '#aaaaaa' : '#888888';
  const headerBgColor = isDark ? '#1a1a1a' : THEME_COLOR;
  const cardBg = isDark ? '#1e1e1e' : '#ffffff';
  const inputBg = isDark ? '#2a2a2a' : '#f0f2f5';
  const borderColor = isDark ? '#333333' : '#e4e6eb';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDietitian, setIsDietitian] = useState(false);
  const [groupRole, setGroupRole] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ [messageId: string]: Reaction[] }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [chatColor, setChatColor] = useState(THEME_COLOR);
  const commonEmojis = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    checkUserRole();
    if (userId) fetchRecipientProfile();
  }, [user, userId]);

  useFocusEffect(
    useCallback(() => {
      const loadChatTheme = async () => {
        if (!user) return;
        const targetId = (groupId || userId) as string;
        const saved = await AsyncStorage.getItem(`chatTheme_${user.id}_${targetId}`);
        if (saved) setChatColor(saved);
      };
      loadChatTheme();
    }, [user, userId, groupId])
  );

  useEffect(() => {
    if (openSearch === 'true') {
      setIsSearching(true);
    }
  }, [openSearch]);

  const fetchRecipientProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('ad, soyad, username')
        .eq('id', userId)
        .single();
      if (data) {
        setHeaderName(data.ad && data.soyad ? `${data.ad} ${data.soyad}` : data.username);
      }
    } catch (e) {
      console.log("Fetch recipient error:", e);
    }
  };

  // Check Group Membership
  useEffect(() => {
    if (groupId && user) {
      checkGroupMembership();
    }
  }, [groupId, user]);

  const checkGroupMembership = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user!.id)
      .single();
    if (data) {
      setGroupRole(data.role);
    }
  };

  const processingPlanRef = useRef(false);

  useEffect(() => {
    if (dietPlanData && typeof dietPlanData === 'string') {
      if (processingPlanRef.current) return;

      processingPlanRef.current = true;
      const content = `DIET_PLAN:::${dietPlanData}`;
      sendMessage(content);
      router.setParams({ dietPlanData: null });
    } else {
      processingPlanRef.current = false;
    }
  }, [dietPlanData]);

  const checkUserRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('dietitians')
      .select('id')
      .eq('id', user.id)
      .single();
    if (data) setIsDietitian(true);
  };

  useEffect(() => {
    if (!user) return;
    if (!userId && !groupId) return;

    fetchMessages();
    fetchReactions();

    const channel = supabase.channel('chat_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: groupId ? `group_id=eq.${groupId}` : undefined
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === user.id) return;
          if (!groupId) {
            if ((newMsg.sender_id === userId && newMsg.receiver_id === user.id) || (newMsg.sender_id === user.id && newMsg.receiver_id === userId)) {
              setMessages(prev => [...prev, newMsg]);
              if (newMsg.sender_id === userId) markAsRead();
            }
          } else if (newMsg.group_id === groupId) {
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userId, groupId]);

  const fetchReactions = async () => {
    if (!user) return;
    try {
      // Get all reactions for current chat's messages
      // For simplicity, we fetch all reactions related to these messages
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*');
      
      if (error) throw error;
      
      const grouped: { [key: string]: Reaction[] } = {};
      data?.forEach((r: Reaction) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push(r);
      });
      setReactions(grouped);
    } catch (e) {
      console.log("Reactions fetch error:", e);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setShowEmojiPicker(false);
    
    try {
      // Check if reaction already exists
      const existing = reactions[messageId]?.find(r => r.user_id === user.id && r.emoji === emoji);
      
      if (existing) {
        // Remove it
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        // Add new (Supabase will handle the unique constraint if we tried to add another emoji, 
        // but let's handle it by deleting any other emoji from this user on this message first)
        await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id);
        await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        });
      }
      fetchReactions();
    } catch (e) {
      console.log("Toggle reaction error:", e);
    }
  };

  const fetchMessages = async () => {
    if (!user) return;

    let query = supabase.from('messages').select('*').order('created_at', { ascending: true });

    if (groupId) {
      query = query.eq('group_id', groupId);
    } else if (userId) {
      query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`);
    } else {
      return;
    }

    const { data, error } = await query;

    if (error) {
      console.error('Mesaj çekme hatası:', error.message);
    } else {
      const unique = data?.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i) as Message[];
      setMessages(unique || []);

      if (userId) {
        const unreadMessages = data?.filter(m => m.sender_id === userId && !m.is_read) || [];
        if (unreadMessages.length > 0) {
          await markAsRead();
        }
      }
    }
    setLoading(false);
  };

  const markAsRead = async () => {
    if (!user || !userId) return;

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', userId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);
  };

  const sendMessage = async (text?: string) => {
    const content = text || inputText.trim();
    if (!content || !user) return;
    if (!userId && !groupId) return;

    if (!text) setInputText('');

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: (userId || '') as string,
      group_id: (groupId as string) || undefined,
      content: content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    const payload: any = {
      sender_id: user.id,
      content: content,
    };

    if (groupId) {
      payload.group_id = groupId;
    } else {
      payload.receiver_id = userId;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Mesaj gönderme hatası:', error.message);
      Alert.alert('Hata', 'Mesaj gönderilemedi.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, created_at: data.created_at } : m));
    }
  };

  const handlePlusPress = async () => {
    Alert.alert(
      "Paylaş",
      "Ne paylaşmak istersiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Vücut Bilgilerim",
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem('userStats');
              if (stored) {
                const stats = JSON.parse(stored);
                const msg = `📊 Profil Bilgilerim:\nBoy: ${stats.height} cm\nKilo: ${stats.weight} kg\nYaş: ${stats.age}`;
                sendMessage(msg);
              } else {
                const msg = `📊 Profil Bilgilerim:\nBoy: 175 cm\nKilo: 70 kg\nYaş: 25`;
                sendMessage(msg);
              }
            } catch (e) {
              Alert.alert("Hata", "Bilgiler alınamadı.");
            }
          }
        },
        {
          text: isDietitian ? "Diyet Listesi Hazırla 📋" : "Diyet Durumunu Paylaş 📊",
          onPress: () => {
            if (groupId) {
              Alert.alert("Bilgi", "Bu özellik şu an sadece bireysel sohbetlerde kullanılabilir.");
              return;
            }
            if (isDietitian) {
              router.push({
                pathname: '/create-diet-plan',
                params: { userId: userId }
              });
            } else {
              shareDietProgress();
            }
          }
        },
        { text: "Vazgeç", style: "cancel" }
      ]
    );
  };

  const shareDietProgress = async () => {
    if (!user) return;
    try {
      const planJson = await AsyncStorage.getItem(`currentDietPlan_${user.id}`);
      const progressJson = await AsyncStorage.getItem(`dietPlanProgress_${user.id}`);

      if (!planJson) {
        Alert.alert("Hata", "Aktif bir diyet programınız yok.");
        return;
      }

      const payload = {
        plan: JSON.parse(planJson),
        progress: progressJson ? JSON.parse(progressJson) : {}
      };

      sendMessage(`DIET_PROGRESS:::${JSON.stringify(payload)}`);

    } catch (e) {
      Alert.alert("Hata", "Program paylaşılamadı.");
    }
  };

  // Calculate avatar source
  const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent((groupId ? groupName : username) as string || 'User')}&background=random&color=fff`;
  const imageDisplaySource = (avatarUrl as string) || fallbackImage;

  const renderInputArea = () => {
    if (groupId && groupRole === 'left') {
      return (
        <View style={[styles.inputContainer, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
          <Text style={{ color: subTextColor, fontStyle: 'italic', textAlign: 'center', width: '100%' }}>
            Bu gruptan ayrıldınız.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.inputContainer, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
        <TouchableOpacity style={styles.plusButton} onPress={handlePlusPress}>
          <Ionicons name="add" size={28} color={THEME_COLOR} />
        </TouchableOpacity>
        <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: borderColor }]}>
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder="Mesaj yazın..."
            placeholderTextColor={subTextColor}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
        </View>
        {inputText.trim().length > 0 ? (
          <TouchableOpacity style={[styles.sendButton, { backgroundColor: THEME_COLOR }]} onPress={() => sendMessage()}>
            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.sendButton, { backgroundColor: isDark ? '#333' : '#e0e0e0' }]}>
            <Ionicons name="send" size={18} color={isDark ? '#666' : '#fff'} style={{ marginLeft: 3 }} />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        {!isSearching ? (
          <>
            <TouchableOpacity
              style={styles.headerInfo}
              activeOpacity={0.7}
              onPress={() => {
                router.push({ 
                  pathname: '/chat-settings', 
                  params: { 
                    userId, 
                    username, 
                    avatarUrl: imageDisplaySource, 
                    headerName,
                    groupId,
                    groupName
                  } 
                });
              }}
            >
              <Image
                source={{ uri: imageDisplaySource }}
                style={styles.headerAvatar}
                contentFit="cover"
              />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {groupId ? groupName : (headerName || username)}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchHeaderInner}>
            <TextInput
              style={styles.searchInputField}
              placeholder="Mesajlarda ara..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchText(''); }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.keyboardView, { backgroundColor: bgColor }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME_COLOR} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={searchText ? messages.filter(m => m.content.toLowerCase().includes(searchText.toLowerCase())) : messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => !searchText && flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item, index }) => {
              const isMe = item.sender_id === user?.id;
              const isDietPlan = item.content.startsWith('DIET_PLAN:::');
              const isDietProgress = item.content.startsWith('DIET_PROGRESS:::');
              const isPostShare = item.content.startsWith('POST_SHARE:::');
              
              const prevItem = index > 0 ? messages[index - 1] : null;
              const nextItem = index < messages.length - 1 ? messages[index + 1] : null;
              const isConsecutive = nextItem?.sender_id === item.sender_id;
              const isFollowing = prevItem?.sender_id === item.sender_id;

              return (
                <View style={[
                  styles.messageRow,
                  isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
                  isFollowing ? { marginTop: 2 } : { marginTop: 12 },
                  reactions[item.id] && reactions[item.id].length > 0 && { marginBottom: 10 }
                ]}>
                  <View style={{ maxWidth: '80%' }}>
                    <Pressable 
                      onLongPress={() => {
                        setSelectedMessageId(item.id);
                        setShowEmojiPicker(true);
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                      delayLongPress={300}
                    >
                      <View style={[
                        styles.messageBubble,
                        isMe ? styles.myMessage : styles.theirMessage,
                        isMe ? { backgroundColor: chatColor } : { backgroundColor: cardBg },
                        isFollowing && (isMe ? styles.myMessageFollowing : styles.theirMessageFollowing),
                        isConsecutive && (isMe ? styles.myMessageConsecutive : styles.theirMessageConsecutive),
                        (isDietPlan || isDietProgress || isPostShare) && { maxWidth: '100%' },
                        { maxWidth: '100%' }
                      ]}>
                        {isDietPlan ? (
                          <View>
                            <Text style={[styles.structuredTitle, { color: isMe ? '#fff' : textColor }]}>📋 Haftalık Diyet Listesi</Text>
                            <TouchableOpacity
                              style={[styles.structuredBox, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                              onPress={() => {
                                const json = item.content.replace('DIET_PLAN:::', '');
                                router.push({ pathname: '/diet-plan-detail', params: { planData: json } });
                              }}
                            >
                              <Text style={{ color: isMe ? '#e0e0e0' : subTextColor, fontStyle: 'italic', fontSize: 13 }}>Görüntülemek için dokunun</Text>
                            </TouchableOpacity>
                            {!isMe && (
                              <TouchableOpacity
                                style={styles.actionButtonBox}
                                onPress={async () => {
                                  if (!user?.id) return;
                                  const json = item.content.replace('DIET_PLAN:::', '');
                                  router.push({ pathname: '/payment', params: { planData: json, dietitianId: item.sender_id } });
                                }}
                              >
                                <Text style={styles.actionButtonText}>Satın Al ve Uygula</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : isDietProgress ? (
                          <View>
                            <Text style={[styles.structuredTitle, { color: isMe ? '#fff' : textColor }]}>📊 Diyet İlerlemesi</Text>
                            <TouchableOpacity
                              style={[styles.structuredBox, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                              onPress={() => {
                                try {
                                  const json = item.content.replace('DIET_PROGRESS:::', '');
                                  const payload = JSON.parse(json);
                                  router.push({
                                    pathname: '/diet-plan-detail',
                                    params: { planData: JSON.stringify(payload.plan), progressData: JSON.stringify(payload.progress) }
                                  });
                                } catch (e) { Alert.alert("Hata", "Veri okunamadı"); }
                              }}
                            >
                              <Text style={{ color: isMe ? '#e0e0e0' : subTextColor, fontStyle: 'italic', fontSize: 13 }}>İlerlemeyi görüntülemek için dokun</Text>
                            </TouchableOpacity>
                          </View>
                        ) : isPostShare ? (
                          <SharedPostBubble postId={item.content.replace('POST_SHARE:::', '')} isMe={isMe} router={router} />
                        ) : (
                          <Text style={[styles.messageText, { color: isMe ? '#fff' : textColor }]}>
                            {item.content}
                          </Text>
                        )}
                        <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.7)' : subTextColor }]}>
                          {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Reactions Display - Outside Pressable to prevent triggering bubble long-press when clicking reaction */}
                    {reactions[item.id] && reactions[item.id].length > 0 && (
                      <View style={[
                        styles.reactionsContainer, 
                        isMe ? { right: 8 } : { left: 8 }
                      ]}>
                        {Object.entries(
                          reactions[item.id].reduce((acc: any, curr) => {
                            acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emo, count]: any) => (
                          <TouchableOpacity 
                            key={emo} 
                            style={[styles.reactionPill, { backgroundColor: cardBg, borderColor: borderColor }]}
                            onPress={() => toggleReaction(item.id, emo)}
                          >
                            <Text style={styles.reactionEmoji}>{emo}</Text>
                            {count > 1 && <Text style={[styles.reactionCount, { color: textColor }]}>{count}</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
        {renderInputArea()}

        {/* Emoji Picker Modal */}
        <Modal
          visible={showEmojiPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmojiPicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowEmojiPicker(false)}>
            <View style={[styles.emojiPicker, { backgroundColor: cardBg, borderColor: borderColor }]}>
              {commonEmojis.map(emoji => (
                <TouchableOpacity 
                  key={emoji} 
                  style={styles.emojiItem}
                  onPress={() => {
                    if (selectedMessageId) toggleReaction(selectedMessageId, emoji);
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: { padding: 5, marginRight: 5 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ddd' },
  headerTextContainer: { marginLeft: 12, flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerActionIcon: { padding: 5 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 25 },
  messageRow: { flexDirection: 'row', width: '100%' },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: {
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    borderBottomLeftRadius: 4,
  },
  myMessageFollowing: { borderTopRightRadius: 4 },
  theirMessageFollowing: { borderTopLeftRadius: 4 },
  myMessageConsecutive: { borderBottomRightRadius: 4 },
  theirMessageConsecutive: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500' },
  structuredTitle: { fontWeight: 'bold', marginBottom: 6, fontSize: 15 },
  structuredBox: { padding: 12, borderRadius: 10, alignItems: 'center' },
  actionButtonBox: { marginTop: 8, backgroundColor: '#fff', padding: 10, borderRadius: 10, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  actionButtonText: { color: THEME_COLOR, fontWeight: 'bold', fontSize: 14 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 120,
    marginRight: 10,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingTop: 12,
    paddingBottom: 12,
  },
  plusButton: {
    padding: 8,
    marginRight: 4,
    marginBottom: 2
  },
  sendButton: {
    backgroundColor: THEME_COLOR,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#800020',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  emojiPicker: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 30,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5
  },
  emojiItem: {
    paddingHorizontal: 8
  },
  reactionsContainer: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    zIndex: 2,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3
  },
  reactionEmoji: {
    fontSize: 14
  },
  reactionCount: {
    fontSize: 11,
    marginLeft: 3,
    fontWeight: 'bold'
  },
  searchHeaderInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginRight: 5,
  },
  searchInputField: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
  }
});
