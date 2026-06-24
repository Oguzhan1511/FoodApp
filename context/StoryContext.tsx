import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseConfig';

// Tip Tanımları
interface Story {
    id: string;
    user_id: string;
    image_url: string;
    created_at: string;
    expires_at: string;
    isViewed?: boolean;
}

interface GroupedStory {
    id: string; // User ID
    name: string;
    avatar: string;
    isMe: boolean;
    hasStory: boolean;
    allViewed?: boolean;
    stories: Story[];
}

interface StoryContextType {
    stories: GroupedStory[];
    loading: boolean;
    uploading: boolean;
    fetchStories: () => Promise<void>;
    uploadStory: (imageUri: string) => Promise<void>;
    deleteStory: (storyId: string) => Promise<void>;
    markStoryAsViewed: (storyId: string) => Promise<void>;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [stories, setStories] = useState<GroupedStory[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchStories();
        }
    }, [user]);

    const fetchStories = async () => {
        try {
            if (!user?.id) return;
            setLoading(true);
            const now = new Date().toISOString();

            // 1. Aktif Hikayeleri Çek
            const { data, error } = await supabase
                .from('stories')
                .select('*')
                .gt('expires_at', now)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data) {
                setStories([]);
                return;
            }

            // 1.5. Takip edilen kişileri bul
            const { data: followData } = await supabase
                .from('user_follows')
                .select('following_id')
                .eq('follower_id', user.id);
            
            const friendIds = new Set<string>();
            followData?.forEach((f: any) => friendIds.add(f.following_id));

            const { data: dietData } = await supabase
                .from('dietitian_follows')
                .select('dietitian_id')
                .eq('follower_id', user.id);
            
            dietData?.forEach((d: any) => friendIds.add(d.dietitian_id));
            friendIds.add(user.id);

            // 2. Kullanıcı ID'lerini topla ve sadece takip edilenleri filtrele
            const userIds = [...new Set(data.map(s => s.user_id))].filter(uid => friendIds.has(uid));

            // 3. Profilleri Çek (Aktif hikayesi olanlar + Kendim)
            const allUserIdsForProfiles = [...new Set([...userIds, user.id])];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', allUserIdsForProfiles);

            const profileMap: Record<string, any> = {};
            profiles?.forEach(p => (profileMap[p.id] = p));

            // 4. Kullanıcının izlediği hikayeleri çek (hangi hikayelerin gri çerçeveli olacağını bilmek için)
            const { data: myViews } = await supabase
                .from('story_views')
                .select('story_id')
                .eq('user_id', user.id);
            const viewedStoryIds = new Set(myViews?.map(v => v.story_id) || []);

            // 5. Hikayeleri Kullanıcıya Göre Grupla
            const groupedStories: GroupedStory[] = [];
            const myStories = data.filter(s => s.user_id === user.id);
            const myProfile = profileMap[user.id];

            // Önce Kendi Hikayemiz
            groupedStories.push({
                id: user.id,
                name: 'Hikayen',
                isMe: true,
                hasStory: myStories.length > 0,
                allViewed: true, // Kendi hikayemiz her zaman izlenmiş (gri) gibi veya özel stil
                avatar: myProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || user.ad || 'Ben')}&background=800020&color=fff`,
                stories: myStories,
            });

            // Diğer Kullanıcılar
            userIds.forEach(uid => {
                if (uid === user.id) return;
                const userStories = data.filter(s => s.user_id === uid);
                const profile = profileMap[uid];
                if (userStories.length > 0 && profile) {
                    const storiesWithViews = userStories.map(s => ({
                        ...s,
                        isViewed: viewedStoryIds.has(s.id)
                    }));
                    const allViewed = storiesWithViews.every(s => s.isViewed);
                    groupedStories.push({
                        id: uid,
                        name: profile.username,
                        isMe: false,
                        hasStory: true,
                        allViewed,
                        avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.username}&background=random`,
                        stories: storiesWithViews,
                    });
                }
            });

            // İzlenmemişleri sola, izlenmişleri sağa sırala
            const sortedGroupedStories = [
                groupedStories[0], // Kendi hikayemiz hep en solda
                ...groupedStories.slice(1).sort((a, b) => {
                    if (a.allViewed === b.allViewed) return 0;
                    return a.allViewed ? 1 : -1;
                })
            ];

            setStories(sortedGroupedStories);
        } catch (error) {
            console.error('Story fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const uploadStory = async (imageUri: string) => {
        if (!user || !imageUri) throw new Error("Kullanıcı veya görsel eksik");
        setUploading(true);

        try {
            console.log("Context: Yükleme başlıyor...");

            // Timeout Wrapper
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Yükleme zaman aşımına uğradı (30sn). İnternet bağlantınızı kontrol edin.")), 30000)
            );

            const uploadPromise = (async () => {
                const formData = new FormData();
                formData.append('file', {
                    uri: imageUri,
                    name: `story_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                } as any);

                const fileName = `${user.id}/${Date.now()}.jpg`;

                console.log("Context: Storage upload başlıyor...", new Date().toISOString());

                // 1. Storage Upload
                const { data: uploadData, error: storageError } = await supabase.storage
                    .from('stories')
                    .upload(fileName, formData, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                console.log("Context: Storage upload bitti. Error:", storageError);

                let publicUrl = "";

                if (storageError) {
                    console.log("Context: Stories bucket hatası, posts deneniyor...");
                    // Fallback
                    const { error: fallbackError } = await supabase.storage
                        .from('posts')
                        .upload(`stories/${fileName}`, formData, {
                            contentType: 'image/jpeg',
                            upsert: false
                        });

                    if (fallbackError) throw fallbackError;

                    const { data: fallbackUrl } = supabase.storage.from('posts').getPublicUrl(`stories/${fileName}`);
                    publicUrl = fallbackUrl.publicUrl;
                } else {
                    // Stories URL
                    const { data: publicUrlData } = supabase.storage.from('stories').getPublicUrl(fileName);
                    publicUrl = publicUrlData.publicUrl;
                }

                console.log("Context: URL alındı:", publicUrl);

                // 2. DB Insert
                const { error: dbError } = await supabase.from('stories').insert([{
                    user_id: user.id,
                    image_url: publicUrl,
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 saat
                }]);

                if (dbError) throw dbError;

                // İşlem bitince listeyi yenile
                await fetchStories();
            })();

            await Promise.race([uploadPromise, timeout]);

        } catch (error) {
            console.error("Context Upload Error:", error);
            throw error; // Hatayı bileşene fırlat ki orada yakalayıp alert gösterebilsin
        } finally {
            setUploading(false);
        }
    };

    const deleteStory = async (storyId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('stories')
                .delete()
                .eq('id', storyId)
                .eq('user_id', user.id); // Sadece kendi hikayesini silebilir

            if (error) throw error;
            await fetchStories();
        } catch (error) {
            console.error('Delete story error:', error);
            throw error;
        }
    };

    const markStoryAsViewed = async (storyId: string) => {
        if (!user) return;
        try {
            // Zaten izlemiş mi kontrol et (Aynı kişi defalarca izlemişse her seferinde ekleme)
            const { data: existing, error: checkError } = await supabase
                .from('story_views')
                .select('id')
                .eq('story_id', storyId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!existing) {
                await supabase.from('story_views').insert([{
                    story_id: storyId,
                    user_id: user.id,
                    created_at: new Date().toISOString()
                }]);
                
                // Anında UI güncellemesi için Context state'i lokal olarak güncelle
                setStories(prev => {
                    let changed = false;
                    const next = prev.map(group => {
                        const sIndex = group.stories.findIndex(s => s.id === storyId);
                        if (sIndex !== -1) {
                            const newStories = [...group.stories];
                            if (!newStories[sIndex].isViewed) {
                                newStories[sIndex] = { ...newStories[sIndex], isViewed: true };
                                changed = true;
                            }
                            const allViewed = newStories.every(s => s.isViewed);
                            return { ...group, stories: newStories, allViewed };
                        }
                        return group;
                    });
                    
                    if (changed) {
                        return [
                            next[0],
                            ...next.slice(1).sort((a, b) => {
                                if (a.allViewed === b.allViewed) return 0;
                                return a.allViewed ? 1 : -1;
                            })
                        ];
                    }
                    return prev;
                });
            }
        } catch (error) {
            // View tracking failure is non-critical, just log it
            console.log('Mark viewed error:', error);
        }
    };

    return (
        <StoryContext.Provider value={{ stories, loading, uploading, fetchStories, uploadStory, deleteStory, markStoryAsViewed }}>
            {children}
        </StoryContext.Provider>
    );
};

export const useStory = () => {
    const context = useContext(StoryContext);
    if (context === undefined) {
        throw new Error('useStory must be used within a StoryProvider');
    }
    return context;
};
