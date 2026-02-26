import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { useAuth } from './AuthContext';
import { supabase } from './services/supabaseConfig';

export default function CreatePostScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();

    const imageUri = params.imageUri as string;
    const [caption, setCaption] = useState(params.initialFoodName ? `${params.initialFoodName} yiyorum!` : '');
    const [loading, setLoading] = useState(false);

    // Recipe State
    const [isRecipe, setIsRecipe] = useState(!!params.initialFoodName);
    const [recipeTitle, setRecipeTitle] = useState(params.initialFoodName as string || '');
    const [calories, setCalories] = useState(params.initialCalories as string || '');
    const [ingredients, setIngredients] = useState('');

    const handleShare = async () => {
        if (!imageUri || !user) return;
        setLoading(true);

        try {
            // 1. Storage'a Yükle (Profil fotoğrafı yükleme mantığı ile aynı)
            const formData = new FormData();
            formData.append('file', {
                uri: imageUri,
                name: `post_${Date.now()}.jpg`,
                type: 'image/jpeg',
            } as any);

            // Dosya yolu: user_id/timestamp.jpg
            const fileName = `${user.id}/${Date.now()}.jpg`;

            const { data: storageData, error: storageError } = await supabase.storage
                .from('posts')
                .upload(fileName, formData, {
                    contentType: 'image/jpeg',
                    upsert: false // Postlar eşsiz olsun
                });

            if (storageError) throw storageError;

            // 2. Public URL Al
            const { data: publicUrlData } = supabase.storage.from('posts').getPublicUrl(fileName);

            // 3. Veritabanına Yaz
            const payload: any = {
                user_id: user.id,
                image_url: publicUrlData.publicUrl,
                description: caption,
                likes: 0,
                is_recipe: isRecipe
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
                { text: "Tamam", onPress: () => router.replace('/(tabs)/home') }
            ]);

        } catch (error: any) {
            console.error("Paylaşım Hatası:", error);
            Alert.alert("Hata", "Paylaşım yapılamadı: " + (error.message || error));
        } finally {
            setLoading(false);
        }
    };

    if (!imageUri) {
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
                            <Text style={styles.usernameText}>@{user?.username || 'Kullanıcı'}</Text>
                        </View>

                        <View style={styles.content}>
                            <Image source={{ uri: imageUri }} style={styles.previewImage} />
                            <TextInput
                                style={styles.input}
                                placeholder="Bir açıklama yaz..."
                                placeholderTextColor="#666"
                                multiline
                                value={caption}
                                onChangeText={setCaption}
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
    previewImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: 10, backgroundColor: '#111' },
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
    }
});
