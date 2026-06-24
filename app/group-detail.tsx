import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

const THEME_COLOR = '#800020';

interface Member {
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    user: {
        id: string;
        username: string;
        ad: string;
        soyad: string;
        avatar_url: string | null;
    }
}

export default function GroupDetailScreen() {
    const router = useRouter();
    const { groupId, groupName } = useLocalSearchParams();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const bgColor = isDark ? '#121212' : '#fff';
    const textColor = isDark ? '#fff' : '#000';
    const subTextColor = isDark ? '#aaa' : '#666';

    useEffect(() => {
        if (groupId) {
            fetchMembers();
        }
    }, [groupId]);

    const fetchMembers = async () => {
        try {
            // Join with profiles table to get user info
            // Assuming 'profiles' table exists or referenced as 'user' in relation
            // Actually friend fetches used 'requester:requester(...)'.
            // Let's try to query 'group_members' and select 'user:user_id(*)' 
            // If 'user_id' is FK to 'profiles'. If NOT FK, we might fail.
            // In 'fix_db_schema', we changed user_id to TEXT. So FK might be dropped!
            // If FK is dropped, we cannot join easily unless we rejoin manually.
            // BUT: `supabase` JS client can't join if no FK exists.

            // Workaround if FK missing:
            // 1. Fetch group_members.
            // 2. Extract user_ids.
            // 3. Fetch profiles where id IN (user_ids).

            const { data: memberData, error: memberError } = await supabase
                .from('group_members')
                .select('*')
                .eq('group_id', groupId);

            if (memberError) throw memberError;

            if (memberData && memberData.length > 0) {
                const userIds = memberData.map(m => m.user_id);

                const { data: userData, error: userError } = await supabase
                    .from('profiles') // Assuming 'profiles' is the table name
                    .select('id, username, ad, soyad, avatar_url')
                    .in('id', userIds);

                if (userError) {
                    // Fallback if profiles table is named differently, e.g. distinct from auth.users?
                    // Usually public table is 'profiles'. I'll assume that.
                    console.error("User fetch error", userError);
                }

                // Merge
                const merged = memberData.map(m => {
                    const u = userData?.find(u => u.id === m.user_id);
                    return { ...m, user: u || { id: m.user_id, username: 'Unknown', ad: 'User', soyad: '', avatar_url: null } };
                });
                setMembers(merged);
            } else {
                setMembers([]);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Hata", "Üyeler çekilemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = () => {
        router.push({
            pathname: '/group-add-member' as any,
            params: { groupId, groupName }
        });
    };

    const handleLeaveGroup = () => {
        Alert.alert(
            "Gruptan Ayrıl",
            "Bu gruptan ayrılmak istediğinize emin misiniz?",
            [
                { text: "Vazgeç", style: "cancel" },
                { text: "Ayrıl", style: "destructive", onPress: confirmLeave }
            ]
        );
    };

    const confirmLeave = async () => {
        if (!user || !groupId) return;

        // Soft leave: Update role to 'left' instead of deleting
        const { error } = await supabase
            .from('group_members')
            .update({ role: 'left' })
            .eq('group_id', groupId)
            .eq('user_id', user.id);

        if (error) {
            Alert.alert("Hata", "Gruptan ayrılınamadı: " + error.message);
        } else {
            Alert.alert("Bilgi", "Gruptan ayrıldınız. Sohbet geçmişini silmek için sohbet listesinde üzerine basılı tutabilirsiniz.");
            router.navigate('/friends' as any);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: textColor }]}>Grup Detayları</Text>
            </View>

            <View style={styles.groupInfo}>
                <Image
                    source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName as string)}&background=random&color=fff&size=200` }}
                    style={styles.groupAvatar}
                />
                <Text style={[styles.groupName, { color: textColor }]}>{groupName}</Text>
                <Text style={{ color: subTextColor }}>{members.length} Üye</Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleAddMember}>
                    <View style={[styles.iconBox, { backgroundColor: '#e0f7fa' }]}>
                        <Ionicons name="person-add" size={24} color="#006064" />
                    </View>
                    <Text style={[styles.actionText, { color: textColor }]}>Kişi Ekle</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { color: subTextColor }]}>Üyeler</Text>

            {loading ? (
                <ActivityIndicator color={THEME_COLOR} />
            ) : (
                members.map((m) => (
                    <View key={m.id} style={[styles.memberRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                        <Image
                            source={{ uri: m.user.avatar_url || `https://ui-avatars.com/api/?name=${m.user.ad}+${m.user.soyad}&background=random&color=fff` }}
                            style={styles.memberAvatar}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.memberName, { color: textColor }]}>{m.user.ad} {m.user.soyad}</Text>
                            <Text style={[styles.memberUser, { color: subTextColor }]}>{m.user.username ? m.user.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                        </View>
                        {m.user_id === user?.id && <Text style={{ color: THEME_COLOR, fontSize: 12 }}>Siz</Text>}
                    </View>
                ))
            )}

            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                <Text style={styles.leaveText}>Gruptan Ayrıl</Text>
            </TouchableOpacity>

            <View style={{ height: 50 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    groupInfo: { alignItems: 'center', marginBottom: 30 },
    groupAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, backgroundColor: '#ddd' },
    groupName: { fontSize: 22, fontWeight: 'bold' },
    actions: { flexDirection: 'row', marginBottom: 20 },
    actionBtn: { alignItems: 'center', marginRight: 20 },
    iconBox: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    actionText: { fontSize: 14, fontWeight: '500' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#eee' },
    memberName: { fontSize: 16, fontWeight: '500' },
    memberUser: { fontSize: 12 },
    leaveButton: { marginTop: 40, backgroundColor: '#ffebee', padding: 15, borderRadius: 10, alignItems: 'center' },
    leaveText: { color: '#d32f2f', fontWeight: 'bold', fontSize: 16 }
});
