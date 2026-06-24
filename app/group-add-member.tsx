import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

const THEME_COLOR = '#800020';

interface Friend {
    id: string;
    username: string;
    ad: string;
    soyad: string;
    avatar_url?: string | null;
}

export default function GroupAddMemberScreen() {
    const router = useRouter();
    const { groupId } = useLocalSearchParams();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const bgColor = isDark ? '#121212' : '#fff';
    const textColor = isDark ? '#fff' : '#000';
    const subTextColor = isDark ? '#aaa' : '#666';
    const inputBg = isDark ? '#1e1e1e' : '#f2f2f2';

    useEffect(() => {
        if (user && groupId) {
            fetchCandidates();
        }
    }, [user, groupId]);

    const fetchCandidates = async () => {
        try {
            // 1. Fetch my friends
            const { data: friendsData, error: friendsError } = await supabase
                .from('user_follows')
                .select('follower_id, following_id')
                .eq('status', 'accepted')
                .or(`follower_id.eq.${user?.id},following_id.eq.${user?.id}`);

            if (friendsError) throw friendsError;

            let allFriends: any[] = [];
            if (friendsData && friendsData.length > 0) {
                const uniqueIds = new Set<string>();
                friendsData.forEach((d: any) => {
                    uniqueIds.add(d.follower_id === user?.id ? d.following_id : d.follower_id);
                });
                
                const { data: profiles, error: pError } = await supabase
                    .from('profiles')
                    .select('id, username, ad, soyad, avatar_url')
                    .in('id', Array.from(uniqueIds));

                if (pError) throw pError;
                allFriends = profiles || [];
            }

            // 2. Fetch current group members
            const { data: memberData, error: memberError } = await supabase
                .from('group_members')
                .select('user_id')
                .eq('group_id', groupId);

            if (memberError) throw memberError;

            const currentMemberIds = new Set(memberData.map((m: any) => m.user_id));

            // 3. Filter out friends who are already members
            const candidates = allFriends.filter((f: Friend) => !currentMemberIds.has(f.id));
            setFriends(candidates);

        } catch (error) {
            console.error(error);
            Alert.alert("Hata", "Kişi listesi yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedFriends);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedFriends(next);
    };

    const handleAddMembers = async () => {
        if (selectedFriends.size === 0) return;
        setAdding(true);
        try {
            const memberInserts = Array.from(selectedFriends).map(uid => ({
                group_id: groupId,
                user_id: uid,
                role: 'member' // default role
            }));

            const { error } = await supabase
                .from('group_members')
                .insert(memberInserts);

            if (error) throw error;

            Alert.alert("Başarılı", "Kişiler eklendi!");
            router.back();
        } catch (error: any) {
            Alert.alert("Hata", "Ekleme başarısız: " + error.message);
        } finally {
            setAdding(false);
        }
    };

    const filteredFriends = friends.filter(f =>
        f.ad.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.soyad.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>Kişi Ekle</Text>
                <TouchableOpacity onPress={handleAddMembers} disabled={adding || selectedFriends.size === 0}>
                    {adding ? <ActivityIndicator color={THEME_COLOR} size="small" /> : (
                        <Text style={[styles.doneText, { color: selectedFriends.size > 0 ? THEME_COLOR : subTextColor }]}>
                            Bitti ({selectedFriends.size})
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <TextInput
                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                placeholder="Ara..."
                placeholderTextColor={subTextColor}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />

            {loading ? (
                <ActivityIndicator color={THEME_COLOR} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={filteredFriends}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                        const isSelected = selectedFriends.has(item.id);
                        return (
                            <TouchableOpacity style={styles.friendRow} onPress={() => toggleSelection(item.id)}>
                                <Image
                                    source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${item.ad}+${item.soyad}&background=random&color=fff` }}
                                    style={styles.avatar}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.name, { color: textColor }]}>{item.ad} {item.soyad}</Text>
                                    <Text style={[styles.username, { color: subTextColor }]}>{item.username ? item.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                                </View>
                                <Ionicons
                                    name={isSelected ? "checkbox" : "square-outline"}
                                    size={24}
                                    color={isSelected ? THEME_COLOR : subTextColor}
                                />
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', marginTop: 20, color: subTextColor }}>
                            {searchQuery ? "Kullanıcı bulunamadı." : "Eklenecek yeni arkadaşın yok."}
                        </Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 50 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 18, fontWeight: 'bold' },
    doneText: { fontSize: 16, fontWeight: 'bold' },
    input: { padding: 12, borderRadius: 10, marginBottom: 15 },
    friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#ddd' },
    name: { fontSize: 16, fontWeight: 'bold' },
    username: { fontSize: 12 }
});
