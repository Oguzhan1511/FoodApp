import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from './services/supabaseConfig';

const THEME_COLOR = '#800020';

export default function ChatSettingsScreen() {
  const router = useRouter();
  const { userId, username, avatarUrl, headerName, groupId, groupName } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [groupRole, setGroupRole] = React.useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = React.useState(THEME_COLOR);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#121212' : '#f8f9fa';
  const textColor = isDark ? '#ffffff' : '#333333';
  const subTextColor = isDark ? '#aaaaaa' : '#666666';
  const cardBg = isDark ? '#1e1e1e' : '#ffffff';
  const borderColor = isDark ? '#333333' : '#eeeeee';

  const targetId = (groupId || userId) as string;

  React.useEffect(() => {
    loadTheme();
  }, [targetId]);

  const loadTheme = async () => {
    const saved = await AsyncStorage.getItem(`chatTheme_${user?.id}_${targetId}`);
    if (saved) setSelectedTheme(saved);
  };

  const saveTheme = async (color: string) => {
    setSelectedTheme(color);
    await AsyncStorage.setItem(`chatTheme_${user?.id}_${targetId}`, color);
  };

  const themeColors = [
    '#800020', // Deep Red (Default)
    '#007AFF', // Blue
    '#34C759', // Green
    '#5856D6', // Purple
    '#FF2D55', // Pink
    '#FF9500', // Orange
    '#000000', // Black
    '#5AC8FA', // Sky Blue
  ];

  const displayName = headerName || groupName || username || 'Kullanıcı';
  const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName as string)}&background=random&color=fff`;
  const imageDisplaySource = (avatarUrl as string) || fallbackImage;

  const handleClearChat = () => {
    Alert.alert(
      "Sohbeti Temizle",
      "Tüm mesajlar silinecek. Bu işlem geri alınamaz. Emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Temizle", 
          style: "destructive", 
          onPress: async () => {
            try {
              let query = supabase.from('messages').delete();
              if (groupId) {
                query = query.eq('group_id', groupId);
              } else {
                query = query.or(`and(sender_id.eq.${user?.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user?.id})`);
              }
              const { error } = await query;
              if (error) throw error;
              Alert.alert("Başarılı", "Sohbet temizlendi.");
            } catch (e) {
              Alert.alert("Hata", "Sohbet temizlenemedi.");
            }
          }
        }
      ]
    );
  };

  const handleBlockUser = () => {
    Alert.alert("Engelle", "Bu kullanıcıyı engellemek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Engelle", style: "destructive", onPress: () => Alert.alert("Bilgi", "Engelleme özelliği yakında eklenecek.") }
    ]);
  };

  const OptionItem = ({ icon, label, onPress, color = textColor, showChevron = true }: any) => (
    <TouchableOpacity 
      style={[styles.optionItem, { borderBottomColor: borderColor }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionLeft}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
          <Ionicons name={icon} size={22} color={color === textColor ? (isDark ? '#ccc' : '#555') : color} />
        </View>
        <Text style={[styles.optionLabel, { color }]}>{label}</Text>
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={18} color={subTextColor} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Detaylar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <Image source={{ uri: imageDisplaySource }} style={styles.avatar} contentFit="cover" />
          <Text style={[styles.name, { color: textColor }]}>{displayName}</Text>
          {username && <Text style={[styles.username, { color: subTextColor }]}>{(Array.isArray(username) ? username[0] : username).replace(/^@/, '')}</Text>}
        </View>

        <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
          <OptionItem 
            icon="person-outline" 
            label="Profili Görüntüle" 
            onPress={() => {
              if (groupId) {
                router.push({ pathname: '/group-detail', params: { groupId, groupName } });
              } else {
                router.push({ pathname: '/user-profile', params: { userId } });
              }
            }} 
          />
          <View style={[styles.themeSection, { borderBottomColor: borderColor }]}>
            <View style={styles.optionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                <Ionicons name="color-palette-outline" size={22} color={isDark ? '#ccc' : '#555'} />
              </View>
              <Text style={[styles.optionLabel, { color: textColor }]}>Sohbet Teması</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeScroll}>
              {themeColors.map(color => (
                <TouchableOpacity 
                  key={color} 
                  style={[
                    styles.colorCircle, 
                    { backgroundColor: color },
                    selectedTheme === color && styles.selectedCircle
                  ]}
                  onPress={() => saveTheme(color)}
                />
              ))}
            </ScrollView>
          </View>
          <OptionItem 
            icon="notifications-outline" 
            label="Bildirimleri Sessize Al" 
            onPress={() => Alert.alert("Bilgi", "Bu özellik yakında eklenecek.")} 
          />
          <OptionItem 
            icon="search-outline" 
            label="Sohbette Ara" 
            onPress={() => {
              router.push({ 
                pathname: '/chat', 
                params: { 
                  userId, 
                  groupId,
                  openSearch: 'true'
                } 
              });
            }} 
            showChevron={false}
          />
        </View>

        <Text style={styles.sectionTitle}>Gizlilik ve Yardım</Text>
        <View style={[styles.section, { backgroundColor: cardBg, borderColor }]}>
          <OptionItem 
            icon="trash-outline" 
            label="Sohbeti Temizle" 
            color="#ff4d4d" 
            onPress={handleClearChat}
            showChevron={false}
          />
          {!groupId && (
            <OptionItem 
              icon="ban-outline" 
              label="Engelle" 
              color="#ff4d4d" 
              onPress={handleBlockUser}
              showChevron={false}
            />
          )}
          <OptionItem 
            icon="warning-outline" 
            label="Şikayet Et" 
            color="#ff4d4d" 
            onPress={() => Alert.alert("Şikayet", "Şikayetiniz incelenmek üzere iletilecektir.")}
            showChevron={false}
          />
        </View>
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  name: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  username: { fontSize: 16, opacity: 0.8 },
  section: {
    marginHorizontal: 15,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 25,
  },
  sectionTitle: {
    marginHorizontal: 20,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLabel: { fontSize: 16, fontWeight: '500' },
  themeSection: {
    padding: 15,
    borderBottomWidth: 1,
  },
  themeScroll: {
    marginTop: 15,
    paddingLeft: 48,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCircle: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  }
});
