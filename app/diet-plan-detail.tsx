import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

export default function DietPlanDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#fff';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#666';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';
    const inputBg = isDark ? '#333' : '#f5f5f5';

    const [plan, setPlan] = useState<any>(null);
    const [progress, setProgress] = useState<any>({});
    const [planId, setPlanId] = useState<string | null>(null); // Keep track of DB ID
    const [loading, setLoading] = useState(true);
    const [isPreview, setIsPreview] = useState(false);

    // Note Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [currentMealKey, setCurrentMealKey] = useState<{ day: string, meal: string } | null>(null);
    const [tempNote, setTempNote] = useState('');

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        try {
            // If passed via params (Preview Mode)
            if (params.planData) {
                // Alert.alert("Debug", `Param received: ${params.planData.length} chars`);
                setPlan(JSON.parse(params.planData as string));

                if (params.progressData) {
                    setProgress(JSON.parse(params.progressData as string));
                }

                setIsPreview(true);
                setLoading(false);
                return;
            } else {
                // Alert.alert("Debug", "No params received");
            }

            const planJson = await AsyncStorage.getItem(`currentDietPlan_${user.id}`);
            const progressJson = await AsyncStorage.getItem(`dietPlanProgress_${user.id}`);

            if (planJson) setPlan(JSON.parse(planJson));
            if (progressJson) setProgress(JSON.parse(progressJson));
        } catch (e) {
            Alert.alert("Hata", "Veriler yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const toggleMeal = async (day: string, meal: string) => {
        if (!user) return;
        const key = `${day}_${meal}`;
        const newProgress = { ...progress, [key]: { ...progress[key], completed: !progress[key]?.completed } };
        setProgress(newProgress);
        await AsyncStorage.setItem(`dietPlanProgress_${user.id}`, JSON.stringify(newProgress));
    };

    const openNoteModal = (day: string, meal: string) => {
        const key = `${day}_${meal}`;
        setCurrentMealKey({ day, meal });
        setTempNote(progress[key]?.note || '');
        setModalVisible(true);
    };

    const saveNote = async () => {
        if (!currentMealKey || !user) return;
        const key = `${currentMealKey.day}_${currentMealKey.meal}`;
        const newProgress = { ...progress, [key]: { ...progress[key], note: tempNote } };
        setProgress(newProgress);
        await AsyncStorage.setItem(`dietPlanProgress_${user.id}`, JSON.stringify(newProgress));
        setModalVisible(false);
    };

    if (loading) return <View style={[styles.container, { backgroundColor: bgColor }]} />;

    if (!plan) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="nutrition-outline" size={64} color={subTextColor} />
                <Text style={{ color: subTextColor, marginTop: 20 }}>Henüz aktif bir diyet programınız yok.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 10 }}>
                    <Text style={{ color: primaryColor }}>Geri Dön</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const MEALS = [
        { key: 'breakfast', label: 'Kahvaltı' },
        { key: 'lunch', label: 'Öğle' },
        { key: 'dinner', label: 'Akşam' }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Diyet Programım</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 40 }}>
                {DAYS.map(day => (
                    <View key={day} style={[styles.dayCard, { backgroundColor: cardBg }]}>
                        <Text style={[styles.dayTitle, { color: primaryColor }]}>{day}</Text>
                        {MEALS.map(meal => {
                            const mealText = plan[day]?.[meal.key] || '-';
                            const key = `${day}_${meal.key}`;
                            const isCompleted = progress[key]?.completed;
                            const note = progress[key]?.note;

                            return (
                                <View key={meal.key} style={[styles.mealRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.mealLabel, { color: subTextColor }]}>{meal.label}</Text>
                                        <Text style={[styles.mealText, { color: textColor, textDecorationLine: isCompleted ? 'line-through' : 'none' }]}>
                                            {mealText}
                                        </Text>
                                        {note ? (
                                            <Text style={{ color: '#ffa500', fontSize: 12, marginTop: 4 }}>📝 {note}</Text>
                                        ) : null}
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <TouchableOpacity onPress={() => openNoteModal(day, meal.key)} style={{ marginRight: 15 }}>
                                            <Ionicons name="document-text-outline" size={24} color={subTextColor} />
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => toggleMeal(day, meal.key)}>
                                            <Ionicons
                                                name={isCompleted ? "checkbox" : "square-outline"}
                                                size={28}
                                                color={isCompleted ? primaryColor : subTextColor}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>

            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
                        <Text style={[styles.modalTitle, { color: textColor }]}>Not Ekle</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                            placeholder="Bu öğün için notunuz..."
                            placeholderTextColor={subTextColor}
                            value={tempNote}
                            onChangeText={setTempNote}
                            multiline
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalBtn, { backgroundColor: '#555' }]}>
                                <Text style={{ color: '#fff' }}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveNote} style={[styles.modalBtn, { backgroundColor: primaryColor }]}>
                                <Text style={{ color: '#fff' }}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    dayCard: {
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        elevation: 2
    },
    dayTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10
    },
    mealRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1
    },
    mealLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2
    },
    mealText: {
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        borderRadius: 15,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center'
    },
    input: {
        borderRadius: 8,
        padding: 10,
        minHeight: 80,
        marginBottom: 20,
        textAlignVertical: 'top'
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    modalBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5
    }
});
