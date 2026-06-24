import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseConfig';
import { useTheme } from '../context/ThemeContext';

export default function WeightTrackingScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { user } = useAuth();
    const isDark = theme === 'dark';

    // Colors
    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#fff';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#666';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';
    const inputBg = isDark ? '#333' : '#f5f5f5';

    const [history, setHistory] = useState<{ id?: string, date: string; weight: string }[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newWeight, setNewWeight] = useState('');

    useEffect(() => {
        if (user) {
            loadHistory();
        }
    }, [user]);

    const loadHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('weight_entries')
                .select('*')
                .eq('user_id', user?.id)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching weight history:', error);
                return;
            }

            if (data) {
                setHistory(data);
            }
        } catch (error) {
            console.error('Failed to load history', error);
        }
    };

    const handleAddWeight = async () => {
        if (!newWeight || !user) return;

        try {
            const { data, error } = await supabase
                .from('weight_entries')
                .insert({
                    user_id: user.id,
                    weight: newWeight,
                    date: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            const updatedHistory = [data, ...history];
            setHistory(updatedHistory);
            setModalVisible(false);
            setNewWeight('');

            // Optionally update profiles table if you have a weight column there
            // await supabase.from('profiles').update({ weight: newWeight }).eq('id', user.id);

        } catch (error: any) {
            Alert.alert('Hata', error.message || 'Kayıt edilemedi.');
        }
    };

    const deleteEntry = async (id: string, index: number) => {
        Alert.alert(
            "Sil",
            "Bu kaydı silmek istiyor musunuz?",
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Sil",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase
                            .from('weight_entries')
                            .delete()
                            .eq('id', id);

                        if (!error) {
                            const updated = [...history];
                            updated.splice(index, 1);
                            setHistory(updated);
                        } else {
                            Alert.alert("Hata", "Silinemedi");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item, index }: { item: { id?: string, date: string; weight: string }, index: number }) => (
        <View style={[styles.historyItem, { backgroundColor: cardBg }]}>
            <View>
                <Text style={[styles.dateText, { color: textColor }]}>
                    {new Date(item.date).toLocaleDateString()}{' '}
                    {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.weightText, { color: primaryColor }]}>{item.weight} kg</Text>
                <TouchableOpacity onPress={() => item.id && deleteEntry(item.id, index)} style={{ marginLeft: 15 }}>
                    <Ionicons name="trash-outline" size={20} color={subTextColor} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Kilo Geçmişi</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
                    <Ionicons name="add" size={28} color={primaryColor} />
                </TouchableOpacity>
            </View>

            {/* Stats Summary */}
            <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
                <Text style={[styles.summaryLabel, { color: subTextColor }]}>Mevcut Kilo</Text>
                <Text style={[styles.currentWeight, { color: primaryColor }]}>
                    {history.length > 0 ? history[0].weight : '--'} <Text style={{ fontSize: 18, color: subTextColor }}>kg</Text>
                </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: subTextColor }]}>Geçmiş Kayıtlar</Text>

            <FlatList
                data={history}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: subTextColor }]}>Henüz kayıt yok.</Text>
                }
            />

            {/* Add Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <Text style={[styles.modalTitle, { color: textColor }]}>Yeni Kilo Ekle</Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="Örn: 70.5"
                            placeholderTextColor={subTextColor}
                            keyboardType="numeric"
                            value={newWeight}
                            onChangeText={setNewWeight}
                            autoFocus
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#888' }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.btnText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: primaryColor }]}
                                onPress={handleAddWeight}
                            >
                                <Text style={styles.btnText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
    },
    backButton: {
        padding: 5,
    },
    addButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    summaryCard: {
        alignItems: 'center',
        padding: 20,
        margin: 20,
        marginTop: 0,
        borderRadius: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    summaryLabel: {
        fontSize: 14,
        marginBottom: 5,
    },
    currentWeight: {
        fontSize: 40,
        fontWeight: 'bold',
    },
    sectionTitle: {
        marginLeft: 20,
        marginBottom: 10,
        fontSize: 14,
        fontWeight: '600'
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    dateText: {
        fontSize: 16,
    },
    weightText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 15,
        padding: 20,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        height: 50,
        borderRadius: 10,
        paddingHorizontal: 15,
        fontSize: 18,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
