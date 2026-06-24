import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { StoryProvider } from '../context/StoryContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { notificationService } from '../services/notificationService';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseConfig';

// 1. İÇERİK BİLEŞENİ
function RootLayoutContent() {
  const { theme } = useTheme(); // Use custom hook
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1. Bildirim İzinleri ve Token Kaydı
    const setupNotifications = async () => {
      const hasPermission = await notificationService.requestPermissions();
      if (hasPermission && user?.id) {
        notificationService.setupBackgroundHandler();
        await notificationService.scheduleDailyReportNotification(user.id);
        await notificationService.scheduleEngagementReminders();
        await notificationService.getPushToken(user.id);
      }
    };

    setupNotifications();

    // 2. Bildirime Tıklama Olayı
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.url) {
        if (data.params) {
          router.push({ 
            pathname: data.url as any, 
            params: data.params as any 
          } as any);
        } else {
          router.push(data.url as any);
        }
      }
    });

    // 3. Real-time Dinleyiciler
    let notifChannel: any = null;
    let msgChannel: any = null;

    if (user?.id) {
      // Genel Bildirimler (Beğeni, Yorum, Takip)
      notifChannel = supabase
        .channel(`user-notifs-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          async (payload: any) => {
            const { data: actor } = await supabase.from('profiles').select('username').eq('id', payload.new.actor_id).single();
            
            let title = "Yeni Bildirim";
            let body = "Uygulamada yeni bir hareket var.";

            if (payload.new.type === 'like') {
              title = "Yeni Beğeni ❤️";
              body = `@${actor?.username || 'Biri'} gönderini beğendi.`;
            } else if (payload.new.type === 'comment') {
              title = "Yeni Yorum 💬";
              body = `@${actor?.username || 'Biri'} gönderine yorum yaptı.`;
            } else if (payload.new.type === 'friend_request') {
              title = "Takip İsteği 👋";
              body = `@${actor?.username || 'Biri'} seni takip etmek istiyor.`;
            }

            await Notifications.scheduleNotificationAsync({
              content: { title, body, data: { url: '/notifications' } },
              trigger: null,
            });
          }
        )
        .subscribe();

      // Mesaj Bildirimleri
      msgChannel = supabase
        .channel(`user-msgs-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
          async (payload: any) => {
            const { data: sender } = await supabase.from('profiles').select('username').eq('id', payload.new.sender_id).single();
            
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `Yeni Mesaj: @${sender?.username || 'Kullanıcı'} 📩`,
                body: payload.new.content.substring(0, 50) + (payload.new.content.length > 50 ? '...' : ''),
                data: { 
                  url: '/chat', 
                  params: { userId: payload.new.sender_id, username: sender?.username } 
                },
              },
              trigger: null,
            });
          }
        )
        .subscribe();
    }

    return () => {
      responseSubscription.remove();
      if (notifChannel) supabase.removeChannel(notifChannel);
      if (msgChannel) supabase.removeChannel(msgChannel);
    };
  }, [user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#800020" />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="friends" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="camera" options={{ headerShown: false, animation: 'slide_from_left' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="promote-post" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

// 2. ANA LAYOUT
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <StoryProvider>
            <RootLayoutContent />
          </StoryProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}