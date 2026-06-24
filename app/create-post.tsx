import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseConfig';
import { DynamicImage } from '../components/DynamicImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CreatePostScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();

    const imageUriParam = params.imageUri as string;
    const imageUrisParam = params.imageUris as string;
    
    // Support both single and multiple image parameters
    const imageUris = imageUrisParam ? imageUrisParam.split(',') : (imageUriParam ? [imageUriParam] : []);

    const [caption, setCaption] = useState(params.initialFoodName ? `${params.initialFoodName} yiyorum!` : '');
    const [tags, setTags] = useState('');
    const [loading, setLoading] = useState(false);

    // Recipe State
    const [isRecipe, setIsRecipe] = useState(!!params.initialFoodName);
    const [recipeTitle, setRecipeTitle] = useState(params.initialFoodName as string || '');
    const [calories, setCalories] = useState(params.initialCalories as string || '');
    const [ingredients, setIngredients] = useState('');

    const handleShare = async () => {
        if (imageUris.length === 0 || !user) return;
        setLoading(true);

        try {
            const uploadedUrls: string[] = [];

            // 1. Storage'a Bütün Fotoğrafları Yükle
            for (let i = 0; i < imageUris.length; i++) {
                const uri = imageUris[i];
                const formData = new FormData();
                formData.append('file', {
                    uri: uri,
                    name: `post_${Date.now()}_${i}.jpg`,
                    type: 'image/jpeg',
                } as any);

                const fileName = `${user.id}/${Date.now()}_${i}.jpg`;

                const { data: storageData, error: storageError } = await supabase.storage
                    .from('posts')
                    .upload(fileName, formData, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (storageError) throw storageError;

                const { data: publicUrlData } = supabase.storage.from('posts').getPublicUrl(fileName);
                uploadedUrls.push(publicUrlData.publicUrl);
            }

            // 3. Veritabanına Yaz (Virgülle ayırarak string olarak kaydet)
            const payload: any = {
                user_id: user.id,
                image_url: uploadedUrls.join(','),
                description: caption,
                likes: 0,
                is_recipe: isRecipe,
                tags: tags.trim() || null
            };

            if (isRecipe) {
                if (!recipeTitle) {
                    Alert.alert("Hata", "Lütfen tarif başlığını giriniz.");
                    setLoading(false);
                    return;
                }
                payload.title = recipeTitle;
                payload.calories = parseInt(calories) || 0;
                payload.ingredients = ingredients;
            }

            const { error: dbError } = await supabase.from('posts').insert([payload]);

            if (dbError) throw dbError;

            Alert.alert("Başarılı", "Gönderiniz paylaşıldı!", [
                { text: "Tamam", onPress: () => router.replace('/(tabs)/home' as any) }
            ]);

        } catch (error: any) {
            console.error("Paylaşım Hatası:", error);
            Alert.alert("Hata", "Paylaşım yapılamadı: " + (error.message || error));
        } finally {
            setLoading(false);
        }
    };

    if (imageUris.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={{ color: '#fff' }}>Fotoğraf bulunamadı.</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.inner}
                >
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={28} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Yeni Gönderi</Text>
                        <TouchableOpacity onPress={handleShare} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="#007AFF" />
                            ) : (
                                <Text style={styles.shareText}>Paylaş</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        <View style={styles.userInfo}>
                            <Text style={styles.usernameText}>{user?.username ? user.username.replace(/^@/, '') : 'Kullanıcı'}</Text>
                        </View>

                        <View style={styles.content}>
                            <View style={{ borderRadius: 10, overflow: 'hidden' }}>
                                <ScrollView 
                                    horizontal 
                                    pagingEnabled 
                                    showsHorizontalScrollIndicator={false}
                                >
                                    {imageUris.map((uri, index) => (
                                        <View key={index} style={{ width: SCREEN_WIDTH - 30 }}>
                                            <DynamicImage 
                                                uri={uri} 
                                                style={styles.previewImage} 
                                            />
                                            {imageUris.length > 1 && (
                                                <View style={styles.imageCounter}>
                                                    <Text style={styles.imageCounterText}>{index + 1}/{imageUris.length}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Bir açıklama yaz..."
                                placeholderTextColor="#666"
                                multiline
                                value={caption}
                                onChangeText={setCaption}
                            />
                            
                            {/* TAGS INPUT */}
                            <TextInput
                                style={[styles.input, { minHeight: 50, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#333' }]}
                                placeholder="Etiketler (virgülle ayırarak girin: sağlıklı, vegan)"
                                placeholderTextColor="#666"
                                value={tags}
                                onChangeText={setTags}
                            />
                        </View>

                        {/* RECIPE TOGGLE */}
                        <View style={styles.recipeToggleContainer}>
                            <Text style={styles.recipeLabel}>Bu bir tarif mi?</Text>
                            <Switch
                                trackColor={{ false: "#767577", true: "#800020" }}
                                thumbColor={isRecipe ? "#fff" : "#f4f3f4"}
                                onValueChange={setIsRecipe}
                                value={isRecipe}
                            />
                        </View>

                        {/* RECIPE FIELDS */}
                        {isRecipe && (
                            <View style={styles.recipeFields}>
                                <TextInput
                                    style={styles.recipeInput}
                                    placeholder="Tarif Başlığı (Örn: Mercimek Çorbası)"
                                    placeholderTextColor="#666"
                                    value={recipeTitle}
                                    onChangeText={setRecipeTitle}
                                />
                                <TextInput
                                    style={styles.recipeInput}
                                    placeholder="Kalori (kcal)"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={calories}
                                    onChangeText={setCalories}
                                />
                                <TextInput
                                    style={[styles.recipeInput, { minHeight: 100 }]}
                                    placeholder="Malzemeler ve Hazırlanışı..."
                                    placeholderTextColor="#666"
                                    multiline
                                    value={ingredients}
                                    onChangeText={setIngredients}
                                />
                            </View>
                        )}
                        <View style={{ height: 50 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    inner: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333'
    },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    shareText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
    userInfo: { paddingHorizontal: 15, paddingTop: 10 },
    usernameText: { color: '#aaa', fontSize: 14, fontStyle: 'italic' },
    content: { padding: 15 },
    previewImage: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#111' },
    input: {
        width: '100%',
        color: '#fff',
        fontSize: 16,
        paddingTop: 15,
        textAlignVertical: 'top',
        minHeight: 80
    },
    recipeToggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderTopWidth: 0.5,
        borderTopColor: '#333',
        marginTop: 10
    },
    recipeLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    recipeFields: {
        padding: 15
    },
    recipeInput: {
        backgroundColor: '#1e1e1e',
        color: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16
    },
    imageCounter: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    imageCounterText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    }
});
