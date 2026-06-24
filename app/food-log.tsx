import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function FoodLogScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#888888';
    const borderColor = isDark ? '#333333' : '#eee';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';

    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);
    const [totals, setTotals] = useState({ kcal: 0, protein: 0, fat: 0, carbs: 0 });

    useEffect(() => {
        if (user) {
            loadLogs();
        }
    }, [user]);

    const getMealType = (date: string) => {
        const hour = new Date(date).getHours();
        if (hour >= 5 && hour < 11) return 'Kahvaltı';
        if (hour >= 12 && hour < 15) return 'Öğle Yemeği';
        if (hour >= 18 && hour < 22) return 'Akşam Yemeği';
        return 'Ara Öğün';
    };

    const loadLogs = async () => {
        if (!user) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const logKey = `daily_food_log_${user.id}_${today}`;
            const stored = await AsyncStorage.getItem(logKey);
            if (stored) {
                const data = JSON.parse(stored);
                setLogs(data);

                // Toplamları hesapla
                let tk = 0, tp = 0, tf = 0, tc = 0;
                data.forEach((item: any) => {
                    tk += parseFloat(item.kcal) || 0;
                    tp += parseFloat(item.protein) || 0;
                    tf += parseFloat(item.fat) || 0;
                    tc += parseFloat(item.carbs) || 0;
                });
                setTotals({ kcal: Math.round(tk), protein: Math.round(tp), fat: Math.round(tf), carbs: Math.round(tc) });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async (originalIndex: number) => {
        Alert.alert(
            "Kaydı Sil",
            "Bu yemeği günlüğünüzden silmek istediğinize emin misiniz?",
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Sil",
                    style: "destructive",
                    onPress: async () => {
                        if (!user?.id) return;
                        
                        const newLogs = [...logs];
                        newLogs.splice(originalIndex, 1);
                        
                        const today = new Date().toISOString().split('T')[0];
                        const logKey = `daily_food_log_${user.id}_${today}`;
                        await AsyncStorage.setItem(logKey, JSON.stringify(newLogs));
                        setLogs(newLogs);
                        
                        // Toplamları güncelle
                        let tk = 0, tp = 0, tf = 0, tc = 0;
                        newLogs.forEach((item: any) => {
                            tk += parseFloat(item.kcal) || 0;
                            tp += parseFloat(item.protein) || 0;
                            tf += parseFloat(item.fat) || 0;
                            tc += parseFloat(item.carbs) || 0;
                        });
                        setTotals({ kcal: Math.round(tk), protein: Math.round(tp), fat: Math.round(tf), carbs: Math.round(tc) });
                        Alert.alert("Başarılı", "Kayıt silindi.");
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: bgColor }]}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        );
    }

    const mealCategories = ['Kahvaltı', 'Öğle Yemeği', 'Akşam Yemeği', 'Ara Öğün'];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Detaylı Günlük</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.summaryCard, { backgroundColor: primaryColor }]}>
                    <Text style={styles.summaryTitle}>Günlük Toplam</Text>
                    <Text style={styles.summaryKcal}>{totals.kcal} kcal</Text>
                    <View style={styles.summaryMacros}>
                        <View style={styles.macroStat}>
                            <Text style={styles.macroStatVal}>{totals.protein}g</Text>
                            <Text style={styles.macroStatLabel}>Protein</Text>
                        </View>
                        <View style={styles.macroStat}>
                            <Text style={styles.macroStatVal}>{totals.fat}g</Text>
                            <Text style={styles.macroStatLabel}>Yağ</Text>
                        </View>
                        <View style={styles.macroStat}>
                            <Text style={styles.macroStatVal}>{totals.carbs}g</Text>
                            <Text style={styles.macroStatLabel}>Karbo</Text>
                        </View>
                    </View>
                </View>

                {mealCategories.map(meal => {
                    const mealLogs = logs.filter(log => getMealType(log.date) === meal);
                    if (mealLogs.length === 0) return null;

                    return (
                        <View key={meal} style={styles.mealSection}>
                            <View style={styles.mealHeader}>
                                <Ionicons 
                                    name={meal === 'Kahvaltı' ? 'sunny' : meal === 'Öğle Yemeği' ? 'restaurant' : meal === 'Akşam Yemeği' ? 'moon' : 'cafe'} 
                                    size={20} 
                                    color={primaryColor} 
                                />
                                <Text style={[styles.mealTitle, { color: textColor }]}>{meal}</Text>
                            </View>
                            {mealLogs.map((item) => {
                                const originalIndex = logs.findIndex(l => l.date === item.date);
                                return (
                                    <View key={item.date} style={[styles.logCard, { backgroundColor: cardBg, borderColor }]}>
                                        <View style={styles.logHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.foodName, { color: textColor }]}>{item.name}</Text>
                                                <Text style={[styles.timeText, { color: subTextColor }]}>
                                                    {new Date(item.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>
                                            <Text style={[styles.kcalText, { color: primaryColor }]}>{Math.round(item.kcal)} kcal</Text>
                                            <TouchableOpacity onPress={() => deleteItem(originalIndex)} style={styles.deleteBtn}>
                                                <Ionicons name="trash-outline" size={18} color="#ff4d4d" />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.macroRow}>
                                            <Text style={[styles.macroMini, { color: subTextColor }]}>P: {Math.round(item.protein)}g</Text>
                                            <Text style={[styles.macroMini, { color: subTextColor }]}>Y: {Math.round(item.fat)}g</Text>
                                            <Text style={[styles.macroMini, { color: subTextColor }]}>K: {Math.round(item.carbs)}g</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}

                {logs.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="restaurant-outline" size={64} color={subTextColor} />
                        <Text style={[styles.emptyText, { color: subTextColor }]}>Bugün henüz bir yemek kaydı girmediniz.</Text>
                    </View>
                )}
                
                <View style={{ height: 30 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    backBtn: { padding: 5 },
    content: { padding: 15 },
    
    // Summary Card
    summaryCard: { borderRadius: 20, padding: 25, marginBottom: 25, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    summaryTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
    summaryKcal: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 10 },
    summaryMacros: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 15 },
    macroStat: { alignItems: 'center' },
    macroStatVal: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    macroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

    // Meal Sections
    mealSection: { marginBottom: 20 },
    mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 5 },
    mealTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    
    logCard: { padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    logHeader: { flexDirection: 'row', alignItems: 'center' },
    foodName: { fontSize: 15, fontWeight: '600' },
    timeText: { fontSize: 12, marginTop: 2 },
    kcalText: { fontSize: 15, fontWeight: 'bold', marginRight: 10 },
    deleteBtn: { padding: 5 },
    macroRow: { flexDirection: 'row', marginTop: 8, gap: 12 },
    macroMini: { fontSize: 12 },

    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, marginTop: 10, textAlign: 'center' }
});
