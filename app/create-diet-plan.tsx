import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext'; // Ensure correct path

type DietPlan = {
    [day: string]: {
        breakfast: string;
        lunch: string;
        dinner: string;
    };
};

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const MEALS = [
    { key: 'breakfast', label: 'Kahvaltı' },
    { key: 'lunch', label: 'Öğle' },
    { key: 'dinner', label: 'Akşam' }
];

export default function CreateDietPlanScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams(); // Recipient ID to send back to chat
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#fff';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#666';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';
    const inputBg = isDark ? '#333' : '#f5f5f5';

    const [plan, setPlan] = useState<DietPlan>(
        DAYS.reduce((acc, day) => ({ ...acc, [day]: { breakfast: '', lunch: '', dinner: '' } }), {})
    );
    const [sending, setSending] = useState(false);

    const updateMeal = (day: string, meal: string, text: string) => {
        setPlan(prev => ({
            ...prev,
            [day]: { ...prev[day], [meal as keyof typeof prev[typeof day]]: text }
        }));
    };

    const handleSend = async () => {
        // Validate at least one entry? Or just send.
        setSending(true);
        try {
            // Ideally, we would send this data directly or save it.
            // For now, we'll pass it back to the chat screen via navigation params or a global store/event.
            // Since params can be limited in size, stringifying it might be risky if huge, but fine for text.

            const planString = JSON.stringify(plan);

            // Navigate back to Chat with the plan data
            router.replace({
                pathname: '/chat',
                params: {
                    userId: userId,
                    dietPlanData: planString
                }
            });
        } catch (error) {
            Alert.alert("Hata", "Liste oluşturulamadı.");
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Diyet Listesi Oluştur</Text>
                <TouchableOpacity onPress={handleSend} disabled={sending} style={styles.sendBtn}>
                    {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendText}>Gönder</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {DAYS.map((day) => (
                    <View key={day} style={[styles.dayCard, { backgroundColor: cardBg }]}>
                        <Text style={[styles.dayTitle, { color: primaryColor }]}>{day}</Text>
                        {MEALS.map((meal) => (
                            <View key={meal.key} style={styles.mealRow}>
                                <Text style={[styles.mealLabel, { color: subTextColor }]}>{meal.label}:</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                    value={plan[day][meal.key as keyof typeof plan[typeof day]]}
                                    onChangeText={(t) => updateMeal(day, meal.key, t)}
                                    placeholder={`${meal.label} içeriği...`}
                                    placeholderTextColor={subTextColor}
                                    multiline
                                />
                            </View>
                        ))}
                    </View>
                ))}
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
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333' // Adjust dynamically if needed
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    sendBtn: {
        backgroundColor: '#A00020', // Default primary 
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20
    },
    sendText: { color: '#fff', fontWeight: 'bold' },
    content: { padding: 15 },
    dayCard: {
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        elevation: 2
    },
    dayTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        textDecorationLine: 'underline'
    },
    mealRow: {
        marginBottom: 10
    },
    mealLabel: {
        fontSize: 14,
        marginBottom: 5,
        fontWeight: '600'
    },
    input: {
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        minHeight: 40
    }
});
