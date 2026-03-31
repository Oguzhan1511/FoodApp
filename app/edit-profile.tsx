import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from './services/supabaseConfig';

const THEME_COLOR = '#800020';

export default function EditProfileScreen() {
    const router = useRouter();
    const { intent } = useLocalSearchParams<{ intent?: string }>();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [role, setRole] = useState<'user' | 'dietitian'>('user');

    // Form Fields
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        bio: '',
        location: '',    // Dietitian only
        diplomaNo: '',   // Dietitian only
        avatarUrl: '' as string | null,
        address: '',     // Business only
        phoneNumber: '', // Business only
    });
    const [accountType, setAccountType] = useState('personal');

    useEffect(() => {
        if (user?.id) fetchUserData();
    }, [user?.id]);

    const fetchUserData = async () => {
        setLoading(true);
        try {
            // Try fetching as dietitian first
            const { data: dietitian } = await supabase
                .from('dietitians')
                .select('*')
                .eq('id', user?.id)
                .single();

            if (dietitian) {
                setRole('dietitian');
                setFormData({
                    firstName: dietitian.first_name || '',
                    lastName: dietitian.last_name || '',
                    username: dietitian.username || '',
                    bio: dietitian.bio || '',
                    location: dietitian.location || '',
                    diplomaNo: dietitian.diploma_no || '',
                    avatarUrl: dietitian.profile_picture || null,
                    address: '',
                    phoneNumber: '',
                });
            } else {
                // Fallback to regular profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user?.id)
                    .single();

                if (profile) {
                    setRole('user');
                    // Gelen intent 'become_business' ise hesap türünü anında Business'a geçirmiş gibi formu açıyoruz (DB henüz kaydolmadı)
                    setAccountType(intent === 'become_business' ? 'business' : (profile.account_type || 'personal'));
                    
                    let address = '';
                    let phoneNumber = '';
                    
                    // DB'de gerçekten business ise eski adres verisi var mı bakıyoruz
                    if (profile.account_type === 'business') {
                        const { data: bData } = await supabase.from('business_profiles').select('*').eq('id', user?.id).maybeSingle();
                        if (bData) {
                            address = bData.address || '';
                            phoneNumber = bData.phone_number || '';
                        }
                    }

                    setFormData({
                        firstName: profile.ad || '',
                        lastName: profile.soyad || '',
                        username: profile.username || '',
                        bio: profile.bio || '',
                        location: '',
                        diplomaNo: '',
                        avatarUrl: profile.avatar_url || null,
                        address: address,
                        phoneNumber: phoneNumber,
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            Alert.alert('Hata', 'Kullanıcı bilgileri yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setFormData({ ...formData, avatarUrl: result.assets[0].uri });
        }
    };

    const uploadImage = async (uri: string) => {
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                name: `avatar-${Date.now()}.jpg`,
                type: 'image/jpeg',
            } as any);

            const fileExt = uri.split('.').pop();
            const fileName = `${user?.id || Date.now()}${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, formData, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) {
                console.error("Supabase Storage Upload Error:", uploadError);
                throw uploadError;
            }

            // Public URL logic remains (or we can return just the path if using Signed URL logic mostly)
            // But let's keep returning a public URL for now as fallback
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            console.log("Generated Public URL:", data.publicUrl);
            return data.publicUrl;
        } catch (error) {
            console.error("Upload into 'avatars' bucket failed:", error);
            throw error;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            console.log("Starting save process...");
            let publicUrl = formData.avatarUrl;

            // Upload only if it's a local file (starts with file://)
            if (formData.avatarUrl && formData.avatarUrl.startsWith('file://')) {
                console.log("Uploading local file:", formData.avatarUrl);
                publicUrl = await uploadImage(formData.avatarUrl);
                console.log("Upload complete. New Public URL:", publicUrl);
            }

            if (role === 'dietitian') {
                const updates = {
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    username: formData.username,
                    bio: formData.bio,
                    location: formData.location,
                    profile_picture: publicUrl
                };
                console.log("Updating dietitian profile with:", updates);
                const { error } = await supabase.from('dietitians').update(updates).eq('id', user?.id);
                if (error) throw error;
            } else {
                const updates: any = {
                    ad: formData.firstName,
                    soyad: formData.lastName,
                    username: formData.username,
                    bio: formData.bio,
                    avatar_url: publicUrl
                };

                // Eğer kişi şu an İşletme'ye geçiş yapıyorsa ya da zaten bir İşletmeyse:
                if (intent === 'become_business' || accountType === 'business') {
                    updates.account_type = 'business';
                }

                const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
                if (error) throw error;
                
                if (intent === 'become_business' || accountType === 'business') {
                    // İşletme hesabı ise business tablosunu da güncelle
                    const busUpdates = {
                        id: user?.id,
                        address: formData.address,
                        phone_number: formData.phoneNumber
                    };
                    const { error: bError } = await supabase.from('business_profiles').upsert(busUpdates);
                    if (bError) console.error("Business table upsert hatası", bError);
                }
            }

            Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.', [
                { text: 'Tamam', onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error('Update error:', error);
            Alert.alert('Hata', 'Güncelleme başarısız: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={THEME_COLOR} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {intent === 'become_business' ? 'İşletme Bilgileri' : 'Profili Düzenle'}
                </Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={THEME_COLOR} />
                    ) : (
                        <Text style={styles.saveText}>Kaydet</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
                        <Image
                            source={{ uri: formData.avatarUrl || `https://ui-avatars.com/api/?name=${formData.firstName || 'U'}&background=ccc&color=fff` }}
                            style={styles.avatar}
                        />
                        <View style={styles.editIconBadge}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.changePhotoText}>Fotoğrafı Değiştir</Text>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Ad</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.firstName}
                        onChangeText={(t) => setFormData({ ...formData, firstName: t })}
                    />

                    <Text style={styles.label}>Soyad</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.lastName}
                        onChangeText={(t) => setFormData({ ...formData, lastName: t })}
                    />

                    <Text style={styles.label}>Kullanıcı Adı</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.username}
                        onChangeText={(t) => setFormData({ ...formData, username: t })}
                        autoCapitalize="none"
                    />

                    <Text style={[styles.label, { marginTop: 15 }]}>Biyografi</Text>
                    <TextInput
                        style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                        value={formData.bio}
                        onChangeText={(t) => setFormData({ ...formData, bio: t })}
                        multiline
                        placeholder="Kendinizden bahsedin..."
                    />

                    {role === 'dietitian' && (
                        <>
                            <Text style={styles.label}>Konum (Klinik)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.location}
                                onChangeText={(t) => setFormData({ ...formData, location: t })}
                            />
                        </>
                    )}

                    {accountType === 'business' && (
                        <>
                            <Text style={[styles.label, { marginTop: 15 }]}>İşletme Adresi</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 40 }]}
                                value={formData.address}
                                onChangeText={(t) => setFormData({ ...formData, address: t })}
                                placeholder="Açık Adres"
                                multiline
                            />

                            <Text style={[styles.label, { marginTop: 15 }]}>İletişim Numarası (WhatsApp)</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.phoneNumber}
                                onChangeText={(t) => setFormData({ ...formData, phoneNumber: t })}
                                placeholder="Örn: 0555..."
                                keyboardType="phone-pad"
                            />
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    saveText: { fontSize: 16, fontWeight: 'bold', color: THEME_COLOR },
    scroll: { padding: 20 },
    avatarContainer: { alignItems: 'center', marginBottom: 30 },
    avatarButton: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#eee' },
    editIconBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: THEME_COLOR,
        padding: 6,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#fff'
    },
    changePhotoText: { marginTop: 10, color: THEME_COLOR, fontWeight: '600' },
    formSection: { gap: 15 },
    label: { fontSize: 13, color: '#666', fontWeight: '500', marginLeft: 2 },
    input: {
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingVertical: 10,
        fontSize: 16,
        color: '#333'
    }
});
