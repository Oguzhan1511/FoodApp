import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
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
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseConfig';

const THEME_COLOR = '#800020';

export default function EditProfileScreen() {
    const router = useRouter();
    const { intent } = useLocalSearchParams<{ intent?: string }>();
    const { user, updateUser } = useAuth();

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
        menuUrl: [] as string[], // Artık bir dizi
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
                    menuUrl: [] as string[],
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
                    let menuUrlArray: string[] = [];
                    
                    if (profile.account_type === 'business') {
                        const { data: bData } = await supabase.from('business_profiles').select('*').eq('id', user?.id).maybeSingle();
                        if (bData) {
                            address = bData.address || '';
                            phoneNumber = bData.phone_number || '';
                            const rawMenu = bData.menu_url;
                            if (rawMenu) {
                                try {
                                    menuUrlArray = (typeof rawMenu === 'string' && rawMenu.startsWith('[')) 
                                        ? JSON.parse(rawMenu) 
                                        : [rawMenu];
                                } catch (e) {
                                    menuUrlArray = [rawMenu];
                                }
                            }
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
                        menuUrl: menuUrlArray,
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
 
    const pickMenuImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, 
            allowsMultipleSelection: true, // Çoklu seçim aktif
            quality: 0.8,
        });
 
        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            const currentMenus = Array.isArray(formData.menuUrl) ? formData.menuUrl : [];
            setFormData({ ...formData, menuUrl: [...currentMenus, ...newUris] });
        }
    };

    const uploadImage = async (uri: string) => {
        try {
            console.log("Reading avatar file as base64...");
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const arrayBuffer = decode(base64);

            const fileExt = uri.split('.').pop() || 'jpg';
            const fileName = `avatar_${user?.id}_${Date.now()}.${fileExt}`;

            console.log("Uploading avatar to 'avatars' bucket...");
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            console.log("Avatar upload successful. Public URL:", data.publicUrl);
            return data.publicUrl;
        } catch (error) {
            console.error("Avatar upload failed:", error);
            throw error;
        }
    };

    const uploadMenu = async (uris: string[]) => {
        try {
            const uploadedUrls: string[] = [];

            for (const uri of uris) {
                // Eğer zaten bir web linki ise direkt ekle
                if (!uri.startsWith('file://')) {
                    uploadedUrls.push(uri);
                    continue;
                }

                console.log("Reading menu file as base64...");
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                const arrayBuffer = decode(base64);

                const fileExt = uri.split('.').pop() || 'jpg';
                const fileName = `menu_${user?.id}_${Date.now()}_${uploadedUrls.length}.${fileExt}`;

                console.log(`Uploading menu ${uploadedUrls.length + 1} to 'avatars' bucket...`);
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, arrayBuffer, {
                        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                uploadedUrls.push(data.publicUrl);
            }

            console.log("All menus uploaded. URLs:", uploadedUrls);
            return uploadedUrls;
        } catch (error) {
            console.error("Menu upload failed (Base64):", error);
            throw error;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            console.log("Starting save process...");
            let publicUrl = formData.avatarUrl;

            // 1. Profil Resmi Yükleme
            if (formData.avatarUrl && formData.avatarUrl.startsWith('file://')) {
                console.log("Uploading local avatar file:", formData.avatarUrl);
                publicUrl = await uploadImage(formData.avatarUrl);
            }

            // 2. Profil Güncelleme (Dietitian veya User)
            if (role === 'dietitian') {
                const updates = {
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    username: formData.username,
                    bio: formData.bio,
                    location: formData.location,
                    profile_picture: publicUrl
                };
                const { error } = await supabase.from('dietitians').update(updates).eq('id', user?.id);
                if (error) throw error;

                // Diyetisyen olsa bile profiles tablosundaki avatar_url'i de güncelle (AuthContext ve Story için)
                await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id);
            } else {
                const updates: any = {
                    ad: formData.firstName,
                    soyad: formData.lastName,
                    username: formData.username,
                    bio: formData.bio,
                    avatar_url: publicUrl
                };

                if (intent === 'become_business' || accountType === 'business') {
                    updates.account_type = 'business';
                }

                const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
                if (error) throw error;
            }

            // 3. AuthContext'i Güncelle (Ana sayfa ve profil sekmeleri için)
            if (updateUser) {
                updateUser({ 
                    avatar_url: publicUrl,
                    ad: formData.firstName,
                    soyad: formData.lastName,
                    username: formData.username
                });
            }
                
            // 4. İşletme Verilerini Güncelleme
            if (intent === 'become_business' || accountType === 'business') {
                const uploadedMenuUrls = await uploadMenu(formData.menuUrl);
                
                const busUpdates = {
                    id: user?.id,
                    address: formData.address,
                    phone_number: formData.phoneNumber,
                    menu_url: JSON.stringify(uploadedMenuUrls)
                };
                const { error: bError } = await supabase.from('business_profiles').upsert(busUpdates);
                if (bError) throw bError;
            }

            Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.', [
                { text: 'Tamam', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error("Save error:", error);
            Alert.alert('Hata', error.message || 'Profil güncellenirken bir hata oluştu.');
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
                                keyboardType="phone-pad"
                            />

                            <Text style={[styles.label, { marginTop: 15 }]}>Menü (Birden fazla seçebilirsiniz)</Text>
                            <TouchableOpacity style={styles.menuUploadButton} onPress={pickMenuImage}>
                                {formData.menuUrl && formData.menuUrl.length > 0 ? (
                                    <View style={styles.menuPreviewContainer}>
                                        <Ionicons name="images" size={24} color={THEME_COLOR} />
                                        <Text style={styles.menuFileName} numberOfLines={1}>
                                            {formData.menuUrl.length} Fotoğraf Seçildi
                                        </Text>
                                        <TouchableOpacity onPress={() => setFormData({ ...formData, menuUrl: [] })}>
                                            <Ionicons name="close-circle" size={20} color="#ff4d4d" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.menuPlaceholder}>
                                        <Ionicons name="cloud-upload-outline" size={24} color="#666" />
                                        <Text style={styles.menuPlaceholderText}>Menü Fotoğrafları Seç</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
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
    },
    menuUploadButton: {
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        borderStyle: 'dashed',
        padding: 15,
        backgroundColor: '#fafafa'
    },
    menuPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10
    },
    menuPlaceholderText: {
        color: '#666',
        fontSize: 14
    },
    menuPreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    menuFileName: {
        flex: 1,
        marginHorizontal: 10,
        color: '#333',
        fontSize: 14
    }
});
