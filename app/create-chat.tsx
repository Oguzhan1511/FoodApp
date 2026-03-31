import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from './services/supabaseConfig';

export default function CreateChatScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#121212' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';
    const cardBg = isDark ? '#1e1e1e' : '#f9f9f9';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';
    const borderColor = isDark ? '#333333' : '#eee';

    const [friends, setFriends] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (user) {
            fetchFriends();
        }
    }, [user]);

    const fetchFriends = async () => {
        try {
            const { data, error } = await supabase
                .from('user_follows')
                .select('follower_id, following_id')
                .eq('status', 'accepted')
                .or(`follower_id.eq.${user?.id},following_id.eq.${user?.id}`);

            if (error) throw error;

            if (data && data.length > 0) {
                const uniqueIds = new Set<string>();
                data.forEach((d: any) => {
                    uniqueIds.add(d.follower_id === user?.id ? d.following_id : d.follower_id);
                });
                
                const { data: profiles, error: pError } = await supabase
                    .from('profiles')
                    .select('id, username, ad, soyad, avatar_url')
                    .in('id', Array.from(uniqueIds));

                if (pError) throw pError;

                const formatted = (profiles || []).map((p: any) => ({
                    id: p.id,
                    username: p.username,
                    name: `${p.ad} ${p.soyad}`,
                    avatar_url: p.avatar_url
                }));
                setFriends(formatted);
            } else {
                setFriends([]);
            }
        } catch (error) {
            console.error("Arkadaşları çekme hatası:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedUsers(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleCreate = async () => {
        if (selectedUsers.size === 0) return;

        setCreating(true);
        try {
            if (selectedUsers.size === 1) {
                // 1-1 Sohbet
                const [userId] = Array.from(selectedUsers);
                const friend = friends.find(f => f.id === userId);
                router.replace({ pathname: '/chat', params: { userId: userId, username: friend.username, avatarUrl: friend.avatar_url } });
            } else {
                // Grup Sohbeti
                if (!groupName.trim()) {
                    Alert.alert("Hata", "Lütfen bir grup adı girin.");
                    setCreating(false);
                    return;
                }

                // 1. Grubu Oluştur
                const { data: groupData, error: groupError } = await supabase
                    .from('groups')
                    .insert({
                        name: groupName,
                        created_by: user?.id
                    })
                    .select()
                    .single();

                if (groupError) throw groupError;

                // 2. Üyeleri Ekle (Kendisi + Seçilenler)
                const members = [user?.id, ...Array.from(selectedUsers)].map(uid => ({
                    group_id: groupData.id,
                    user_id: uid
                }));

                const { error: memberError } = await supabase
                    .from('group_members')
                    .insert(members);

                if (memberError) throw memberError;

                router.replace({ pathname: '/chat', params: { groupId: groupData.id, groupName: groupName } });
            }
        } catch (error: any) {
            console.error("Sohbet oluşturma hatası:", error);
            Alert.alert("Hata", "Sohbet oluşturulamadı: " + error.message);
            setCreating(false);
        }
    };

    const filteredFriends = friends.filter(friend =>
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        friend.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <SafeAreaView style={[styles.container, styles.center]}><ActivityIndicator color={primaryColor} /></SafeAreaView>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>Yeni Sohbet</Text>
                <TouchableOpacity onPress={handleCreate} disabled={selectedUsers.size === 0 || creating}>
                    {creating ? <ActivityIndicator size="small" color={primaryColor} /> : (
                        <Text style={[styles.createBtn, { color: selectedUsers.size > 0 ? primaryColor : subTextColor }]}>
                            {selectedUsers.size > 1 ? 'Oluştur' : 'Başlat'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {selectedUsers.size > 1 && (
                    <View style={[styles.inputContainer, { backgroundColor: cardBg }]}>
                        <TextInput
                            style={[styles.input, { color: textColor }]}
                            placeholder="Grup Adı"
                            placeholderTextColor={subTextColor}
                            value={groupName}
                            onChangeText={setGroupName}
                        />
                    </View>
                )}

                <View style={[styles.inputContainer, { backgroundColor: cardBg, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }]}>
                    <Ionicons name="search" size={20} color={subTextColor} style={{ marginRight: 10 }} />
                    <TextInput
                        style={[styles.input, { color: textColor, flex: 1 }]}
                        placeholder="Arkadaş Ara..."
                        placeholderTextColor={subTextColor}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <Text style={[styles.sectionTitle, { color: subTextColor }]}>Kişiler ({filteredFriends.length})</Text>

                {filteredFriends.map(friend => {
                    const isSelected = selectedUsers.has(friend.id);
                    return (
                        <TouchableOpacity
                            key={friend.id}
                            style={[styles.userRow, { backgroundColor: isSelected ? (isDark ? '#331111' : '#fff5f5') : 'transparent' }]}
                            onPress={() => toggleSelection(friend.id)}
                        >
                            <Image
                                source={{ uri: friend.avatar_url || `https://ui-avatars.com/api/?name=${friend.username}&background=random` }}
                                style={styles.avatar}
                            />
                            <View style={styles.userInfo}>
                                <Text style={[styles.userName, { color: textColor }]}>{friend.name}</Text>
                                <Text style={[styles.userHandle, { color: subTextColor }]}>{friend.username ? friend.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                            </View>
                            <View style={[styles.checkbox, { borderColor: isSelected ? primaryColor : subTextColor, backgroundColor: isSelected ? primaryColor : 'transparent' }]}>
                                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    title: { fontSize: 18, fontWeight: 'bold' },
    createBtn: { fontWeight: 'bold', fontSize: 16 },
    content: { padding: 15 },
    inputContainer: { padding: 15, borderRadius: 10, marginBottom: 20 },
    input: { fontSize: 16 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
    userRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 5 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: 'bold' },
    userHandle: { fontSize: 14 },
    checkbox: { width: 24, height: 1.25, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' }
});
