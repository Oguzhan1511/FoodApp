import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  async requestPermissions() {
    if (Platform.OS === 'web') return false;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  },

  async getPushToken(userId: string) {
    if (Platform.OS === 'web') return null;
    
    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'e4616acb-05b9-4b9f-988c-38936352ea86'
      })).data;

      if (token && userId) {
        await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', userId);
      }
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  setupBackgroundHandler() {
    // Background handling logic
  },

  async scheduleDailyReportNotification(userId?: string) {
    if (Platform.OS === 'web') return;

    // Mevcut günlük rapor bildirimlerini temizle (her app açılışında güncelle)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'daily_report') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    let title = "Günlük Özet Hazır! 🍎";
    let body = "Bugünkü beslenme hedeflerine ne kadar yaklaştığını kontrol et.";

    try {
      if (userId) {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const { Pedometer } = await import('expo-sensors');

        const today = new Date().toISOString().split('T')[0];

        // 1. Kalori & Makro verisi (AsyncStorage)
        const foodLogKey = `daily_food_log_${userId}_${today}`;
        const storedFood = await AsyncStorage.getItem(foodLogKey);
        let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0;
        
        if (storedFood) {
          const logs = JSON.parse(storedFood);
          logs.forEach((item: any) => {
            totalKcal += parseFloat(item.kcal) || 0;
            totalProtein += parseFloat(item.protein) || 0;
            totalFat += parseFloat(item.fat) || 0;
            totalCarbs += parseFloat(item.carbs) || 0;
          });
        }

        // 2. Su tüketimi (Supabase)
        let waterTotal = 0;
        const { data: waterData } = await supabase
          .from('water_entries')
          .select('amount_ml')
          .eq('user_id', userId)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);
        
        if (waterData) {
          waterTotal = waterData.reduce((sum, e) => sum + (e.amount_ml || 0), 0);
        }

        // 3. Adım sayısı
        let steps = 0;
        try {
          const { granted } = await Pedometer.getPermissionsAsync();
          if (granted) {
            const isAvailable = await Pedometer.isAvailableAsync();
            if (isAvailable) {
              const end = new Date();
              const start = new Date();
              start.setHours(0, 0, 0, 0);
              const result = await Pedometer.getStepCountAsync(start, end);
              if (result) steps = result.steps;
            }
          }
        } catch (e) { /* Pedometer erişilemeyebilir */ }

        // 4. Egzersiz verisi
        const exKey = `daily_exercise_log_${userId}_${today}`;
        const storedEx = await AsyncStorage.getItem(exKey);
        let burnedKcal = 0;
        if (storedEx) {
          const exLogs = JSON.parse(storedEx);
          burnedKcal = exLogs.reduce((sum: number, item: any) => sum + (parseFloat(item.kcalBurned) || 0), 0);
        }

        // 5. Rapor oluştur
        const kcalRounded = Math.round(totalKcal);
        const waterLiters = (waterTotal / 1000).toFixed(1);
        const deficit = Math.round(burnedKcal - totalKcal);

        if (kcalRounded > 0 || waterTotal > 0 || steps > 0) {
          title = "📊 Günlük Raporun Hazır!";
          
          const parts: string[] = [];
          if (kcalRounded > 0) parts.push(`🔥 ${kcalRounded} kcal aldın`);
          if (burnedKcal > 0) parts.push(`💪 ${Math.round(burnedKcal)} kcal yaktın`);
          if (waterTotal > 0) parts.push(`💧 ${waterLiters}L su içtin`);
          if (steps > 0) parts.push(`🚶 ${steps.toLocaleString('tr-TR')} adım attın`);
          
          body = parts.join(' • ');

          // Motivasyonel yorum ekle
          if (waterTotal >= 2000) body += '\n✅ Su hedefini aştın, harika!';
          else if (waterTotal < 1000) body += '\n⚠️ Daha fazla su iç!';
          
          if (steps >= 10000) body += '\n🏆 10.000 adım hedefini geçtin!';
        } else {
          title = "📋 Bugün Kayıt Yok";
          body = "Bugün hiç besin veya su kaydı yapmadın. Yarın hedeflerine ulaşmak için takibi unutma! 💪";
        }
      }
    } catch (e) {
      // Veri çekilemezse varsayılan mesajla devam et
    }

    // Saat 21:00'de bildirim gönder
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: 'daily_report', url: '/(tabs)/tracking' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 21,
        minute: 0,
        repeats: false, // Her app açılışında yeniden kurulacağı için tekrar yok
      } as any,
    });
  },

  async scheduleEngagementReminders() {
    if (Platform.OS === 'web') return;

    // Önce mevcut engagement bildirimlerini temizle (çift bildirim önleme)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === 'engagement') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    // Sabah hatırlatıcıları (08:30)
    const morningMessages = [
      { title: "Günaydın! ☀️", body: "Güne sağlıklı bir kahvaltıyla başla! Kahvaltı fikirlerine göz at." },
      { title: "Günaydın! 🌅", body: "Bugün su içmeyi unutma! Hedefini takip et 💧" },
      { title: "Günaydın! 🍳", body: "Sabah enerjini artıracak tarifler seni bekliyor!" },
      { title: "Harika bir gün! 🌞", body: "Dün ne yediğini hatırlıyor musun? Bugünü planla!" },
    ];

    // Öğle hatırlatıcıları (12:30)
    const lunchMessages = [
      { title: "Öğle Vakti! 🍽️", body: "Bugün ne yesem diye düşünme, uygulamada binlerce tarif var!" },
      { title: "Aç mısın? 😋", body: "Arkadaşlarının ne yediğine göz at, ilham al!" },
      { title: "Öğle Molası! 🥗", body: "Sağlıklı öğle yemeği fikirleri keşfet." },
    ];

    // İkindi hatırlatıcıları (16:00)
    const afternoonMessages = [
      { title: "Atıştırmalık Zamanı! 🥜", body: "Sağlıklı atıştırmalık fikirleri için göz at." },
      { title: "Su İçtin mi? 💧", body: "Günlük su hedefine ne kadar yaklaştığını kontrol et!" },
      { title: "Hareket Zamanı! 🚶", body: "Bugün kaç adım attığını kontrol et!" },
    ];

    // Akşam hatırlatıcıları (19:00)
    const eveningMessages = [
      { title: "Akşam Yemeği! 🍲", body: "Bu akşam ne pişirsem? Popüler tariflere göz at!" },
      { title: "Keşfet! 📍", body: "Yakınındaki mekanları chatbot'a sorarak keşfet!" },
      { title: "Yemek Zamanı! 🍕", body: "Arkadaşlarının paylaştığı yemeklere bak!" },
    ];

    // Gece özeti (21:30)
    const nightMessages = [
      { title: "Gün Bitti! 📊", body: "Bugünkü kalori takibini tamamla, ilerlemeni gör!" },
      { title: "İyi Geceler! 🌙", body: "Yarına hazırlıklı ol — su ve besin hedeflerini planla." },
      { title: "Günlük Özet! ✅", body: "Bugün kaç kalori aldığını ve ne kadar su içtiğini kontrol et." },
    ];

    const scheduleSlot = async (hour: number, minute: number, messages: {title: string, body: string}[]) => {
      // Günün numarasına göre farklı mesaj göster (her gün farklı)
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const msg = messages[dayOfYear % messages.length];

      await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          sound: true,
          data: { type: 'engagement', url: '/(tabs)/home' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour,
          minute,
          repeats: true,
        } as any,
      });
    };

    // 5 farklı zaman diliminde bildirim kur
    await scheduleSlot(8, 30, morningMessages);
    await scheduleSlot(12, 30, lunchMessages);
    await scheduleSlot(16, 0, afternoonMessages);
    await scheduleSlot(19, 0, eveningMessages);
    await scheduleSlot(21, 30, nightMessages);
  },

  async schedulePlanEndNotification(daysFromNow: number = 7) {
    if (Platform.OS === 'web') return;
    
    // Mevcut plan bildirimlerini temizle (çakışma olmaması için)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.title === "Diyet Programın Tamamlandı! 🎉") {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    const trigger = new Date();
    trigger.setDate(trigger.getDate() + daysFromNow);
    trigger.setHours(9, 0, 0, 0);

    // Eğer hesaplanan tarih geçmişte kalıyorsa (örn: bugün saat 10:00 ve daysFromNow 0 ise)
    // Bildirimi en az 1 dakika sonraya kurarak çökmesini engelleyelim
    if (trigger <= new Date()) {
      trigger.setTime(new Date().getTime() + 60000); 
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Diyet Programın Tamamlandı! 🎉",
        body: "7 günlük diyet programın bugün sona erdi. İlerlemeni kontrol et ve yeni hedefler belirle!",
        sound: true,
      },
      trigger: trigger as any,
    });
  }
};

// For backward compatibility or direct usage
export async function registerForPushNotificationsAsync(userId: string) {
  const hasPermission = await notificationService.requestPermissions();
  if (hasPermission) {
    return await notificationService.getPushToken(userId);
  }
  return null;
}
