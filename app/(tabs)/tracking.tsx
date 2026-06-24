import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabaseConfig';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { scraperService } from '../../services/scraperService';
import { Pedometer } from 'expo-sensors';

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
    const [streak, setStreak] = useState(0);
    const [currentTip, setCurrentTip] = useState('');
    const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);
    const [weightHistory, setWeightHistory] = useState<{ date: string, weight: string }[]>([]);
    const [waterIntake, setWaterIntake] = useState(0); // Daily total in ml
    const [waterHistory, setWaterHistory] = useState<{ date: string, total: number }[]>([]);
    const [dailyCalories, setDailyCalories] = useState(0);
    const [dailyMacros, setDailyMacros] = useState({ protein: 0, fat: 0, carbs: 0 });
    const [currentPlan, setCurrentPlan] = useState<any>(null);
    const [historyPeriod, setHistoryPeriod] = useState(7); // 7, 30, 90 gün
    const [selectedChartType, setSelectedChartType] = useState('water'); // water, weight, calories, deficit
    const [historicalCalories, setHistoricalCalories] = useState<number[]>([]);
    const [historicalDeficit, setHistoricalDeficit] = useState<number[]>([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [tempStats, setTempStats] = useState(stats);

    // New State for Manual Entry
    const [foodQuery, setFoodQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // --- ACTIVITY (PEDOMETER & EXERCISE) STATE ---
    const [stepCount, setStepCount] = useState<number | null>(null);
    const [exercises, setExercises] = useState<any[]>([]);
    const [exModalVisible, setExModalVisible] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<any>(null);
    const [durationStr, setDurationStr] = useState('');

    const EXERCISE_DB = [
        { id: '1', name: '🏃 Koşu', kcalPerMin: 10 },
        { id: '2', name: '🚶 Yürüyüş', kcalPerMin: 5 },
        { id: '3', name: '🚴 Bisiklet', kcalPerMin: 8 },
        { id: '4', name: '🏋️ Ağırlık Antrenmanı', kcalPerMin: 6 },
        { id: '5', name: '🏊 Yüzme', kcalPerMin: 9 },
        { id: '6', name: '🧘 Yoga', kcalPerMin: 4 },
    ];

    const healthTips = [
        "Yemekten 30 dk önce su içmek metabolizmayı %24 hızlandırabilir. 💧",
        "Günde 7-8 saat uyumak yağ yakımını destekler. 😴",
        "Protein bazlı kahvaltılar gün boyu iştah kontrolü sağlar. 🍳",
        "Magnezyum eksikliği tatlı krizlerine yol açabilir; fındık tüketin. 🥜",
        "Yemekleri yavaş çiğnemek tokluk hissini artırır. 🐢",
        "Günde 10.000 adım kalp sağlığınız için en iyi yatırımdır. 👟",
        "Yeşil çay antioksidan etkisiyle yağ yakımına yardımcı olur. 🍵",
        "Öğünlerinizde lifli gıdalara (sebzelere) yer verin. 🥦"
    ];

    const allBadges = [
        { id: 'first_log', name: 'İlk Adım', icon: 'footsteps', color: '#4CAF50', desc: 'İlk besin kaydını tamamladın!' },
        { id: 'water_master', name: 'Su Ejderhası', icon: 'water', color: '#2196F3', desc: 'Günlük su hedefini 2L üzerine çıkardın.' },
        { id: 'streak_3', name: '3 Günlük Seri', icon: 'flame', color: '#FF5722', desc: 'Üst üste 3 gün kayıt yaparak kazanılır.' },
        { id: 'early_bird', name: 'Erkenci Kuş', icon: 'sunny', color: '#FFC107', desc: 'Sabah 09:00 öncesi kahvaltı kaydı yaparak kazanılır.' },
        { id: 'macro_hero', name: 'Makro Kahramanı', icon: 'medal', color: '#9C27B0', desc: 'Tüm makro hedeflerine tam isabet tutturunca kazanılır.' }
    ];

    useEffect(() => {
        if (user) {
            loadStats();
            checkStreak();
            loadFeaturedBadges();
            const tipIndex = new Date().getDate() % healthTips.length;
            setCurrentTip(healthTips[tipIndex]);
        }
    }, [user]);

    const loadFeaturedBadges = async () => {
        if (!user) return;
        try {
            const stored = await AsyncStorage.getItem(`featuredBadges_${user.id}`);
            if (stored) setFeaturedBadges(JSON.parse(stored));
        } catch (e) { console.error(e); }
    };

    const toggleFeaturedBadge = async (badgeId: string) => {
        if (!user) return;
        try {
            let newList = [...featuredBadges];
            if (newList.includes(badgeId)) {
                newList = newList.filter(id => id !== badgeId);
                Alert.alert("Başarılı", "Rozet profilden kaldırıldı.");
            } else {
                if (newList.length >= 4) {
                    Alert.alert("Limit Dolu", "Profilinde en fazla 4 rozet sergileyebilirsin.");
                    return;
                }
                newList.push(badgeId);
                Alert.alert("Başarılı", "Rozet artık profilinde sergilenecek! 🌟");
            }
            setFeaturedBadges(newList);
            await AsyncStorage.setItem(`featuredBadges_${user.id}`, JSON.stringify(newList));
        } catch (e) { console.error(e); }
    };

    const checkStreak = async () => {
        if (!user) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const streakData = await AsyncStorage.getItem(`userStreak_${user.id}`);
            let { count, lastDate } = streakData ? JSON.parse(streakData) : { count: 0, lastDate: '' };

            if (lastDate === today) {
                setStreak(count);
                return;
            }

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastDate === yesterdayStr) {
                count += 1;
            } else {
                count = 1;
            }

            await AsyncStorage.setItem(`userStreak_${user.id}`, JSON.stringify({ count, lastDate: today }));
            setStreak(count);
        } catch (e) { console.error(e); }
    };

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
                .select('id, user_id, weight, date')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (data) {
                setWeightHistory(data);
            }
        } catch (e) {
            console.error('Failed to load data');
        }
    };

    const loadWaterIntake = async (days = historyPeriod) => {
        if (!user) return;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const dateLimit = startDate.toISOString();

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

                // 2. Aggregate Last X Days (Filling gaps with 0)
                const grouped: { [key: string]: number } = {};
                for (let i = 0; i < days; i++) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    grouped[d.toISOString().split('T')[0]] = 0;
                }

                data.forEach(entry => {
                    const date = entry.created_at.split('T')[0];
                    if (grouped[date] !== undefined) {
                        grouped[date] += entry.amount_ml;
                    }
                });

                const historyArray = Object.keys(grouped).map(date => ({
                    date,
                    total: grouped[date]
                })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setWaterHistory(historyArray);
            }
        } catch (e) { console.error(e); }
    };

    const loadHistoricalLogs = async (days = historyPeriod) => {
        if (!user) return;
        try {
            const foodKeys: string[] = [];
            const exKeys: string[] = [];
            const dates: string[] = [];
            
            for (let i = 0; i < days; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                dates.push(dateStr);
                foodKeys.push(`daily_food_log_${user.id}_${dateStr}`);
                exKeys.push(`daily_exercise_log_${user.id}_${dateStr}`);
            }

            const foodResults = await AsyncStorage.multiGet(foodKeys);
            const exResults = await AsyncStorage.multiGet(exKeys);

            const calHistory: number[] = [];
            const defHistory: number[] = [];

            for (let i = 0; i < days; i++) {
                const fVal = foodResults[i][1];
                const eVal = exResults[i][1];
                
                const consumed = fVal ? JSON.parse(fVal).reduce((sum: number, item: any) => sum + (parseFloat(item.kcal) || 0), 0) : 0;
                const burned = eVal ? JSON.parse(eVal).reduce((sum: number, item: any) => sum + (parseFloat(item.kcalBurned) || 0), 0) : 0;
                
                calHistory.push(Math.round(consumed));
                defHistory.push(Math.round(burned - consumed));
            }

            setHistoricalCalories(calHistory);
            setHistoricalDeficit(defHistory);
        } catch (e) { console.error("History log error:", e); }
    };

    useEffect(() => {
        const fetchSteps = async () => {
            try {
                const { granted } = await Pedometer.requestPermissionsAsync();
                if (!granted) return;
                const isAvailable = await Pedometer.isAvailableAsync();
                if (isAvailable) {
                    const end = new Date();
                    const start = new Date();
                    start.setHours(0,0,0,0);
                    const result = await Pedometer.getStepCountAsync(start, end);
                    if (result) setStepCount(result.steps);
                }
            } catch (e) {
                console.log("Adımsayar hatası:", e);
            }
        };

        if (user) {
            loadWaterIntake(historyPeriod);
            loadHistoricalLogs(historyPeriod);
            loadDailyFoodLog();
            fetchSteps();
            fetchCurrentPlan();
        }
    }, [user, historyPeriod]);

    const fetchCurrentPlan = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('diet_plans')
                .select('id, user_id, plan_data, dietitian_id, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                setCurrentPlan(data[0]);
            }
        } catch (e) { console.log("Plan fetch error:", e); }
    };

    const loadDailyFoodLog = async () => {
        if (!user) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const logKey = `daily_food_log_${user.id}_${today}`;
            const stored = await AsyncStorage.getItem(logKey);
            
            let totalKcal = 0;
            let totalP = 0, totalF = 0, totalC = 0;

            if (stored) {
                const logs = JSON.parse(stored);
                logs.forEach((item: any) => {
                    totalKcal += parseFloat(item.kcal) || 0;
                    totalP += parseFloat(item.protein) || 0;
                    totalF += parseFloat(item.fat) || 0;
                    totalC += parseFloat(item.carbs) || 0;
                });
            }

            setDailyCalories(Math.round(totalKcal));
            setDailyMacros({
                protein: Math.round(totalP),
                fat: Math.round(totalF),
                carbs: Math.round(totalC)
            });

            // Egzersizleri de yükle
            const exerciseKey = `daily_exercise_log_${user.id}_${today}`;
            const storedExercise = await AsyncStorage.getItem(exerciseKey);
            if (storedExercise) {
                setExercises(JSON.parse(storedExercise));
            }

        } catch (e) { console.log("Food log error:", e); }
    };

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

    const deleteExerciseItem = async (index: number) => {
        Alert.alert("Egzersizi Sil", "Bu egzersizi silmek istediğinize emin misiniz?", [
            { text: "Vazgeç", style: "cancel" },
            {
                text: "Sil", style: "destructive",
                onPress: async () => {
                    if (!user?.id) return;
                    const newEx = [...exercises];
                    newEx.splice(index, 1);
                    const today = new Date().toISOString().split('T')[0];
                    await AsyncStorage.setItem(`daily_exercise_log_${user.id}_${today}`, JSON.stringify(newEx));
                    setExercises(newEx);
                }
            }
        ]);
    };

    const handleSaveExercise = async () => {
        if (!selectedExercise || !durationStr || !user?.id) return;
        const duration = parseInt(durationStr);
        if (isNaN(duration) || duration <= 0) {
            Alert.alert("Hata", "Lütfen geçerli bir süre giriniz.");
            return;
        }

        const kcalBurned = duration * selectedExercise.kcalPerMin;
        const newExerciseObj = {
            id: Date.now().toString(),
            name: selectedExercise.name,
            duration: duration,
            kcalBurned: kcalBurned,
            date: new Date().toISOString()
        };

        const newExercises = [...exercises, newExerciseObj];
        setExercises(newExercises);
        
        const today = new Date().toISOString().split('T')[0];
        await AsyncStorage.setItem(`daily_exercise_log_${user.id}_${today}`, JSON.stringify(newExercises));

        setDurationStr('');
        setSelectedExercise(null);
        setExModalVisible(false);
    };

    const handleAddManualFood = async () => {
        if (!foodQuery.trim() || !user) return;

        setIsSearching(true);
        try {
            const query = foodQuery.trim().toLowerCase();
            
            // 1. Gramaj veya Adet Tespiti
            const gramMatch = query.match(/^(\d+[,.]?\d*)\s*(?:gram|gr|g)\b/i);
            const portionMatch = query.match(/^(\d+[,.]?\d*)\s*(?:porsiyon|tabak|kase|bardak|dilim|adet|tane)\b/i);
            const quantityMatch = query.match(/^(\d+[,.]?\d*)/);
            
            let amount = 1;
            let isGram = false;
            let unitName = '';
            let searchTitle = query;

            if (gramMatch) {
                amount = parseFloat(gramMatch[1].replace(',', '.'));
                isGram = true;
                searchTitle = query.replace(/^(\d+[,.]?\d*)\s*(?:gram|gr|g)\b/i, '').trim();
            } else if (portionMatch) {
                amount = parseFloat(portionMatch[1].replace(',', '.'));
                unitName = query.match(/(?:porsiyon|tabak|kase|bardak|dilim|adet|tane)/i)?.[0] || '';
                searchTitle = query.replace(/^(\d+[,.]?\d*)\s*(?:porsiyon|tabak|kase|bardak|dilim|adet|tane)\b/i, '').trim();
            } else if (quantityMatch) {
                amount = parseFloat(quantityMatch[1].replace(',', '.'));
                searchTitle = query.replace(/^(\d+[,.]?\d*)/, '').trim();
            }

            // 2. Veriyi çek
            const result = await scraperService.searchCalories(searchTitle || query, true);
            
            if (result.startsWith('NUTRITION_DATA:::')) {
                const data = JSON.parse(result.replace('NUTRITION_DATA:::', ''));
                
                let finalKcal = 0, finalP = 0, finalF = 0, finalC = 0;

                if (isGram && data.per100) {
                    const ratio = amount / 100;
                    finalKcal = (parseFloat(data.per100.kcal) || 0) * ratio;
                    finalP = (parseFloat(data.per100.protein) || 0) * ratio;
                    finalF = (parseFloat(data.per100.fat) || 0) * ratio;
                    finalC = (parseFloat(data.per100.carbs) || 0) * ratio;
                } else {
                    finalKcal = (parseFloat(data.kcal) || 0) * amount;
                    finalP = (parseFloat(data.protein) || 0) * amount;
                    finalF = (parseFloat(data.fat) || 0) * amount;
                    finalC = (parseFloat(data.carbs) || 0) * amount;
                }

                // --- GÜVENLİK SİGORTASI: Makro bazlı kalori kontrolü ---
                const calculatedKcal = (finalP * 4) + (finalF * 9) + (finalC * 4);
                if (finalKcal < calculatedKcal * 0.8) {
                    finalKcal = calculatedKcal;
                }
                // ---------------------------------------------------

                const foodItemName = isGram ? `${amount}g ${data.name}` : 
                                     unitName ? `${amount} ${unitName} ${data.name}` : 
                                     amount !== 1 ? `${amount}x ${data.name}` : data.name;

                const foodItem = {
                    name: foodItemName,
                    kcal: finalKcal,
                    protein: finalP,
                    fat: finalF,
                    carbs: finalC,
                    date: new Date().toISOString()
                };

                // 3. Günlüğe kaydet
                const today = new Date().toISOString().split('T')[0];
                const logKey = `daily_food_log_${user.id}_${today}`;
                const stored = await AsyncStorage.getItem(logKey);
                const currentLogs = stored ? JSON.parse(stored) : [];
                currentLogs.push(foodItem);
                
                await AsyncStorage.setItem(logKey, JSON.stringify(currentLogs));
                
                // 4. Başarılı
                setFoodQuery('');
                loadDailyFoodLog();
                Alert.alert("Başarılı", `${amount}${isGram ? 'g' : ''} ${data.name} eklendi! 🔥`);
            } else {
                Alert.alert("Bulunamadı", "Girdiğiniz besin bulunamadı. Lütfen farklı kelimelerle deneyin.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Hata", "Bir sorun oluştu.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleEdit = () => {
        setTempStats(stats);
        setModalVisible(true);
    };

    const consumedKcal = dailyCalories;
    const stepKcal = stepCount ? Math.round(stepCount * 0.045) : 0;
    const exerciseKcal = exercises.reduce((acc, curr) => acc + curr.kcalBurned, 0);
    const burnedKcal = stepKcal + exerciseKcal;
    const netKcal = consumedKcal - burnedKcal;

    const getDenseWeightHistory = () => {
        const dense: number[] = [];
        // Sort ascending to easily find previous values
        const sorted = [...weightHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (let i = historyPeriod - 1; i >= 0; i--) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - i);
            const dateStr = targetDate.toISOString().split('T')[0];

            // Find entry for this specific day
            const entry = sorted.find(h => h.date.startsWith(dateStr));
            
            if (entry) {
                dense.push(parseFloat(entry.weight));
            } else {
                // If no entry, find the most recent one BEFORE this day
                const prevEntries = sorted.filter(h => new Date(h.date) < new Date(dateStr));
                if (prevEntries.length > 0) {
                    dense.push(parseFloat(prevEntries[prevEntries.length - 1].weight));
                } else {
                    // Use starting weight if no history exists yet
                    dense.push(parseFloat(stats.weight) || 0);
                }
            }
        }
        return dense;
    };

    const getXLabels = () => {
        if (historyPeriod !== 7) return undefined;
        const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        const labels = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(days[d.getDay()]);
        }
        return labels;
    };

    const calculateProgress = () => {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - historyPeriod);
        const filtered = weightHistory.filter(h => new Date(h.date) >= limitDate);

        if (filtered.length < 2) return { diff: '0.0', status: 'Veri Bekleniyor' };
        
        const latest = parseFloat(filtered[0].weight);
        const earliest = parseFloat(filtered[filtered.length - 1].weight);
        const diff = latest - earliest;
        
        let status = 'Stabil';
        if (diff < -0.3) status = 'Kilo Kaybı (👍)';
        else if (diff > 0.3) status = 'Kilo Artışı (⚠️)';
        
        return { diff: (diff > 0 ? '+' : '') + diff.toFixed(1), status };
    };

    const MiniChart = ({ data, color, max, min = 0, xLabels }: { data: number[], color: string, max: number, min?: number, xLabels?: string[] }) => {
        const chartHeight = 100;
        const range = Math.max(1, max - min);
        
        // Calculate axis labels (Top, Middle, Bottom)
        const mid = (max + min) / 2;
        const yLabels = [max, mid, min];

        return (
            <View>
                <View style={{ flexDirection: 'row', marginTop: 15, backgroundColor: isDark ? '#222' : '#f9f9f9', borderRadius: 10, padding: 10, paddingBottom: xLabels ? 5 : 10 }}>
                    {/* Y-Axis Labels */}
                    <View style={{ justifyContent: 'space-between', height: chartHeight - 20, marginRight: 8, paddingVertical: 2 }}>
                        {yLabels.map((label, i) => (
                            <Text key={i} style={{ color: subTextColor, fontSize: 9, textAlign: 'right', width: 35 }}>
                                {label > 1000 ? `${(label/1000).toFixed(1)}k` : label.toFixed(label % 1 === 0 ? 0 : 1)}
                            </Text>
                        ))}
                    </View>

                    {/* Chart Bars Area */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: chartHeight - 20 }}>
                        {data.length === 0 ? (
                            <Text style={{ color: subTextColor, fontSize: 12, textAlign: 'center', width: '100%', alignSelf: 'center' }}>Veri bulunmuyor</Text>
                        ) : (
                            data.map((val, idx) => (
                                <View key={idx} style={{ 
                                    flex: 1, 
                                    height: Math.max(2, ((val - min) / range) * (chartHeight - 20)), 
                                    backgroundColor: color, 
                                    marginHorizontal: 1, 
                                    borderRadius: 2,
                                    opacity: 0.8
                                }} />
                            ))
                        )}
                    </View>
                </View>

                {/* X-Axis Labels (Days) */}
                {xLabels && (
                    <View style={{ flexDirection: 'row', marginLeft: 43, marginTop: 5 }}>
                        {xLabels.map((label, i) => (
                            <Text key={i} style={{ flex: 1, color: subTextColor, fontSize: 8, textAlign: 'center' }}>
                                {label}
                            </Text>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
                <Text style={[styles.headerTitle, { color: textColor }]}>Kişisel Takip</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {/* --- KALORİ DENGESİ (NET KALORİ) --- */}
                <View style={[styles.card, { backgroundColor: primaryColor, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20 }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', marginBottom: 15 }}>Kalori Dengesi</Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 15 }}>
                        <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{consumedKcal}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 }}>🍔 Alınan</Text>
                        </View>
                        <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: 'bold', marginHorizontal: 2, marginBottom: 15 }}>-</Text>
                        </View>
                        <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{burnedKcal}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 }}>🔥 Yakılan</Text>
                        </View>
                        <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: 'bold', marginHorizontal: 2, marginBottom: 15 }}>=</Text>
                        </View>
                        <View style={{ alignItems: 'center', marginHorizontal: 5 }}>
                            <Text style={{ fontSize: 26, fontWeight: 'bold', color: netKcal > 0 ? '#FFD700' : '#4ADE80' }}>
                                {Math.abs(netKcal)}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 }}>⚖️ Net</Text>
                        </View>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 }}>
                        <Ionicons name="footsteps" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                            Adımsayar: {stepCount !== null ? stepCount.toLocaleString('tr-TR') : '0'} adım ({stepKcal} kcal)
                        </Text>
                    </View>
                </View>

                {/* --- ANALYTICS & PROGRESS (NEW SECTION) --- */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="analytics-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>İlerleme Durumu</Text>
                        </View>
                        <View style={{ flexDirection: 'row', backgroundColor: inputBg, borderRadius: 10, padding: 4 }}>
                            {[7, 30, 90, 180].map(p => {
                                const isPremiumRequired = p >= 90;
                                const isLocked = isPremiumRequired && user?.role !== 'premium';
                                
                                return (
                                    <TouchableOpacity 
                                        key={p} 
                                        onPress={() => {
                                            if (isLocked) {
                                                Alert.alert(
                                                    "Premium Özellik",
                                                    `${p === 90 ? '3 Aylık' : '6 Aylık'} geçmişi görmek için Premium üyeliğe geçmelisiniz.`,
                                                    [
                                                        { text: "Vazgeç", style: "cancel" },
                                                        { text: "Premium Al", onPress: () => router.push('/payment?type=premium' as any) }
                                                    ]
                                                );
                                                return;
                                            }
                                            setHistoryPeriod(p);
                                        }}
                                        style={{ 
                                            paddingHorizontal: 8, 
                                            paddingVertical: 5, 
                                            backgroundColor: historyPeriod === p ? primaryColor : 'transparent',
                                            borderRadius: 8,
                                            flexDirection: 'row',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ color: historyPeriod === p ? '#fff' : subTextColor, fontSize: 10, fontWeight: 'bold' }}>
                                            {p === 180 ? '6 AY' : p === 90 ? '3 AY' : p + ' G'}
                                        </Text>
                                        {isLocked && (
                                            <Ionicons name="lock-closed" size={8} color={subTextColor} style={{ marginLeft: 2 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* CHART TYPE SELECTOR */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                        {[
                            { id: 'water', label: 'Su', icon: 'water', color: '#00bcd4' },
                            { id: 'weight', label: 'Kilo', icon: 'scale', color: '#9c27b0' },
                            { id: 'calories', label: 'Kalori', icon: 'fast-food', color: '#ff9800' },
                            { id: 'deficit', label: 'Açık', icon: 'trending-down', color: '#4caf50' }
                        ].map(type => (
                            <TouchableOpacity 
                                key={type.id}
                                onPress={() => setSelectedChartType(type.id)}
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    paddingHorizontal: 12, 
                                    paddingVertical: 8, 
                                    borderRadius: 20, 
                                    backgroundColor: selectedChartType === type.id ? type.color : (isDark ? '#333' : '#eee'),
                                    borderWidth: 1,
                                    borderColor: selectedChartType === type.id ? 'transparent' : borderColor
                                }}
                            >
                                <Ionicons name={type.icon as any} size={14} color={selectedChartType === type.id ? '#fff' : subTextColor} style={{ marginRight: 5 }} />
                                <Text style={{ color: selectedChartType === type.id ? '#fff' : textColor, fontSize: 11, fontWeight: 'bold' }}>{type.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ marginBottom: 15 }}>
                        {selectedChartType === 'water' && (
                            <>
                                <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>Su Tüketim Trendi (ml)</Text>
                                <MiniChart 
                                    data={waterHistory.map(h => h.total).reverse()} 
                                    color="#00bcd4" 
                                    max={Math.max(...waterHistory.map(h => h.total), 2000)} 
                                    xLabels={getXLabels()}
                                />
                            </>
                        )}
                        {selectedChartType === 'weight' && (
                            <>
                                <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>Kilo Takibi (kg)</Text>
                                <MiniChart 
                                    data={getDenseWeightHistory()} 
                                    color="#9c27b0" 
                                    min={Math.min(...getDenseWeightHistory(), parseFloat(stats.weight)) - 1}
                                    max={Math.max(...getDenseWeightHistory(), parseFloat(stats.weight)) + 1} 
                                    xLabels={getXLabels()}
                                />
                            </>
                        )}
                        {selectedChartType === 'calories' && (
                            <>
                                <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>Alınan Günlük Kalori (kcal)</Text>
                                <MiniChart 
                                    data={historicalCalories.slice().reverse()} 
                                    color="#ff9800" 
                                    max={Math.max(...historicalCalories, 2500)} 
                                    xLabels={getXLabels()}
                                />
                            </>
                        )}
                        {selectedChartType === 'deficit' && (
                            <>
                                <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>Günlük Kalori Açığı/Fazlası (kcal)</Text>
                                <MiniChart 
                                    data={historicalDeficit.slice().reverse()} 
                                    color="#4caf50" 
                                    min={Math.min(...historicalDeficit, 0)}
                                    max={Math.max(...historicalDeficit, 500)} 
                                    xLabels={getXLabels()}
                                />
                            </>
                        )}
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            {historyPeriod !== 7 && <Text style={{ color: subTextColor, fontSize: 10 }}>{historyPeriod} gün önce</Text>}
                            {historyPeriod !== 7 && <Text style={{ color: subTextColor, fontSize: 10 }}>Bugün</Text>}
                        </View>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 15 }}>
                        <Text style={{ color: textColor, fontSize: 15, fontWeight: '600' }}>Kilo Analizi</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: subTextColor, fontSize: 11 }}>Toplam Değişim</Text>
                                <Text style={{ color: textColor, fontSize: 18, fontWeight: 'bold' }}>{calculateProgress().diff} kg</Text>
                            </View>
                            <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                                <Text style={{ color: subTextColor, fontSize: 11 }}>Durum Özeti</Text>
                                <Text style={{ color: primaryColor, fontSize: 13, fontWeight: 'bold' }}>{calculateProgress().status}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* --- EGZERSİZLER LİSTESİ VE BUTONU (ÜSTE TAŞINDI) --- */}
                {exercises.length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 5 }}>
                            <Ionicons name="barbell" size={20} color="#4ADE80" />
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 10, color: textColor }}>Günün Egzersizleri</Text>
                        </View>
                        {exercises.map((ex, index) => (
                            <View key={ex.id} style={{ padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, backgroundColor: cardBg, borderColor, elevation: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }}>{ex.name}</Text>
                                        <Text style={{ fontSize: 12, marginTop: 2, color: subTextColor }}>
                                            {ex.duration} dakika • {new Date(ex.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 15, fontWeight: 'bold', marginRight: 10, color: '#4ADE80' }}>-{ex.kcalBurned} kcal</Text>
                                    <TouchableOpacity onPress={() => deleteExerciseItem(index)} style={{ padding: 5 }}>
                                        <Ionicons name="trash-outline" size={18} color="#ff4d4d" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 15, marginBottom: 20, elevation: 2, backgroundColor: primaryColor }}
                    onPress={() => setExModalVisible(true)}
                >
                    <Ionicons name="add-circle" size={24} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }}>Egzersiz Ekle</Text>
                </TouchableOpacity>

                {/* MOTIVATION & STREAK CARD */}
                <View style={[styles.motivationCard, { backgroundColor: isDark ? '#2c1a1a' : '#fff5f5' }]}>
                    <View style={styles.motivationHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Ionicons name="bulb" size={22} color="#ff9800" />
                            <Text style={[styles.tipText, { color: textColor }]}>{currentTip}</Text>
                        </View>
                        <View style={[styles.streakBadge, { backgroundColor: primaryColor }]}>
                            <Ionicons name="flame" size={18} color="#fff" />
                            <Text style={styles.streakText}>{streak}</Text>
                        </View>
                    </View>
                </View>

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
                    onPress={() => router.push('/weight-tracking' as any)}
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
                    onPress={() => router.push('/diet-plan-detail' as any)}
                >
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="nutrition-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Diyet Programım</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={subTextColor} />
                    </View>
                    <View style={{ marginTop: 5 }}>
                        {currentPlan ? (() => {
                            const endDate = new Date(new Date(currentPlan.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
                            const isFinished = endDate < new Date();
                            
                            return (
                                <>
                                    <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 14 }}>
                                        {isFinished 
                                            ? "Diyet programın süresi tamamlandı." 
                                            : `Bitiş: ${endDate.toLocaleDateString('tr-TR')}`
                                        }
                                    </Text>
                                    <Text style={{ color: subTextColor, fontSize: 14, fontStyle: 'italic', marginTop: 2 }}>
                                        Haftalık diyet listenizi görüntüleyin ve takip edin.
                                    </Text>
                                </>
                            );
                        })() : (
                            <Text style={{ color: subTextColor, fontSize: 14, fontStyle: 'italic' }}>
                                Haftalık diyet listenizi görüntüleyin ve takip edin.
                            </Text>
                        )}
                    </View>
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

                    {/* Yesterday's Water Intake Only */}
                    {(() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yesterdayStr = yesterday.toISOString().split('T')[0];
                        const yesterdayData = waterHistory.find(item => item.date === yesterdayStr);

                        if (yesterdayData) {
                            return (
                                <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: subTextColor, fontSize: 13, fontWeight: '600' }}>Dün:</Text>
                                    <Text style={{ color: '#00bcd4', fontWeight: 'bold' }}>{yesterdayData.total} ml</Text>
                                </View>
                            );
                        }
                        return null;
                    })()}
                </View>

                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="flame-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Kalori Özeti</Text>
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor }}>{dailyCalories} kcal</Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: subTextColor, fontSize: 12 }}>Protein</Text>
                            <Text style={{ color: textColor, fontWeight: 'bold' }}>{dailyMacros.protein}g</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: subTextColor, fontSize: 12 }}>Yağ</Text>
                            <Text style={{ color: textColor, fontWeight: 'bold' }}>{dailyMacros.fat}g</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: subTextColor, fontSize: 12 }}>Karbo</Text>
                            <Text style={{ color: textColor, fontWeight: 'bold' }}>{dailyMacros.carbs}g</Text>
                        </View>
                    </View>

                    {/* MANUEL GİRİŞ ALANI */}
                    <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: borderColor }}>
                        <Text style={[styles.historyTitle, { color: textColor, fontWeight: 'bold', marginBottom: 10 }]}>Hızlı Yemek Ekle</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TextInput
                                style={[styles.input, { flex: 1, backgroundColor: inputBg, color: textColor, marginRight: 10 }]}
                                placeholder="Örn: 2 elma, 1 muz..."
                                placeholderTextColor={subTextColor}
                                value={foodQuery}
                                onChangeText={setFoodQuery}
                                editable={!isSearching}
                            />
                            <TouchableOpacity 
                                style={{ backgroundColor: primaryColor, padding: 12, borderRadius: 10, width: 60, alignItems: 'center', justifyContent: 'center' }}
                                onPress={handleAddManualFood}
                                disabled={isSearching}
                            >
                                {isSearching ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="add" size={24} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: subTextColor, fontSize: 11, marginTop: 5 }}>Miktar belirtebilirsiniz (2 elma gibi).</Text>
                    </View>

                    <TouchableOpacity 
                        style={{ marginTop: 15, padding: 12, backgroundColor: isDark ? '#333' : '#f0f0f0', borderRadius: 8, alignItems: 'center' }}
                        onPress={() => router.push('/food-log' as any)}
                    >
                        <Text style={{ color: subTextColor, fontSize: 12, fontWeight: '600' }}>Detaylı Günlüğü Gör</Text>
                    </TouchableOpacity>
                </View>

                {/* BADGE COLLECTION CARD */}
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="trophy-outline" size={24} color={primaryColor} />
                            <Text style={[styles.cardTitle, { color: textColor }]}>Rozet Koleksiyonum</Text>
                        </View>
                    </View>
                    <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 15 }}>
                        Kazandığın rozetlerin üzerine dokunarak profilinde sergileyebilirsin.
                    </Text>
                    
                    <View style={styles.badgesGrid}>
                        {allBadges.map((badge) => {
                            const isFeatured = featuredBadges.includes(badge.id);
                            // Şimdilik test için ilk 2 rozet açık kabul ediliyor, diğerleri kilitli
                            const isUnlocked = badge.id === 'first_log' || badge.id === 'water_master';
                            
                            return (
                                <TouchableOpacity 
                                    key={badge.id} 
                                    style={[styles.badgeCollectionItem, { opacity: isUnlocked ? 1 : 0.4 }]}
                                    onPress={() => {
                                        if (isUnlocked) {
                                            Alert.alert(
                                                badge.name,
                                                `${badge.desc}\n\nBu rozeti profilinde sergilemek ister misin?`,
                                                [
                                                    { text: "Vazgeç", style: "cancel" },
                                                    { 
                                                        text: isFeatured ? "Profilden Kaldır" : "Profilde Sergile", 
                                                        onPress: () => toggleFeaturedBadge(badge.id) 
                                                    }
                                                ]
                                            );
                                        } else {
                                            Alert.alert("Kilitli Rozet", badge.desc);
                                        }
                                    }}
                                >
                                    <View style={[styles.badgeIconBg, { backgroundColor: isUnlocked ? badge.color + '20' : '#eee' }]}>
                                        <Ionicons name={badge.icon as any} size={24} color={isUnlocked ? badge.color : '#888'} />
                                        {isFeatured && (
                                            <View style={styles.featuredCheck}>
                                                <Ionicons name="star" size={10} color="#fff" />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.badgeLabel, { color: isFeatured ? primaryColor : subTextColor, fontWeight: isFeatured ? 'bold' : 'normal' }]}>
                                        {badge.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

            </ScrollView>

            {/* EGZERSİZ MODAL */}
            <Modal
                visible={exModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setExModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]}>
                    <View style={[styles.modalContent, { backgroundColor: bgColor, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.modalTitle, { color: textColor, marginBottom: 0 }]}>Egzersiz Seç</Text>
                            <TouchableOpacity onPress={() => { setExModalVisible(false); setSelectedExercise(null); setDurationStr(''); }}>
                                <Ionicons name="close" size={24} color={textColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 200, marginBottom: 15 }}>
                            {EXERCISE_DB.map(ex => (
                                <TouchableOpacity 
                                    key={ex.id} 
                                    style={[
                                        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 10, borderWidth: 1, marginBottom: 10, backgroundColor: cardBg, borderColor },
                                        selectedExercise?.id === ex.id && { borderColor: primaryColor, borderWidth: 2 }
                                    ]}
                                    onPress={() => setSelectedExercise(ex)}
                                >
                                    <Text style={{ fontSize: 16, fontWeight: '500', color: textColor }}>{ex.name}</Text>
                                    <Text style={{ color: subTextColor, fontSize: 12 }}>{ex.kcalPerMin} kcal/dk</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {selectedExercise && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ color: textColor, marginBottom: 5 }}>Süre (Dakika):</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor }]}
                                    keyboardType="numeric"
                                    placeholder="Örn: 30"
                                    placeholderTextColor={subTextColor}
                                    value={durationStr}
                                    onChangeText={setDurationStr}
                                />
                                {durationStr !== '' && !isNaN(parseInt(durationStr)) && (
                                    <Text style={{ color: '#4ADE80', marginTop: 5, fontWeight: 'bold' }}>
                                        🔥 Toplam Yakılacak: {parseInt(durationStr) * selectedExercise.kcalPerMin} kcal
                                    </Text>
                                )}
                            </View>
                        )}

                        <TouchableOpacity 
                            style={{ padding: 15, borderRadius: 10, alignItems: 'center', backgroundColor: selectedExercise && durationStr ? primaryColor : subTextColor }}
                            onPress={handleSaveExercise}
                            disabled={!selectedExercise || !durationStr}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Kaydet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    },
    // Motivation & Streak Styles
    motivationCard: {
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 77, 77, 0.1)',
        shadowColor: "#ff4d4d",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    motivationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tipText: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 10,
        marginRight: 10,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    streakText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 5,
    },
    // Badge Collection Styles
    badgesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 15,
    },
    badgeCollectionItem: {
        alignItems: 'center',
        width: (width - 100) / 3, // 3 column layout roughly
        marginBottom: 10,
    },
    badgeIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        position: 'relative',
    },
    badgeLabel: {
        fontSize: 11,
        textAlign: 'center',
    },
    featuredCheck: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FFD700',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    }
});
