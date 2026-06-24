import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
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
    Image,
    Dimensions,
    FlatList,
    StatusBar,
    Modal
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PromotePostScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { postId } = useLocalSearchParams();

    const [activeTab, setActiveTab] = useState<'new' | 'active'>(postId ? 'new' : 'active');
    const [activeAds, setActiveAds] = useState<any[]>([]);
    const [activeProfileAd, setActiveProfileAd] = useState<any>(null);
    const [selectedAdForDetail, setSelectedAdForDetail] = useState<any>(null);

    const [promoType, setPromoType] = useState<'profile' | 'post'>(postId ? 'post' : 'profile');
    const [selectedPostId, setSelectedPostId] = useState<string>(postId as string || '');
    const [userPosts, setUserPosts] = useState<any[]>([]);
    const [postsLoading, setPostsLoading] = useState(false);
    
    const [keywordInput, setKeywordInput] = useState('');
    const [keywords, setKeywords] = useState<string[]>([]);
    const [budget, setBudget] = useState<number>(100);
    const [duration, setDuration] = useState<number>(3);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchActiveAds();
        }
    }, [user?.id]);

    useEffect(() => {
        if (promoType === 'post' && user?.id) {
            fetchUserPosts();
        }
    }, [promoType, user?.id]);

    const fetchActiveAds = async () => {
        if (!user?.id) return;
        try {
            const { data: posts } = await supabase
                .from('posts')
                .select('id, image_url, sponsor_budget, sponsor_views, likes, created_at, is_sponsored')
                .eq('user_id', user.id)
                .eq('is_sponsored', true);
            
            setActiveAds(posts || []);

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_sponsored, sponsor_budget, sponsor_views, sponsor_keywords, created_at')
                .eq('id', user.id)
                .single();
            
            if (profile?.is_sponsored) {
                setActiveProfileAd(profile);
            } else {
                const { data: diet } = await supabase
                    .from('dietitians')
                    .select('is_sponsored, sponsor_budget, sponsor_views, sponsor_keywords, created_at')
                    .eq('id', user.id)
                    .single();
                if (diet?.is_sponsored) setActiveProfileAd(diet);
            }
        } catch (e) {
            console.error("Active ads fetch error:", e);
        }
    };

    const fetchUserPosts = async () => {
        if (!user?.id) return;
        setPostsLoading(true);
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('id, image_url, description, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setUserPosts(data || []);
            if (data && data.length > 0 && !selectedPostId) {
                setSelectedPostId(data[0].id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setPostsLoading(false);
        }
    };

    const bgColor = isDark ? '#121212' : '#f8f8f8';
    const cardBg = isDark ? '#1e1e1e' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#333333';
    const subTextColor = isDark ? '#aaaaaa' : '#888888';
    const borderColor = isDark ? '#333333' : '#eeeeee';
    const primaryColor = isDark ? '#ff4d4d' : '#A00020';

    const BUDGET_OPTIONS = [50, 100, 200, 500, 1000];
    const DURATION_OPTIONS = [1, 3, 7, 15, 30];

    const minReach = Math.round(budget * duration * 10);
    const maxReach = Math.round(budget * duration * 15);

    const handleAddKeyword = () => {
        const trimmed = keywordInput.trim().toLowerCase();
        if (trimmed && !keywords.includes(trimmed)) {
            setKeywords([...keywords, trimmed]);
            setKeywordInput('');
        }
    };

    const removeKeyword = (kw: string) => {
        setKeywords(keywords.filter(k => k !== kw));
    };

    const handlePromote = async () => {
        if (promoType === 'post' && !selectedPostId) {
            Alert.alert("Hata", "Lütfen öne çıkarmak istediğiniz gönderiyi seçin.");
            return;
        }
        if (!user?.id) return;

        const totalBudget = budget * duration;
        Alert.alert(
            "Ödemeyi Onaylıyor Musunuz?",
            `Seçtiğiniz tanıtım için toplam ${totalBudget} ₺ ödeme alınacaktır.`,
            [
                { text: "Vazgeç", style: "cancel" },
                { 
                    text: "Öde ve Başlat", 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const keywordsString = keywords.join(', ');
                            if (promoType === 'post') {
                                await supabase.from('posts').update({ is_sponsored: true, sponsor_budget: totalBudget, sponsor_keywords: keywordsString || null }).eq('id', selectedPostId);
                            } else {
                                await supabase.from('profiles').update({ is_sponsored: true, sponsor_budget: totalBudget, sponsor_keywords: keywordsString || null }).eq('id', user.id);
                            }
                            Alert.alert("Tebrikler! 🎉", "Başarıyla öne çıkarıldı.", [{ text: "Tamam", onPress: () => router.back() }]);
                        } catch (e: any) {
                            Alert.alert("Hata", "İşlem başarısız.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderAnalyticsModal = () => {
        if (!selectedAdForDetail) return null;
        
        const ad = selectedAdForDetail;
        const totalBudget = ad.sponsor_budget || 0;
        const views = ad.sponsor_views || 0;
        const interactions = ad.likes || 0;
        const cpv = views > 0 ? (totalBudget / views).toFixed(2) : '0.00';
        const ctr = views > 0 ? ((interactions / views) * 100).toFixed(1) : '0.0';
        const progress = Math.min(100, (views / (totalBudget * 10)) * 100);

        return (
            <Modal visible={!!selectedAdForDetail} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: bgColor, maxHeight: '85%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: textColor }]}>Reklam Detayları</Text>
                            <TouchableOpacity onPress={() => setSelectedAdForDetail(null)}>
                                <Ionicons name="close" size={28} color={textColor} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                    {ad.image_url ? (
                                        <Image source={{ uri: ad.image_url.split(',')[0] }} style={styles.detailImg} />
                                    ) : (
                                        <View style={[styles.iconBg, { backgroundColor: primaryColor + '20' }]}><Ionicons name="person" size={24} color={primaryColor} /></View>
                                    )}
                                    <View style={{ marginLeft: 15 }}>
                                        <Text style={[styles.cardTitle, { color: textColor }]}>{ad.image_url ? 'Gönderi Reklamı' : 'Profil Tanıtımı'}</Text>
                                        <Text style={{ color: subTextColor }}>{new Date(ad.created_at || Date.now()).toLocaleDateString('tr-TR')} tarihinde başladı</Text>
                                    </View>
                                </View>

                                <View style={styles.detailGrid}>
                                    <View style={styles.detailBox}>
                                        <Text style={styles.detailLab}>Bütçe</Text>
                                        <Text style={[styles.detailVal, { color: textColor }]}>₺{totalBudget}</Text>
                                    </View>
                                    <View style={styles.detailBox}>
                                        <Text style={styles.detailLab}>Harcanan (Tahmini)</Text>
                                        <Text style={[styles.detailVal, { color: '#22c55e' }]}>₺{Math.min(totalBudget, views * 0.1).toFixed(0)}</Text>
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 20 }]}>Performans Analizi</Text>
                            <View style={styles.metricsGrid}>
                                <View style={[styles.metricItem, { backgroundColor: cardBg, borderColor }]}>
                                    <Ionicons name="eye-outline" size={20} color="#3b82f6" />
                                    <Text style={[styles.metricVal, { color: textColor }]}>{views}</Text>
                                    <Text style={styles.metricLab}>Gösterim</Text>
                                </View>
                                <View style={[styles.metricItem, { backgroundColor: cardBg, borderColor }]}>
                                    <Ionicons name="heart-outline" size={20} color="#ec4899" />
                                    <Text style={[styles.metricVal, { color: textColor }]}>{interactions}</Text>
                                    <Text style={styles.metricLab}>Etkileşim</Text>
                                </View>
                                <View style={[styles.metricItem, { backgroundColor: cardBg, borderColor }]}>
                                    <Ionicons name="flash-outline" size={20} color="#eab308" />
                                    <Text style={[styles.metricVal, { color: textColor }]}>%{ctr}</Text>
                                    <Text style={styles.metricLab}>CTR</Text>
                                </View>
                                <View style={[styles.metricItem, { backgroundColor: cardBg, borderColor }]}>
                                    <Ionicons name="cash-outline" size={20} color="#22c55e" />
                                    <Text style={[styles.metricVal, { color: textColor }]}>₺{cpv}</Text>
                                    <Text style={styles.metricLab}>CPV</Text>
                                </View>
                            </View>

                            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor, marginTop: 20 }]}>
                                <Text style={[styles.cardTitle, { color: textColor, fontSize: 14, marginBottom: 10 }]}>Bütçe Verimliliği</Text>
                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: primaryColor }]} />
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                                    <Text style={{ color: subTextColor, fontSize: 11 }}>Düşük Verim</Text>
                                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: 'bold' }}>%{progress.toFixed(1)} Tamamlandı</Text>
                                    <Text style={{ color: subTextColor, fontSize: 11 }}>Yüksek Verim</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.closeModalBtn, { backgroundColor: primaryColor }]}
                                onPress={() => setSelectedAdForDetail(null)}
                            >
                                <Text style={styles.closeModalBtnText}>Anladım</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <View style={[styles.header, { backgroundColor: bgColor, borderBottomColor: borderColor }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={primaryColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Reklam ve Tanıtım</Text>
                <View style={{ width: 34 }} />
            </View>

            {renderAnalyticsModal()}

            {!postId && (
                <View style={{ flexDirection: 'row', padding: 15, gap: 10 }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('active')}
                        style={[styles.tabBtn, { backgroundColor: activeTab === 'active' ? primaryColor : cardBg, borderColor }]}
                    >
                        <Text style={[styles.tabBtnText, { color: activeTab === 'active' ? '#fff' : textColor }]}>Reklamlarım</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('new')}
                        style={[styles.tabBtn, { backgroundColor: activeTab === 'new' ? primaryColor : cardBg, borderColor }]}
                    >
                        <Text style={[styles.tabBtnText, { color: activeTab === 'new' ? '#fff' : textColor }]}>Yeni Reklam</Text>
                    </TouchableOpacity>
                </View>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {activeTab === 'active' ? (
                        <View>
                            <Text style={[styles.sectionTitle, { color: textColor }]}>Aktif Reklam Performansı</Text>
                            {activeAds.length === 0 && !activeProfileAd ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Ionicons name="megaphone-outline" size={60} color={subTextColor} style={{ opacity: 0.5 }} />
                                    <Text style={{ color: subTextColor, textAlign: 'center', marginTop: 15 }}>Aktif bir reklamınız bulunmuyor.</Text>
                                    <TouchableOpacity onPress={() => setActiveTab('new')} style={{ marginTop: 20, padding: 12, backgroundColor: primaryColor, borderRadius: 10 }}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>İlk Reklamını Oluştur</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    {activeProfileAd && (
                                        <TouchableOpacity 
                                            activeOpacity={0.8}
                                            onPress={() => setSelectedAdForDetail(activeProfileAd)}
                                            style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={[styles.iconBg, { backgroundColor: primaryColor + '20' }]}>
                                                        <Ionicons name="person" size={20} color={primaryColor} />
                                                    </View>
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={[styles.cardTitle, { color: textColor }]}>Profil Tanıtımı</Text>
                                                        <Text style={{ color: subTextColor, fontSize: 12 }}>Bütçe: {activeProfileAd.sponsor_budget} ₺</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.activeBadge}><View style={styles.activeDot} /><Text style={styles.activeText}>Aktif</Text></View>
                                            </View>
                                            <View style={styles.statsRow}>
                                                <View style={styles.statBox}><Text style={[styles.statVal, { color: textColor }]}>{activeProfileAd.sponsor_views || 0}</Text><Text style={styles.statLab}>Gösterim</Text></View>
                                                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: borderColor }]}><Text style={[styles.statVal, { color: textColor }]}>%{(((activeProfileAd.sponsor_views || 0) / activeProfileAd.sponsor_budget) * 2).toFixed(1)}</Text><Text style={styles.statLab}>İlerleme</Text></View>
                                            </View>
                                            <View style={{ marginTop: 10, alignItems: 'center' }}>
                                                <Text style={{ color: primaryColor, fontSize: 11, fontWeight: 'bold' }}>Detayları Gör →</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                    {activeAds.map(ad => (
                                        <TouchableOpacity 
                                            key={ad.id} 
                                            activeOpacity={0.8}
                                            onPress={() => setSelectedAdForDetail(ad)}
                                            style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Image source={{ uri: ad.image_url?.split(',')[0] }} style={styles.miniPostImg} />
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={[styles.cardTitle, { color: textColor }]}>Gönderi Reklamı</Text>
                                                        <Text style={{ color: subTextColor, fontSize: 12 }}>Bütçe: {ad.sponsor_budget} ₺</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.activeBadge}><View style={styles.activeDot} /><Text style={styles.activeText}>Aktif</Text></View>
                                            </View>
                                            <View style={styles.statsRow}>
                                                <View style={styles.statBox}><Text style={[styles.statVal, { color: textColor }]}>{ad.sponsor_views || 0}</Text><Text style={styles.statLab}>Gösterim</Text></View>
                                                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: borderColor }]}><Text style={[styles.statVal, { color: textColor }]}>{ad.likes || 0}</Text><Text style={styles.statLab}>Etkileşim</Text></View>
                                                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: borderColor }]}><Text style={[styles.statVal, { color: textColor }]}>%{ad.sponsor_views > 0 ? ((ad.likes / ad.sponsor_views) * 100).toFixed(1) : '0.0'}</Text><Text style={styles.statLab}>CTR</Text></View>
                                            </View>
                                            <View style={{ marginTop: 10, alignItems: 'center' }}>
                                                <Text style={{ color: primaryColor, fontSize: 11, fontWeight: 'bold' }}>Detayları Gör →</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </View>
                    ) : (
                        <View>
                            <Text style={[styles.sectionTitle, { color: textColor }]}>1. Tanıtım Türü Seçin</Text>
                            <View style={styles.optionsRow}>
                                <TouchableOpacity style={[styles.optionCard, { backgroundColor: cardBg, borderColor: promoType === 'profile' ? primaryColor : borderColor }]} onPress={() => setPromoType('profile')}>
                                    <Ionicons name="person-circle-outline" size={32} color={promoType === 'profile' ? primaryColor : subTextColor} />
                                    <Text style={[styles.optionText, { color: textColor }]}>Profilimi Öne Çıkar</Text>
                                    {promoType === 'profile' && <View style={[styles.selectedCheck, { backgroundColor: primaryColor }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.optionCard, { backgroundColor: cardBg, borderColor: promoType === 'post' ? primaryColor : borderColor }]} onPress={() => setPromoType('post')}>
                                    <Ionicons name="image-outline" size={32} color={promoType === 'post' ? primaryColor : subTextColor} />
                                    <Text style={[styles.optionText, { color: textColor }]}>Gönderimi Öne Çıkar</Text>
                                    {promoType === 'post' && <View style={[styles.selectedCheck, { backgroundColor: primaryColor }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                                </TouchableOpacity>
                            </View>
                            {promoType === 'post' && (
                                <View style={{ marginTop: 25 }}>
                                    <Text style={[styles.sectionTitle, { color: textColor }]}>2. Gönderi Seçin</Text>
                                    {postsLoading ? <ActivityIndicator color={primaryColor} /> : (
                                        <FlatList horizontal showsHorizontalScrollIndicator={false} data={userPosts} keyExtractor={item => item.id} renderItem={({ item }) => (
                                            <TouchableOpacity style={[styles.postSelectorItem, { borderColor: selectedPostId === item.id ? primaryColor : 'transparent' }]} onPress={() => setSelectedPostId(item.id)}>
                                                <Image source={{ uri: item.image_url?.split(',')[0] }} style={styles.postSelectorImage} />
                                                {selectedPostId === item.id && <View style={[styles.selectedCheck, { backgroundColor: primaryColor }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                                            </TouchableOpacity>
                                        )} />
                                    )}
                                </View>
                            )}
                            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 25 }]}>{promoType === 'profile' ? '2. Hedef Kitle' : '3. Hedef Kitle'}</Text>
                            <View style={styles.keywordInputContainer}>
                                <TextInput style={[styles.keywordInput, { backgroundColor: cardBg, borderColor, color: textColor }]} placeholder="Anahtar kelime..." placeholderTextColor={subTextColor} value={keywordInput} onChangeText={setKeywordInput} onSubmitEditing={handleAddKeyword} />
                                <TouchableOpacity style={[styles.addBtn, { backgroundColor: primaryColor }]} onPress={handleAddKeyword}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
                            </View>
                            <View style={styles.keywordsWrap}>
                                {keywords.map(kw => (
                                    <View key={kw} style={[styles.keywordChip, { backgroundColor: primaryColor + '15', borderColor: primaryColor }]}>
                                        <Text style={[styles.keywordText, { color: primaryColor }]}>{kw}</Text>
                                        <TouchableOpacity onPress={() => removeKeyword(kw)} style={{ marginLeft: 5 }}><Ionicons name="close-circle" size={16} color={primaryColor} /></TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                            <Text style={[styles.sectionTitle, { color: textColor, marginTop: 25 }]}>{promoType === 'profile' ? '3. Bütçe ve Süre' : '4. Bütçe ve Süre'}</Text>
                            <Text style={[styles.sliderLabel, { color: textColor }]}>Günlük Bütçe: <Text style={{ fontWeight: 'bold' }}>{budget} ₺</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                                {BUDGET_OPTIONS.map(val => (
                                    <TouchableOpacity key={val} style={[styles.selectorBtn, { backgroundColor: budget === val ? primaryColor : cardBg, borderColor }]} onPress={() => setBudget(val)}><Text style={{ color: budget === val ? '#fff' : textColor, fontWeight: 'bold' }}>{val} ₺</Text></TouchableOpacity>
                                ))}
                            </ScrollView>
                            <Text style={[styles.sliderLabel, { color: textColor, marginTop: 15 }]}>Süre: <Text style={{ fontWeight: 'bold' }}>{duration} Gün</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                                {DURATION_OPTIONS.map(val => (
                                    <TouchableOpacity key={val} style={[styles.selectorBtn, { backgroundColor: duration === val ? primaryColor : cardBg, borderColor }]} onPress={() => setDuration(val)}><Text style={{ color: duration === val ? '#fff' : textColor, fontWeight: 'bold' }}>{val} Gün</Text></TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={[styles.summaryCard, { backgroundColor: primaryColor + '10', borderColor: primaryColor }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}><Ionicons name="stats-chart" size={24} color={primaryColor} /><Text style={[styles.summaryTitle, { color: primaryColor, marginLeft: 10 }]}>Tahmini Erişim</Text></View>
                                <Text style={[styles.reachText, { color: textColor }]}>{minReach.toLocaleString('tr-TR')} - {maxReach.toLocaleString('tr-TR')} Kişi</Text>
                                <View style={styles.summaryDivider} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: subTextColor, fontSize: 16 }}>Toplam Tutar:</Text><Text style={{ color: textColor, fontSize: 24, fontWeight: 'bold' }}>{budget * duration} ₺</Text></View>
                            </View>
                            <TouchableOpacity style={[styles.promoteBtn, { backgroundColor: primaryColor }, loading && { opacity: 0.7 }]} onPress={handlePromote} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.promoteBtnText}>Öne Çıkar</Text>}</TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    backBtn: { padding: 5 },
    content: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    sectionSubtitle: { fontSize: 13, marginBottom: 15, lineHeight: 18 },
    
    optionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    optionCard: { flex: 0.48, padding: 15, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minHeight: 100 },
    optionText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 10 },
    postSelectorItem: { width: 80, height: 80, borderRadius: 10, borderWidth: 2, marginRight: 12, overflow: 'hidden', position: 'relative' },
    postSelectorImage: { width: '100%', height: '100%' },
    selectedCheck: { position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 10 },

    keywordInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    keywordInput: { flex: 1, height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 15 },
    addBtn: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
    keywordsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    keywordChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    keywordText: { fontSize: 13, fontWeight: '600' },

    sliderLabel: { fontSize: 15, marginBottom: 10 },
    horizontalScroll: { flexDirection: 'row', marginBottom: 10 },
    selectorBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginRight: 10, minWidth: 70, alignItems: 'center' },

    summaryCard: { marginTop: 25, padding: 20, borderRadius: 15, borderWidth: 1 },
    summaryTitle: { fontSize: 16, fontWeight: 'bold' },
    reachText: { fontSize: 26, fontWeight: '800', marginVertical: 5 },
    summaryDivider: { height: 1, backgroundColor: 'rgba(150,150,150,0.3)', marginVertical: 15 },

    promoteBtn: { marginTop: 30, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
    promoteBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    
    // New Styles
    tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    tabBtnText: { fontWeight: 'bold', fontSize: 14 },
    statCard: { padding: 20, borderRadius: 15, borderWidth: 1, marginBottom: 15 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    iconBg: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 6 },
    activeText: { color: '#22c55e', fontSize: 12, fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.1)' },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 20, fontWeight: 'bold' },
    statLab: { fontSize: 11, color: '#888', marginTop: 4 },
    miniPostImg: { width: 50, height: 50, borderRadius: 8 },

    // Detail Modal Styles
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 25, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    detailCard: { padding: 20, borderRadius: 18, borderWidth: 1, marginBottom: 15 },
    detailImg: { width: 60, height: 60, borderRadius: 12 },
    detailGrid: { flexDirection: 'row', marginTop: 15, gap: 15 },
    detailBox: { flex: 1 },
    detailLab: { fontSize: 12, color: '#888', marginBottom: 4 },
    detailVal: { fontSize: 18, fontWeight: 'bold' },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    metricItem: { width: '48%', padding: 15, borderRadius: 15, borderWidth: 1, alignItems: 'center' },
    metricVal: { fontSize: 18, fontWeight: 'bold', marginTop: 8 },
    metricLab: { fontSize: 11, color: '#888', marginTop: 2 },
    progressBarBg: { width: '100%', height: 10, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 5, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 5 },
    closeModalBtn: { marginTop: 30, padding: 18, borderRadius: 15, alignItems: 'center' },
    closeModalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
