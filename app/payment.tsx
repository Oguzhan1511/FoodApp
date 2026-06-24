import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

export default function PaymentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user, updateUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Theme Colors
    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#fff';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#666';
    const primaryColor = isDark ? '#ff4d4d' : '#800020';
    const inputBg = isDark ? '#333' : '#f5f5f5';

    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [holderName, setHolderName] = useState('');
    const [processing, setProcessing] = useState(false);

    const isPremium = params.type === 'premium';
    const price = isPremium ? '99.00' : '250.00';
    const title = isPremium ? 'Premium Üyelik' : 'Diyet Programı';
    const description = isPremium ? 'Sınırsız Geçmiş Analizi ve İstatistikler' : '7 Günlük Kişiye Özel Diyet Listesi';

    const handlePayment = async () => {
        if (!cardNumber || !expiry || !cvv || !holderName) {
            Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
            return;
        }

        setProcessing(true);

        // Simulate API call
        setTimeout(async () => {
            try {
                if (!user) {
                    Alert.alert("Hata", "Oturum açmanız gerekiyor.");
                    setProcessing(false);
                    return;
                }

                if (isPremium) {
                    // --- PREMIUM PURCHASE LOGIC ---
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ role: 'premium' })
                        .eq('id', user.id);

                    if (profileError) throw profileError;

                    // Update local auth context state immediately
                    updateUser({ role: 'premium' });

                    Alert.alert("Tebrikler!", "Artık Premium üyesiniz! Tüm istatistiklere erişebilirsiniz.", [
                        {
                            text: "Harika",
                            onPress: () => {
                                router.dismissAll();
                                router.replace('/(tabs)/tracking' as any);
                            }
                        }
                    ]);
                    return;
                }

                // --- DIET PLAN PURCHASE LOGIC ---
                const planJson = params.planData as string;
                if (!planJson) {
                    Alert.alert("Hata", "Diyet planı verisi bulunamadı.");
                    setProcessing(false);
                    return;
                }

                const planData = JSON.parse(planJson);

                // 1. Save to diet_plans table
                const { data: plan, error: planError } = await supabase
                    .from('diet_plans')
                    .insert({
                        user_id: user.id,
                        plan_data: {
                            ...planData,
                            purchased_amount: 250,
                            purchased_dietitian_id: params.dietitianId || null
                        },
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (planError) throw planError;

                // 2. Schedule End Notification (7 days later)
                try {
                    const { notificationService } = require('../services/notificationService');
                    await notificationService.schedulePlanEndNotification(7);
                } catch (e) {
                    console.log("Notification scheduling error:", e);
                }

                // 3. Initialize diet_progress table
                const { error: progressError } = await supabase
                    .from('diet_progress')
                    .insert({
                        user_id: user.id,
                        plan_id: plan.id,
                        progress_data: {},
                        updated_at: new Date().toISOString()
                    });

                if (progressError) throw progressError;

                // 3. Update Local Storage (Legacy/Fallback)
                await AsyncStorage.setItem(`currentDietPlan_${user.id}`, planJson);
                await AsyncStorage.setItem(`dietPlanProgress_${user.id}`, '{}');

                // 4. Credit Dietitian Balance (if applicable)
                if (params.dietitianId) {
                    const TOTAL_PRICE = 250;
                    const COMMISSION_RATE = 0.10;
                    const earnings = TOTAL_PRICE * (1 - COMMISSION_RATE); // 225

                    const { error: balanceError } = await supabase.rpc('increment_balance', {
                        dietitian_id: params.dietitianId,
                        amount: earnings
                    });

                    if (balanceError) {
                        console.log("RPC Error, trying direct update fallback:", balanceError);
                        // Fallback: Direct select & update (less secure but works if RLS allows or RPC missing)
                        const { data: dData } = await supabase.from('dietitians').select('balance').eq('id', params.dietitianId).single();
                        if (dData) {
                            const newBalance = (dData.balance || 0) + earnings;
                            await supabase.from('dietitians').update({ balance: newBalance }).eq('id', params.dietitianId);
                        }
                    }
                }

                Alert.alert("Başarılı", "Ödeme alındı ve diyet programınız tanımlandı!", [
                    {
                        text: "Tamam",
                        onPress: () => {
                            router.dismissAll();
                            router.replace('/(tabs)/dietitian' as any); // Or redirect to specific page
                        }
                    }
                ]);

            } catch (error: any) {
                console.log("Payment Error:", error);
                Alert.alert("Hata", "Ödeme sırasında bir sorun oluştu.");
            } finally {
                setProcessing(false);
            }
        }, 2000);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Ödeme Yap</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>

                    <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
                        <Text style={[styles.summaryTitle, { color: primaryColor }]}>{title}</Text>
                        <Text style={[styles.priceText, { color: textColor }]}>₺{price}</Text>
                        <Text style={{ color: subTextColor, marginTop: 5 }}>{description}</Text>
                    </View>

                    <Text style={[styles.sectionTitle, { color: textColor }]}>Kart Bilgileri</Text>

                    <View style={[styles.form, { backgroundColor: cardBg }]}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: subTextColor }]}>Kart Üzerindeki İsim</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                placeholder="AD SOYAD"
                                placeholderTextColor={subTextColor}
                                value={holderName}
                                onChangeText={setHolderName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: subTextColor }]}>Kart Numarası</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                placeholder="0000 0000 0000 0000"
                                placeholderTextColor={subTextColor}
                                keyboardType="numeric"
                                maxLength={19}
                                value={cardNumber}
                                onChangeText={setCardNumber}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={[styles.label, { color: subTextColor }]}>Son Kullanma</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                    placeholder="AA/YY"
                                    placeholderTextColor={subTextColor}
                                    keyboardType="numeric"
                                    maxLength={5}
                                    value={expiry}
                                    onChangeText={setExpiry}
                                />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={[styles.label, { color: subTextColor }]}>CVV</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                                    placeholder="123"
                                    placeholderTextColor={subTextColor}
                                    keyboardType="numeric"
                                    maxLength={3}
                                    value={cvv}
                                    onChangeText={setCvv}
                                />
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.payButton, { backgroundColor: primaryColor }]}
                        onPress={handlePayment}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.payButtonText}>Ödeme Yap ve Uygula</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.secureBadge}>
                        <Ionicons name="lock-closed" size={16} color={subTextColor} />
                        <Text style={{ color: subTextColor, marginLeft: 5, fontSize: 12 }}>
                            Ödemeniz 256-bit SSL ile korunmaktadır.
                        </Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    summaryCard: {
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        marginBottom: 30,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    priceText: { fontSize: 32, fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginLeft: 5 },
    form: {
        padding: 20,
        borderRadius: 15,
        marginBottom: 20
    },
    inputGroup: { marginBottom: 15 },
    row: { flexDirection: 'row' },
    label: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
    input: {
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
    },
    payButton: {
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5
    },
    payButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20
    }
});
