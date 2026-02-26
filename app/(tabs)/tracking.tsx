import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabaseConfig';

import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

export default function TrackingScreen() {
    const router = useRouter(); // Initialize Router
    const { theme } = useTheme();
    const { user } = useAuth();
    const isDark = theme === 'dark';

    // Dynamic Colors
    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#888888';
    const borderColor = isDark ? '#333333' : '#eee';
    const headerBg = isDark ? '#121212' : '#ffffff';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';
    const inputBg = isDark ? '#333' : '#f5f5f5';

    // State for user stats
    const [stats, setStats] = useState({
        weight: '70',
        height: '175',
        age: '25'
    });
    const [weightHistory, setWeightHistory] = useState<{ date: string, weight: string }[]>([]);
    const [waterIntake, setWaterIntake] = useState(0); // Daily total in ml
    const [waterHistory, setWaterHistory] = useState<{ date: string, total: number }[]>([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [tempStats, setTempStats] = useState(stats);

    useEffect(() => {
        if (user) {
            loadStats();
        }
    }, [user]);

    const loadStats = async () => {
        if (!user) return;
        try {
            const storedStats = await AsyncStorage.getItem(`userStats_${user.id}`);
            if (storedStats) {
                setStats(JSON.parse(storedStats));
            }

            // Load Weight History from Supabase
            const { data, error } = await supabase
                .from('weight_entries')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (data) {
                setWeightHistory(data);
            }
        } catch (e) {
            console.error('Failed to load data');
        }
    };

    const loadWaterIntake = async () => {
        if (!user) return;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateLimit = sevenDaysAgo.toISOString();

        try {
            const { data, error } = await supabase
                .from('water_entries')
                .select('amount_ml, created_at')
                .eq('user_id', user.id)
                .gte('created_at', dateLimit)
                .order('created_at', { ascending: false });

            if (data) {
                // 1. Calculate Today's Total
                const todayEntries = data.filter(d => d.created_at.startsWith(today));
                const totalToday = todayEntries.reduce((sum, entry) => sum + entry.amount_ml, 0);
                setWaterIntake(totalToday);

                // 2. Aggregate Last 7 Days
                const grouped: { [key: string]: number } = {};
                data.forEach(entry => {
                    const date = entry.created_at.split('T')[0];
                    if (!grouped[date]) grouped[date] = 0;
                    grouped[date] += entry.amount_ml;
                });

                const historyArray = Object.keys(grouped).map(date => ({
                    date,
                    total: grouped[date]
                })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setWaterHistory(historyArray);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (user) {
            loadWaterIntake();
        }
    }, [user]);

    const addWater = async (amount: number) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('water_entries').insert({
                user_id: user.id,
                amount_ml: amount,
                // created_at defaults to now
            });

            if (!error) {
                setWaterIntake(prev => prev + amount);
                Alert.alert("Başarılı", `${amount}ml su eklendi! 💧`);
            }
        } catch (e) { Alert.alert("Hata", "Su eklenemedi."); }
    };

    const handleSave = async () => {
        if (!user) return;
        setStats(tempStats);
        setModalVisible(false);

        try {
            await AsyncStorage.setItem(`userStats_${user.id}`, JSON.stringify(tempStats));

            // If weight changed, add to history via Supabase
            if (tempStats.weight !== stats.weight) {
                const { data } = await supabase.from('weight_entries').insert({
                    user_id: user.id,
                    weight: tempStats.weight,
                    date: new Date().toISOString()
                }).select().single();

                if (data) {
                    setWeightHistory(prev => [data, ...prev]);
                }
            }

        } catch (e) {
            Alert.alert('Hata', 'Bilgiler kaydedilemedi.');
        }
    };

    const handleEdit = () => {
        setTempStats(stats);
        setModalVisible(true);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
                <Text style={[styles.headerTitle, { color: textColor }]}>Kişisel Takip</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {/* PROFILE INFO CARD */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="person-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Profil Bilgileri</Text>
                        </View>
                        <TouchableOpacity onPress={handleEdit}>
                            <Ionicons name="pencil" size={20} color={primaryColor} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: textColor }]}>{stats.weight} kg</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Kilo</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: textColor }]}>{stats.height} cm</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Boy</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: textColor }]}>{stats.age}</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Yaş</Text>
                        </View>
                    </View>
                </View>

                {/* EDIT MODAL */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                            <Text style={[styles.modalTitle, { color: textColor }]}>Bilgileri Düzenle</Text>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: subTextColor }]}>Kilo (kg)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                    value={tempStats.weight}
                                    onChangeText={(t) => setTempStats({ ...tempStats, weight: t })}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: subTextColor }]}>Boy (cm)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                    value={tempStats.height}
                                    onChangeText={(t) => setTempStats({ ...tempStats, height: t })}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: subTextColor }]}>Yaş</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                    value={tempStats.age}
                                    onChangeText={(t) => setTempStats({ ...tempStats, age: t })}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: '#888' }]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Text style={styles.btnText}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: primaryColor }]}
                                    onPress={handleSave}
                                >
                                    <Text style={styles.btnText}>Kaydet</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: cardBg }]}
                    onPress={() => router.push('/weight-tracking')}
                >
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="scale-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Kilo Takibi</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: subTextColor, fontSize: 12, marginRight: 5 }}>Detay</Text>
                            <Ionicons name="chevron-forward" size={16} color={subTextColor} />
                        </View>
                    </View>

                    {weightHistory.length > 0 ? (
                        <View>
                            <View style={styles.weeklySummary}>
                                <Text style={[styles.summaryLabel, { color: subTextColor }]}>Son 7 Gün Değişimi:</Text>
                                <Text style={[styles.summaryValue, { color: textColor }]}>
                                    {calculateWeeklyChange(weightHistory)}
                                </Text>
                            </View>
                            <Text style={[styles.historyTitle, { color: subTextColor }]}>Geçmiş Kayıtlar:</Text>
                            {weightHistory.slice(0, 3).map((entry, index) => (
                                <View key={index} style={styles.historyItem}>
                                    <Text style={{ color: textColor }}>{new Date(entry.date).toLocaleDateString()}</Text>
                                    <Text style={{ color: textColor, fontWeight: 'bold' }}>{entry.weight} kg</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={[styles.placeholderText, { color: subTextColor }]}>Henüz veri yok. Kayıt eklemek için dokunun.</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { backgroundColor: cardBg }]}
                    onPress={() => router.push('/diet-plan-detail')}
                >
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="nutrition-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Diyet Programım</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={subTextColor} />
                    </View>
                    <Text style={[styles.placeholderText, { color: subTextColor }]}>
                        Haftalık diyet listenizi görüntüleyin ve takip edin.
                    </Text>
                </TouchableOpacity>

                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="water-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Su Takibi</Text>
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor }}>{waterIntake} ml</Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
                        <TouchableOpacity
                            style={{ backgroundColor: isDark ? '#333' : '#e0f7fa', padding: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => addWater(200)}
                        >
                            <Ionicons name="water" size={20} color="#00bcd4" />
                            <Text style={{ color: textColor, marginTop: 5 }}>+200ml</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ backgroundColor: isDark ? '#333' : '#e0f7fa', padding: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => addWater(500)}
                        >
                            <Ionicons name="water" size={24} color="#00bcd4" />
                            <Text style={{ color: textColor, marginTop: 5 }}>+500ml</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ backgroundColor: isDark ? '#333' : '#e0f7fa', padding: 10, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => addWater(1000)}
                        >
                            <Ionicons name="water" size={28} color="#00bcd4" />
                            <Text style={{ color: textColor, marginTop: 5 }}>+1 Lt</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Water History List */}
                    {waterHistory.length > 0 && (
                        <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 10 }}>
                            <Text style={[styles.historyTitle, { color: subTextColor }]}>Son 7 Gün:</Text>
                            {waterHistory.map((item, index) => (
                                <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
                                    <Text style={{ color: textColor }}>
                                        {new Date(item.date).toLocaleDateString()}
                                    </Text>
                                    <Text style={{ color: '#00bcd4', fontWeight: 'bold' }}>
                                        {item.total} ml
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="flame-outline" size={24} color={primaryColor} />
                        <Text style={[styles.cardTitle, { color: textColor }]}>Kalori Özeti</Text>
                    </View>
                    <Text style={[styles.placeholderText, { color: subTextColor }]}>Yakında eklenecek...</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const calculateWeeklyChange = (history: { date: string, weight: string }[]) => {
    if (history.length < 2) return 'Veri Yok';

    // Find entry closest to 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Simple logic: Find latest and earliest within last week for now, or just compare current with last log
    // Better: Compare current (index 0) with first entry older than 6 days, or just the previous entry if within week.
    // Let's compare Index 0 with the last entry derived.

    const current = parseFloat(history[0].weight);
    const previous = parseFloat(history[history.length - 1].weight); // Compare with oldest for now or refine logic

    // More precise: Find log closest to 7 days ago
    let weekOldEntry = history.find(h => new Date(h.date) <= oneWeekAgo);

    // If no entry older than 7 days, compare with the oldest available
    if (!weekOldEntry) weekOldEntry = history[history.length - 1];

    const startWeight = parseFloat(weekOldEntry.weight);
    const diff = current - startWeight;

    if (isNaN(diff)) return 'Hesaplanamıyor';

    return diff === 0 ? 'Değişim Yok' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333'
    },
    content: {
        padding: 15
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3.84,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 10
    },
    placeholderText: {
        fontSize: 14,
        fontStyle: 'italic',
        marginTop: 5
    },
    // New Styles
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    weeklySummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    summaryLabel: {
        fontSize: 16,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4CAF50'
    },
    historyTitle: {
        fontSize: 14,
        marginBottom: 5,
        marginTop: 5
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    statLabel: {
        fontSize: 14,
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
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        marginBottom: 5,
        fontSize: 14,
    },
    input: {
        height: 45,
        borderRadius: 10,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
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
    }
});
