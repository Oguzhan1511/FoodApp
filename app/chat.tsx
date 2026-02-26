import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from './AuthContext';
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

export default function ChatScreen() {
  const router = useRouter();
  const { userId, username, dietPlanData, groupId, groupName, avatarUrl } = useLocalSearchParams();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDietitian, setIsDietitian] = useState(false);
  const [groupRole, setGroupRole] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    checkUserRole();
  }, [user]);

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
            if (
              (newMsg.sender_id === userId && newMsg.receiver_id === user.id) ||
              (newMsg.sender_id === user.id && newMsg.receiver_id === userId)
            ) {
              setMessages(prev => [...prev, newMsg]);
              if (newMsg.sender_id === userId) markAsRead();
            }
          } else {
            if (newMsg.group_id === groupId) {
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userId, groupId]);

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
  const imageSource = (avatarUrl as string) || fallbackImage;

  // Render Input Area Or Left Group Message
  const renderInputArea = () => {
    if (groupId && groupRole === 'left') {
      return (
        <View style={styles.inputContainer}>
          <Text style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', width: '100%' }}>
            Bu gruptan ayrıldınız.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.plusButton} onPress={handlePlusPress}>
          <Ionicons name="add" size={28} color={THEME_COLOR} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Mesaj yazın..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.7}
          onPress={() => {
            if (groupId) {
              router.push({
                pathname: '/group-detail',
                params: { groupId, groupName }
              });
            }
          }}
        >
          <Image
            source={{ uri: imageSource }}
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#ddd' }}
            contentFit="cover"
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {groupId && groupName ? groupName : username}
          </Text>
          {groupId && <Ionicons name="chevron-forward" size={16} color="#ffffff80" style={{ marginLeft: 5 }} />}
        </TouchableOpacity>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME_COLOR} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.sender_id === user?.id;
              const isDietPlan = item.content.startsWith('DIET_PLAN:::');
              const isDietProgress = item.content.startsWith('DIET_PROGRESS:::');

              return (
                <View style={[
                  styles.messageBubble,
                  isMe ? styles.myMessage : styles.theirMessage,
                  (isDietPlan || isDietProgress) && { maxWidth: '95%', backgroundColor: isMe ? THEME_COLOR : '#fff' }
                ]}>
                  {isDietPlan ? (
                    <View>
                      <Text style={{ fontWeight: 'bold', color: isMe ? '#fff' : '#000', marginBottom: 5 }}>📋 Haftalık Diyet Listesi</Text>
                      <TouchableOpacity
                        style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 10, borderRadius: 8 }}
                        onPress={() => {
                          const json = item.content.replace('DIET_PLAN:::', '');
                          router.push({
                            pathname: '/diet-plan-detail',
                            params: { planData: json }
                          });
                        }}
                      >
                        <Text style={{ color: isMe ? '#fff' : '#000', fontStyle: 'italic' }}>Görüntülemek için dokunun</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ marginTop: 5, backgroundColor: '#fff', padding: 8, borderRadius: 8, alignItems: 'center' }}
                        onPress={async () => {
                          if (!user?.id) return;
                          const json = item.content.replace('DIET_PLAN:::', '');
                          try {
                            const currentPlan = await AsyncStorage.getItem(`currentDietPlan_${user.id}`);
                            if (currentPlan === json) {
                              Alert.alert("Bilgi", "Bu programı zaten satın aldınız ve şu an aktiftir.");
                              return;
                            }
                          } catch (e) { }

                          router.push({
                            pathname: '/payment',
                            params: {
                              planData: json,
                              dietitianId: item.sender_id
                            }
                          });
                        }}
                      >
                        <Text style={{ color: THEME_COLOR, fontWeight: 'bold' }}>Bu Programı Uygula</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isDietProgress ? (
                    <View>
                      <Text style={{ fontWeight: 'bold', color: isMe ? '#fff' : '#000', marginBottom: 5 }}>📊 Diyet İlerlemesi</Text>
                      <TouchableOpacity
                        style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 10, borderRadius: 8 }}
                        onPress={() => {
                          try {
                            const json = item.content.replace('DIET_PROGRESS:::', '');
                            const payload = JSON.parse(json);
                            router.push({
                              pathname: '/diet-plan-detail',
                              params: {
                                planData: JSON.stringify(payload.plan),
                                progressData: JSON.stringify(payload.progress)
                              }
                            });
                          } catch (e) { Alert.alert("Hata", "Veri okunamadı"); }
                        }}
                      >
                        <Text style={{ color: isMe ? '#fff' : '#000', fontStyle: 'italic' }}>İlerlemeyi görüntülemek için dokun</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                      {item.content}
                    </Text>
                  )}
                  <Text style={[styles.timeText, isMe ? { color: '#ffd6d6' } : { color: '#888' }]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {renderInputArea()}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#800020',
    paddingTop: Platform.OS === 'android' ? 40 : 15
  },
  backButton: { padding: 5 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginLeft: 10, flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { padding: 15, paddingBottom: 20 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#800020',
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: { fontSize: 16 },
  myMessageText: { color: '#fff' },
  theirMessageText: { color: '#333' },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    minHeight: 60,
  },
  input: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#eee'
  },
  plusButton: {
    padding: 5,
    marginRight: 5,
  },
  sendButton: {
    backgroundColor: '#800020',
    padding: 10,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
