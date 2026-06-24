/**
 * Scraper Service - Fetches recipes and calories directly from websites.
 */

const NEFIS_BASE_URL = 'https://www.nefisyemektarifleri.com/?s=';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

import { supabase } from './supabaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const scraperService = {
  /**
   * Nefis Yemek Tarifleri'nden derinlemesine tarif çekimi
   */
  async searchRecipes(query: string) {
    try {
      const searchUrl = `${NEFIS_BASE_URL}${encodeURIComponent(query)}`;
      const searchResponse = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
      const searchHtml = await searchResponse.text();

      const linkRegex = /<a[^>]+class="title"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/;
      const firstMatch = linkRegex.exec(searchHtml);

      if (!firstMatch) return "Aradığınız kriterde tarif bulunamadı. 🍳 Lütfen daha kısa kelimelerle deneyin.";

      const firstRecipeUrl = firstMatch[1];
      const firstRecipeTitle = firstMatch[2].trim();

      const recipeResponse = await fetch(firstRecipeUrl, { headers: { 'User-Agent': USER_AGENT } });
      const recipeHtml = await recipeResponse.text();

      // Malzemeler
      const matRegex = /<(div|section|ul)[^>]+class="(recipe-materials|entry-materials|instructions-steps|materials)"[^>]*>([\s\S]*?)<\/\1>/;
      const materialsMatch = matRegex.exec(recipeHtml);
      let ingredients = "";
      if (materialsMatch) {
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let liMatch;
        while ((liMatch = liRegex.exec(materialsMatch[3])) !== null) {
          const item = liMatch[1].replace(/<[^>]*>/g, '').trim();
          if (item) ingredients += `• ${item}\n`;
        }
      }

      // Hazırlanış
      const instRegex = /<(div|section|ol|div)[^>]+class="(recipe-instructions|instructions-steps|step-content|instructions)"[^>]*>([\s\S]*?)<\/\1>/;
      const instructionsMatch = instRegex.exec(recipeHtml);
      let steps = "";
      if (instructionsMatch) {
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let liMatch;
        let stepCount = 1;
        while ((liMatch = liRegex.exec(instructionsMatch[3])) !== null) {
          const step = liMatch[1].replace(/<[^>]*>/g, '').trim();
          if (step && step.length > 5) {
            steps += `${stepCount}. ${step}\n\n`;
            stepCount++;
          }
        }
      }

      const youtubeMatch = /youtube\.com\/embed\/([^"?\s]+)/.exec(recipeHtml);
      const youtubeLink = youtubeMatch 
        ? `https://www.youtube.com/watch?v=${youtubeMatch[1]}` 
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(firstRecipeTitle + ' tarifi')}`;

      let resp = `🔍 **${firstRecipeTitle}**\n\n`;
      if (ingredients) resp += `📝 **Malzemeler:**\n${ingredients}\n`;
      if (steps) resp += `👩‍🍳 **Hazırlanışı:**\n${steps}`;
      resp += `🎬 **Videolu Anlatım:**\n${youtubeLink}`;
      return resp;
    } catch (e) {
      return "Tarif servisine ulaşılamıyor. ❌";
    }
  },

  /**
   * Puanlama algoritması: Arama kelimeleri hedefin içinde ne kadar geçiyor?
   */
  calculateScore(rawName: string, query: string) {
      const nameLower = rawName.toLowerCase();
      const queryLower = query.toLowerCase();
      let score = 0;

      // Tam eşleşme
      if (nameLower === queryLower) score += 100;
      // Kapsama (örn: "tavuk göğsü" -> "ızgara tavuk göğsü")
      if (nameLower.includes(queryLower)) score += 50;

      // Kelime bazlı eşleşme
      const queryWords = queryLower.split(' ').filter(w => w.length > 2);
      let matchCount = 0;
      queryWords.forEach(word => {
          if (nameLower.includes(word)) {
              score += 20;
              matchCount++;
          }
      });

      // Eğer hiçbiri eşleşmiyorsa ağır ceza
      if (queryWords.length > 0 && matchCount === 0) {
          score -= 100;
      }

      // İsim uzunluğuna göre küçük bir ceza (kısa ve öz olanlar öne çıksın ama ana puanı ezmesin)
      score -= rawName.length * 0.5;

      // Marka cezası (Jenerik aramalarda markaları ele)
      const brands = ['dünyası', 'king', 'donalds', 'popeyes', 'kfc', 'sarayı', 'pizza', 'soslu'];
      const isGenericQuery = brands.every(b => !queryLower.includes(b));
      if (isGenericQuery && brands.some(b => nameLower.includes(b))) {
          score -= 40;
      }

      // Tercih edilen kelimelere bonus
      const preferred = ['haşlanmış', 'ızgara', 'fırın', 'göğsü'];
      preferred.forEach(p => {
          if (nameLower.includes(p) && !queryLower.includes(p)) score += 10;
      });

      // İstenmeyen kelimelere ceza
      const avoid = ['derisi', 'derili', 'kanat', 'kızartma'];
      avoid.forEach(a => {
          if (nameLower.includes(a) && !queryLower.includes(a)) score -= 30;
      });

      return score;
  },

  /**
   * Besin Değeri Arama (Dyt. Şeyda Ertaş & Diyetkolik)
   */
  async searchCalories(query: string, isFullReport: boolean) {
    try {
      // 1. Önce Dyt. Şeyda Ertaş API üzerinden dene
      const dyApiUrl = `https://www.dytseydaertas.com/api/nutrition/global-search?q=${encodeURIComponent(query)}`;
      const dyRes = await fetch(dyApiUrl, { 
        headers: { 
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        } 
      });
      
      const dyDataRaw = await dyRes.json();
      const dyData = Array.isArray(dyDataRaw) ? dyDataRaw : (dyDataRaw?.foods || []);
      
      if (dyData && Array.isArray(dyData) && dyData.length > 0) {
        // En iyi eşleşmeyi bul
        let bestItem = dyData[0];
        let bestScore = -1000;

        for (const item of dyData.slice(0, 8)) {
            const score = this.calculateScore(item.name, query);
            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
            }
        }

        const first = bestItem;
        const detailUrl = `https://www.dytseydaertas.com/besin/${first.slug}`;
        const foodName = first.name;
        
        let kcal = first.calories ? String(first.calories) : "---";
        let protein = first.protein ? String(first.protein) : "---";
        let carbs = first.carbs ? String(first.carbs) : "---";
        let fat = first.fat ? String(first.fat) : "---";

        if (!isFullReport) {
          return `🍎 **${foodName}**\n🔥 **Kalori:** ${kcal} kcal\n\n🔗 ${detailUrl}`;
        }

        const nutritionObj = {
          name: foodName,
          kcal,
          protein,
          fat,
          carbs,
          url: detailUrl,
          source: 'Dyt. Şeyda Ertaş'
        };

        return `NUTRITION_DATA:::${JSON.stringify(nutritionObj)}`;
      }

      // 2. Fallback: Diyetkolik
      const searchUrl = `https://www.diyetkolik.com/kac-kalori/arama/${encodeURIComponent(query)}`;
      const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
      const searchHtml = await searchRes.text();

      const linkRegex = /<a[^>]+class=['"]kkAramaSonucItemKutu[^'"]*['"][^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
      const matches = [...searchHtml.matchAll(linkRegex)];

      if (matches.length > 0) {
        let bestMatch = matches[0];
        let bestScore = -1000;

        for (const match of matches.slice(0, 8)) {
            const rawName = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            const score = this.calculateScore(rawName, query);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = match;
            }
        }

        const detailUrl = bestMatch[1].startsWith('http') ? bestMatch[1] : `https://www.diyetkolik.com${bestMatch[1]}`;
        let foodName = bestMatch[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        // Kafa karıştırıcı kalori ibarelerini isimden temizle (Örn: "• 297 kcal" veya "430 kalori")
        foodName = foodName.replace(/[•\-\|]?\s*\d+\s*(?:kcal|kalori|cal|kal)\b/gi, '').trim();
        // Gereksiz porsiyon yazılarını da temizle ki isim sade kalsın
        foodName = foodName.replace(/\d+\s*Porsiyon\s*(?:\([^)]*\))?/gi, '').replace(/\s+/g, ' ').trim();

        const detailRes = await fetch(detailUrl, { headers: { 'User-Agent': USER_AGENT } });
        const detailHtml = await detailRes.text();

        let kcal = "---", protein = "---", fat = "---", carbs = "---";
        
        // Diyetkolik hem eski <table> hem yeni <div> yapısını kullanıyor olabilir.
        const cleanText = (t: string) => t.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();

        // 1. Gelişmiş Tablo Taraması
        const allRows = detailHtml.split(/<tr[^>]*>|<div[^>]+class=['"]kkBesinDegerleriTabloSatir['"][^>]*>/i);
        let per100 = { kcal: "---", protein: "---", fat: "---", carbs: "---" };
        let perPortion = { kcal: "---", protein: "---", fat: "---", carbs: "---" };

        allRows.forEach(row => {
          const content = cleanText(row);
          if (!content) return;

          // Satırdaki sayıları bul, '100' sayısını (etiket olabilir) atla
          const numbers = [...row.matchAll(/([\d,.]+)/g)]
            .map(m => m[1].replace(',', '.'))
            .filter(n => n !== "100" && n !== "100.0"); // 100 gram etiketini atla

          if (numbers.length >= 1) {
              const val100 = numbers[0];
              const valPort = numbers[numbers.length - 1];

              if (content.includes('Enerji') || content.includes('Kalori')) {
                  per100.kcal = val100;
                  perPortion.kcal = valPort;
              } else if (content.includes('Protein')) {
                  per100.protein = val100;
                  perPortion.protein = valPort;
              } else if (content.includes('Yağ')) {
                  per100.fat = val100;
                  perPortion.fat = valPort;
              } else if (content.includes('Karbonhidrat') || content.includes('Karb')) {
                  per100.carbs = val100;
                  perPortion.carbs = valPort;
              }
          }
        });

        // 2. Fallback Regex (Eğer tabloda bulunamadıysa)
        const findVal = (label: string) => {
            const regex = new RegExp(`${label}[^\\d]*([\\d,.]+)`, 'i');
            const m = regex.exec(detailHtml);
            return m ? m[1].replace(',', '.') : "---";
        };

        if (perPortion.kcal === "---") perPortion.kcal = findVal('Kalori|Enerji');
        if (perPortion.protein === "---") perPortion.protein = findVal('Protein');
        if (perPortion.fat === "---") perPortion.fat = findVal('Yağ');
        if (perPortion.carbs === "---") perPortion.carbs = findVal('Karbonhidrat');

        if (!isFullReport) {
          return `🍎 **${foodName}**\n🔥 **Kalori:** ${perPortion.kcal} kcal\n\n🔗 ${detailUrl}`;
        }

        const nutritionObj = {
          name: foodName,
          kcal: perPortion.kcal,
          protein: perPortion.protein,
          fat: perPortion.fat,
          carbs: perPortion.carbs,
          per100: {
              kcal: per100.kcal !== "---" ? per100.kcal : perPortion.kcal,
              protein: per100.protein !== "---" ? per100.protein : perPortion.protein,
              fat: per100.fat !== "---" ? per100.fat : perPortion.fat,
              carbs: per100.carbs !== "---" ? per100.carbs : perPortion.carbs,
          },
          url: detailUrl,
          source: 'Diyetkolik'
        };

        return `NUTRITION_DATA:::${JSON.stringify(nutritionObj)}`;
      }

      return "Besin bilgisi bulunamadı. 🌽";
    } catch (e) {
      console.log("Scraper Error:", e);
      return "Besin değeri servisi şu an meşgul. ❌";
    }
  },

  /**
   * Günün Menüsünü Çekme (Bugün Ne Pişirsem?)
   */
  async fetchDailyMenu() {
    try {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}${month}${year}`;

      const menuUrl = `https://www.nefisyemektarifleri.com/bugun-ne-pisirsem/${dateStr}`;
      const response = await fetch(menuUrl, { headers: { 'User-Agent': USER_AGENT } });
      const html = await response.text();

      // Menü öğelerini çek (İlk 4-5 tanesi günün menüsüdür)
      const linkRegex = /<a[^>]+class="title"[^>]+href="([^"]+)"[^>]+title="([^"]+)"[^>]*>/g;
      let match;
      const menuItems = [];
      let count = 0;

      while ((match = linkRegex.exec(html)) !== null && count < 5) {
        menuItems.push({
          title: match[2].trim(),
          url: match[1]
        });
        count++;
      }

      if (menuItems.length === 0) return "Bugün için özel bir menü bulamadım. 🍳 Ama isterseniz size rastgele bir tarif önerebilirim!";

      let resp = `🗓️ **Günün Menüsü (${day}.${month}.${year})**\n\nBugün ne pişireceğine karar veremediysen işte senin için seçtiklerimiz:\n\n`;
      menuItems.forEach((item, index) => {
        resp += `${index + 1}. **${item.title}**\n🔗 ${item.url}\n\n`;
      });

      return resp;
    } catch (e) {
      return "Günün menüsüne şu an ulaşılamıyor. ❌";
    }
  },

  /**
   * Cümle içinden yiyecekleri ve miktarları akıllıca ayıklar (NLP Alternatifi)
   */
  parseFoodsFromText(text: string) {
    let cleanText = text.toLowerCase()
      .replace(/(kaç|kalori|besin|değerleri|değeri|nedir|kaçtır|nasıl|getir|yedim|içtim|bugün|öğle|akşam|kahvaltıda|yemeğinde|hesapla|bana|söyler|misin|acaba|sabah)/gi, " ")
      .replace(/[.,!?]/g, " ")
      .replace(/\b(ve|ile|yanında|bir de|ayrıca)\b/g, "|");

    const parts = cleanText.split('|').map(p => p.trim()).filter(p => p.length > 2);
    
    return parts.map(part => {
        const gramMatch = part.match(/^(\d+[,.]?\d*)\s*(?:gram|gr|g)\b/i);
        const portionMatch = part.match(/^(\d+[,.]?\d*)\s*(?:porsiyon|tabak|kase|bardak|dilim|adet|tane)\b/i);
        const quantityMatch = part.match(/^(\d+[,.]?\d*)/);

        let amount = 1;
        let isGram = false;
        let unitName = '';
        let searchTitle = part;

        if (gramMatch) {
            amount = parseFloat(gramMatch[1].replace(',', '.'));
            isGram = true;
            searchTitle = part.replace(/^(\d+[,.]?\d*)\s*(?:gram|gr|g)\b/i, '').trim();
        } else if (portionMatch) {
            amount = parseFloat(portionMatch[1].replace(',', '.'));
            unitName = part.match(/(?:porsiyon|tabak|kase|bardak|dilim|adet|tane)/i)?.[0] || '';
            searchTitle = part.replace(/^(\d+[,.]?\d*)\s*(?:porsiyon|tabak|kase|bardak|dilim|adet|tane)\b/i, '').trim();
        } else if (quantityMatch) {
            amount = parseFloat(quantityMatch[1].replace(',', '.'));
            searchTitle = part.replace(/^(\d+[,.]?\d*)/, '').trim();
        }

        // Kalan gereksiz kelimeleri de temizle
        searchTitle = searchTitle.replace(/^(bir|iki|üç|dört|beş|yarım|çeyrek)\b/i, '').trim();

        return { original: part, amount, isGram, unitName, searchTitle };
    });
  },

  async fetchInAppRecommendations(userMessage: string) {
    try {
        // Cümleden olası etiketleri çıkar
        const words = userMessage.toLowerCase().replace(/[.,!?]/g, '').split(' ');
        const commonTags = ['glutensiz', 'vegan', 'vejetaryen', 'tatlı', 'diyet', 'sağlıklı', 'protein', 'kahvaltı', 'öğle', 'akşam', 'sporcu', 'fit', 'şekersiz'];
        
        let foundTag = words.find(w => commonTags.includes(w)) || null;

        let query = supabase.from('posts').select('id, title, calories, user_id, is_sponsored, sponsor_budget, sponsor_views').eq('is_recipe', true);
        
        if (foundTag) {
            query = query.ilike('tags', `%${foundTag}%`);
        }

        // Önce sponsorlu olanları, sonra beğeniye göre sırala
        const { data, error } = await query
            .order('is_sponsored', { ascending: false })
            .order('likes', { ascending: false })
            .limit(3);

        if (error) throw error;

        // Bütçesi biten sponsorlu gönderileri ayıkla (eğer sponsorluysa bütçesi olmalı)
        let topRecipe = null;
        if (data && data.length > 0) {
            for (const item of data) {
                if (item.is_sponsored) {
                    if ((item.sponsor_budget || 0) > (item.sponsor_views || 0)) {
                        topRecipe = item;
                        break;
                    }
                } else {
                    topRecipe = item;
                    break;
                }
            }
        }

        if (topRecipe) {
            let author = 'Bir kullanıcı';
            
            if (topRecipe.user_id) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', topRecipe.user_id)
                    .single();
                if (profileData && profileData.username) {
                    author = profileData.username;
                }
            }

            // Eğer sponsorluysa ve önerildiyse bütçeden düş
            if (topRecipe.is_sponsored) {
                supabase.from('posts').update({ sponsor_views: (topRecipe.sponsor_views || 0) + 1 }).eq('id', topRecipe.id).then(() => {
                    if ((topRecipe.sponsor_views || 0) + 1 >= (topRecipe.sponsor_budget || 0)) {
                        supabase.from('posts').update({ is_sponsored: false }).eq('id', topRecipe.id).then();
                    }
                });
            }

            const sponsorText = topRecipe.is_sponsored ? "🚀 Öne çıkan " : "";
            return `Uygulama içinde ${foundTag ? `'${foundTag}' etiketli ` : ''}en popüler ${sponsorText}şu tarifi buldum:\n\nAPP_RECIPE:::${topRecipe.id}\n\nBu tarifi ${author} paylaşmış ve ${topRecipe.calories || '?'} kcal! Üstüne tıklayarak detaylara gidebilirsin.`;
        }

        // Eğer uygulamada bulunamazsa, internetten getir
        const fallbackQuery = foundTag ? `${foundTag} tarifi` : userMessage;
        const internetRecipe = await this.searchRecipes(fallbackQuery);
        return `Uygulama içinde ${foundTag ? `'${foundTag}' etiketli ` : ''}kullanıcı tarifi bulamadım ama internetten senin için en popüler şu tarifi getirdim:\n\n${internetRecipe}`;
        
    } catch (e) {
        console.error("In-app recommendation error:", e);
        // Hata anında da internetten getir
        return await this.searchRecipes(userMessage);
    }
  },

  async analyzeUserProgress(userId: string) {
    try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        
        // Son 3 günü kontrol et
        const today = new Date();
        let totalKcal = 0;
        let daysLogged = 0;
        
        for (let i = 0; i < 3; i++) {
            const dateStr = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
            const logStr = await AsyncStorage.getItem(`daily_food_log_${userId}_${dateStr}`);
            if (logStr) {
                const logs = JSON.parse(logStr);
                if (logs.length > 0) {
                    daysLogged++;
                    const dayKcal = logs.reduce((sum: number, item: any) => sum + (parseFloat(item.kcal) || 0), 0);
                    totalKcal += dayKcal;
                }
            }
        }
        
        if (daysLogged === 0) {
            return "Henüz yeterli yiyecek kaydın yok. Bana ne yediğini söylersen senin için kalori hesaplayıp kaydedebilirim! 📝";
        }
        
        const avgKcal = Math.round(totalKcal / daysLogged);
        const dailyGoal = 2000; // Varsayılan sağlıklı ortalama hedef
        
        let message = `📊 **Son ${daysLogged} Günlük Beslenme Raporun:**\n\n`;
        message += `Günlük ortalama aldığın kalori: **${avgKcal} kcal**\n\n`;
        
        if (avgKcal < dailyGoal - 300) {
            message += "🌟 Harika gidiyorsun! Kalori alımına çok iyi dikkat ediyorsun ve formunu koruma konusunda harika bir disiplinin var. Seninle gurur duyuyorum! 💪 Sağlıklı öğünlerine devam et. Dilersen enerjini yüksek tutacak sağlıklı atıştırmalıklar önerebilirim?";
        } else if (avgKcal <= dailyGoal + 100) {
            message += "👍 Çok dengeli ilerliyorsun! Ne çok fazla ne çok az; tam kararında besleniyorsun. Bu disiplinini koruman harika. Böyle devam et!";
        } else {
            message += "⚠️ Son günlerde kalori alımın ortalamanın biraz üstüne çıkmış gibi görünüyor ama hiç moral bozmak yok! Yürüyüş yaparak veya bugünkü öğünlerini daha hafif tutarak bunu kolayca dengeleyebiliriz. Sağlıklı ve düşük kalorili bir diyet tarifi ister misin?";
        }
        
        return message;
    } catch (e) {
        console.error("Progress analysis error:", e);
        return "Şu an beslenme günlüklerini okuyamıyorum, daha sonra tekrar deneyebilir misin?";
    }
  },

  /**
   * Hem tarif hem kalori bilgisini birleştirerek getirir
   */
  async getRecipeWithCalories(query: string) {
    try {
      const recipe = await this.searchRecipes(query);
      
      // Eğer tarif bulunamadıysa direkt mesajı dön
      if (recipe.includes("bulunamadı")) return recipe;

      // Başlıktan yola çıkarak kalori araması yap (İlk satırda kalın yazılmış isim var)
      const nameMatch = recipe.match(/🔍 \*\*(.*?)\*\*/);
      const foodName = nameMatch ? nameMatch[1] : query;
      
      const caloriesResponse = await this.searchCalories(foodName, false);
      let nutritionInfo = "";
      
      if (!caloriesResponse.includes("bulunamadı")) {
        nutritionInfo = `\n\n📊 **Yaklaşık Besin Değeri (Porsiyon):**\n${caloriesResponse.split('\n').filter(l => l.includes('Kalori')).join('\n')}`;
      }

      return `${recipe}${nutritionInfo}\n\n💡 *Not: Kalori değerleri yaklaşık değerlerdir.*`;
    } catch (e) {
      return await this.searchRecipes(query);
    }
  },

  async searchVenuesOnline(query: string, city?: string) {
    try {
      const locationStr = city || 'yakınımda';
      const googleQuery = `${query} ${locationStr}`;
      const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(googleQuery)}`;
      
      let resp = `Uygulama içinde uygun bir yer bulamadım ama Google Haritalar'da arayabilirsin: 🌐\n\n`;
      resp += `🔍 **"${query}"** araması için:\n`;
      resp += `📍 Google Maps'te Ara: ${googleMapsUrl}\n\n`;
      resp += `💡 **İpucu:** Yukarıdaki linke tıklayarak ${locationStr} bölgesindeki en yakın ve en popüler yerleri görebilirsin!`;
      return resp;
    } catch (e) {
      console.error("Venue Search Error:", e);
      return "Mekan önerisi servisine şu an ulaşılamıyor. ❌";
    }
  },

  async fetchInAppVenueRecommendations(userMessage: string) {
    try {
        const msg = userMessage.toLowerCase().replace(/[.,!?]/g, '');
        const words = msg.split(' ');
        const venueTags = [
            'kahvaltı', 'akşam', 'öğle', 'kahve', 'tatlı', 'kebap', 'pizza', 'burger',
            'deniz', 'et', 'meyhane', 'bar', 'cafe', 'kafe', 'döner', 'lahmacun',
            'pide', 'balık', 'kokoreç', 'çiğköfte', 'tantuni', 'künefe', 'börek',
            'sushi', 'steak', 'brunch', 'mangal', 'köfte', 'iskender', 'çorba',
            'nargile', 'pastane', 'fırın', 'manav', 'kasap'
        ];
        
        const foundTags = words.filter(w => venueTags.includes(w));
        const foundTag = foundTags.length > 0 ? foundTags[0] : null;

        // Şehir/ilçe tespiti
        const cityKeywords = msg.match(/(?:istanbul|ankara|izmir|bursa|antalya|kadıköy|beşiktaş|beyoğlu|üsküdar|bakırköy|şişli|karşıyaka|konak|bornova|alsancak|taksim|karaköy|eminönü|sultanahmet)/i);
        const city = cityKeywords ? cityKeywords[0] : null;

        // ========== DAHA ÖNCE GÖSTERİLEN POSTLARI HATIRLA ==========
        const storageKey = `shown_venue_posts_${foundTag || 'general'}`;
        let shownPostIds: string[] = [];
        try {
            const stored = await AsyncStorage.getItem(storageKey);
            if (stored) shownPostIds = JSON.parse(stored);
        } catch (e) { /* ilk seferde boş olabilir */ }

        // ========== BÖLÜM 1: UYGULAMA İÇİ SONUÇLAR (SADECE İŞLETME HESAPLARI) ==========
        let allPosts: any[] = [];
        
        // Adım 1: Tag ile eşleşen postları çek
        let candidatePosts: any[] = [];
        if (foundTag) {
            const { data: tagPosts, error: tagError } = await supabase
                .from('posts')
                .select('id, title, description, user_id, is_sponsored, sponsor_budget, sponsor_views, tags')
                .or(`tags.ilike.%${foundTag}%,title.ilike.%${foundTag}%,description.ilike.%${foundTag}%`)
                .order('is_sponsored', { ascending: false })
                .order('likes', { ascending: false })
                .limit(20);
            if (tagError) console.log('[VENUE DEBUG] Tag query error:', tagError.message);
            if (tagPosts) candidatePosts = tagPosts;
        }
        
        if (candidatePosts.length === 0) {
            const searchTerms = words.filter(w => w.length > 2 && !['bir', 'var', 'mı', 'mi', 'en', 'iyi', 'güzel', 'nerede', 'yakın', 'yakınında', 'öner', 'önerir', 'bul', 'yer', 'için', 'mekan'].includes(w));
            for (const term of searchTerms.slice(0, 2)) {
                const { data } = await supabase
                    .from('posts')
                    .select('id, title, description, user_id, is_sponsored, sponsor_budget, sponsor_views, tags')
                    .or(`tags.ilike.%${term}%,title.ilike.%${term}%,description.ilike.%${term}%`)
                    .order('is_sponsored', { ascending: false })
                    .order('likes', { ascending: false })
                    .limit(20);
                if (data && data.length > 0) {
                    candidatePosts.push(...data);
                    break;
                }
            }
        }

        // Adım 2: Sadece işletme hesaplarına ait olanları filtrele
        if (candidatePosts.length > 0) {
            const userIds = [...new Set(candidatePosts.map(p => p.user_id))];
            const { data: bizProfiles } = await supabase
                .from('profiles')
                .select('id, username, account_type')
                .in('id', userIds)
                .eq('account_type', 'business');

            if (bizProfiles && bizProfiles.length > 0) {
                const bizMap = new Map(bizProfiles.map(p => [p.id, p.username]));
                allPosts = candidatePosts
                    .filter(p => bizMap.has(p.user_id))
                    .map(p => ({ ...p, biz_username: bizMap.get(p.user_id) }));
            }
        }

        console.log(`[VENUE DEBUG] Tag: ${foundTag}, Candidates: ${candidatePosts.length}, Business posts: ${allPosts.length}`);

        // Daha önce gösterilmemiş postları öne al
        let freshPosts = allPosts.filter(p => !shownPostIds.includes(p.id));
        
        // Tüm postlar gösterildiyse listeyi sıfırla, baştan başla
        if (freshPosts.length === 0 && allPosts.length > 0) {
            shownPostIds = [];
            freshPosts = allPosts;
        }

        const postResults = freshPosts.slice(0, 3);

        // Gösterilen postları kaydet
        const newShownIds = [...shownPostIds, ...postResults.map(p => p.id)];
        try {
            await AsyncStorage.setItem(storageKey, JSON.stringify(newShownIds));
        } catch (e) { /* kayıt hatası kritik değil */ }

        let venueResults: any[] = [];
        try {
            let venueQuery = supabase.from('venues').select('*');
            if (foundTag) venueQuery = venueQuery.ilike('tags', `%${foundTag}%`);
            const { data: venueData } = await venueQuery
                .order('is_sponsored', { ascending: false })
                .order('rating', { ascending: false })
                .limit(3);
            if (venueData) venueResults = venueData;
        } catch (e) { /* venues tablosu yoksa sorun değil */ }

        // ========== YANIT OLUŞTURMA (HER ZAMAN İKİSİNİ BİRDEN GÖSTER) ==========
        const tagLabel = foundTag ? `'${foundTag}'` : 'aradığın';
        let resp = `${tagLabel} için hem uygulama içinden hem internetten sonuçları getirdim! 🔍\n\n`;

        // --- Uygulama İçi Bölümü ---
        const hasInApp = postResults.length > 0 || venueResults.length > 0;

        if (hasInApp) {
            resp += `📱 **UYGULAMA İÇİ SONUÇLAR:**\n`;
            resp += `${foundTag ? `'${foundTag}' etiketli` : 'İlgili'} paylaşımlara göz atabilirsin:\n\n`;

            if (postResults.length > 0) {
                const uniquePosts = postResults.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, 3);
                for (const post of uniquePosts) {
                    const sponsorPrefix = post.is_sponsored ? '🚀 ' : '📌 ';
                    const bizName = post.biz_username || '';
                    const bizLabel = bizName ? ` — 🏪 ${bizName}` : '';
                    resp += `${sponsorPrefix}**${post.title || post.description?.substring(0, 40) || 'Bir paylaşım'}**${bizLabel}\nAPP_POST:::${post.id}\n\n`;
                    
                    if (post.is_sponsored) {
                        supabase.from('posts').update({ sponsor_views: (post.sponsor_views || 0) + 1 }).eq('id', post.id).then();
                    }
                }
            }

            if (venueResults.length > 0) {
                resp += `🏛️ **Önerilen Mekanlar:**\n`;
                venueResults.forEach(venue => {
                    resp += `• **${venue.name}** (${venue.category || 'Restoran'}) - ⭐ ${venue.rating || '---'}\n`;
                });
                resp += '\n';
            }
        } else {
            resp += `📱 **UYGULAMA İÇİ:**\nHenüz ${foundTag ? `'${foundTag}' etiketli` : 'bu konuda'} bir paylaşım yok. İlk paylaşan sen ol! 🎉\n\n`;
        }

        // --- İnternet / Google Maps Bölümü (HER ZAMAN GÖSTER) ---
        resp += `➖➖➖➖➖➖➖➖➖➖\n\n`;
        
        const locationStr = city || 'yakınımda';
        const searchQuery = foundTag ? `${foundTag} restoranı ${city || ''}`.trim() : userMessage.replace(/öner|bul|var mı|nerede|mekan|için/gi, '').trim();
        const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

        resp += `🌐 **İNTERNETTEN POPÜLER MEKANLAR:**\n`;
        resp += `Konumuna yakın ${foundTag ? `${foundTag} mekanlarını` : 'mekanları'} Google Haritalar'da keşfet:\n\n`;
        resp += `📍 **Google Maps'te Ara:**\n${googleMapsUrl}\n\n`;
        resp += `💡 Yukarıdaki linke tıklayarak ${locationStr} bölgesindeki en popüler yerleri görebilir, yorumları okuyabilir ve yol tarifi alabilirsin!`;

        return resp;
        
    } catch (e) {
        console.error('Venue recommendation error:', e);
        return await this.searchVenuesOnline(userMessage);
    }
  },

  async handleQuery(userMessage: string, userId?: string) {
    const msg = userMessage.toLowerCase().trim();
    const cleanMsg = msg.replace(/[.,!?]/g, '');
    
    // MEKAN ÖNERİSİ KONTROLÜ (genişletilmiş)
    const venueKeywords = [
        'mekan', 'restoran', 'kafe', 'cafe', 'yer', 'nerede', 'lokanta', 'kahveci',
        'dönerci', 'pideci', 'kebapçı', 'balıkçı', 'pastane', 'fırın', 'büfe'
    ];
    const venueActions = ['öner', 'tavsiye', 'bul', 'var mı', 'bilir', 'gideyim', 'gidelim', 'gitmek', 'yemek istiyorum', 'nerede yenir', 'nerde'];
    const isVenueQuery = venueKeywords.some(kw => cleanMsg.includes(kw)) ||
        (venueActions.some(a => cleanMsg.includes(a)) && ['yemek', 'kahvaltı', 'akşam yemeği', 'öğle yemeği', 'brunch', 'döner', 'pizza', 'kebap', 'balık', 'köfte', 'lahmacun', 'pide', 'sushi', 'burger', 'tatlı', 'kahve'].some(f => cleanMsg.includes(f)) && !cleanMsg.includes('tarif') && !cleanMsg.includes('yapılır'));
    
    if (isVenueQuery) {
        return this.fetchInAppVenueRecommendations(userMessage);
    }

    // Kullanıcı Gelişim / Takip Kontrolü
    if (cleanMsg.includes('durumum') || cleanMsg.includes('gelişimim') || cleanMsg.includes('rapor') || cleanMsg.includes('nasıl gidiyorum') || cleanMsg.includes('takip et') || cleanMsg.includes('analiz')) {
        if (userId) return this.analyzeUserProgress(userId);
        return "Günlük beslenme durumunu analiz edebilmem için giriş yapman gerekiyor.";
    }

    // ÖZEL: Pratik Akşam Yemeği ve Sağlıklı Tatlı Butonları İçin
    if (cleanMsg.includes('pratik akşam yemeği')) {
      return this.getRecipeWithCalories("pratik akşam yemeği");
    }
    if (cleanMsg.includes('sağlıklı tatlı krizi')) {
      return this.getRecipeWithCalories("diyet tatlı");
    }
    if (cleanMsg.includes('düşük karbonhidratlı tarif')) {
      return this.getRecipeWithCalories("düşük karbonhidratlı yemek");
    }

    if (cleanMsg === 'merhaba' || cleanMsg === 'selam' || cleanMsg === 'hey' || cleanMsg === 'selamlar' || cleanMsg === 'mrb') {
        return "Merhaba! 👋 Ben FoodApp Lezzet Asistanı. Sana nasıl yardımcı olabilirim? (Örn: '1 porsiyon tavuk kaç kalori' veya 'Sağlıklı tarif öner')";
    }
    if (cleanMsg.includes('nasılsın') || cleanMsg.includes('naber') || cleanMsg.includes('ne haber')) {
        return "Teşekkürler, ben sadece kodlardan oluştuğum için harikayım! 🤖 Sen nasılsın? Bugün menüde ne var, bir şeyler hesaplayalım mı?";
    }
    if (cleanMsg.includes('teşekkürler') || cleanMsg.includes('teşekkür ederim') || cleanMsg.includes('sağ ol') || cleanMsg.includes('sağol') || cleanMsg === 'eyvallah') {
        return "Rica ederim! 🍽️ Başka bir şeye ihtiyacın olursa ben hep buradayım.";
    }
    if (cleanMsg.includes('kimsin') || cleanMsg.includes('sen nesin') || cleanMsg.includes('adın ne')) {
        return "Ben senin kişisel Lezzet Asistanınım! 👨‍🍳 Tarifler bulabilir, kalori hesaplayabilir ve sana popüler öneriler sunabilirim.";
    }
    if (cleanMsg === 'günaydın') return "Günaydın! ☀️ Güne harika bir kahvaltıyla başlamaya ne dersin? Sana sağlıklı bir kahvaltı tarifi önerebilirim.";
    if (cleanMsg === 'iyi geceler') return "İyi geceler! 🌙 Yarın görüşmek üzere, sağlıklı rüyalar!";
    
    // Uygulama İçi Öneri Kontrolü
    const suggestionKeywords = ['öner', 'önerisi', 'uygulama içinden', 'uygulamadan', 'bana bir', 'tavsiye', 'ne yapsam', 'fikir'];
    const isSuggestion = suggestionKeywords.some(kw => msg.includes(kw));
    if (isSuggestion && (msg.includes('tarif') || msg.includes('yemek') || msg.includes('öğün') || msg.includes('tatlı') || msg.includes('sağlıklı') || msg.includes('diyet') || msg.includes('fit'))) {
        return this.fetchInAppRecommendations(userMessage);
    }

    // Günün Menüsü Kontrolü
    if (msg.includes('menü') || msg.includes('ne pişirsem') || msg.includes('ne yesem') || msg.includes('bugün ne var')) {
      return this.fetchDailyMenu();
    }

    const recipeKeywords = ['tarifi', 'nasıl yapılır', 'yapımı', 'anlatımı', 'yapılışı'];
    const isRecipeQuery = recipeKeywords.some(kw => msg.includes(kw));
    if (isRecipeQuery) {
        const q = userMessage.replace(/(tarifi|nasıl|yapılır|verir|misin|yapımı|anlatımı|yapılışı|bana|lütfen)/gi, "").trim();
        return this.getRecipeWithCalories(q || userMessage); 
    }

    const nutritionKeywords = ['besin', 'değer', 'makro', 'protein', 'yağ', 'karbo', 'kalori', 'kcal', 'kaç', 'enerji', 'yedim', 'içtim'];
    const isNutritionQuery = nutritionKeywords.some(kw => msg.includes(kw));

    if (isNutritionQuery || msg.length < 30) {
      const parsedFoods = this.parseFoodsFromText(userMessage);
      
      if (parsedFoods.length === 0) {
          return "Tam olarak ne yediğini anlayamadım. Lütfen '1 porsiyon tavuk ve 1 bardak ayran' şeklinde belirtir misin?";
      }

      let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0;
      let responseText = parsedFoods.length > 1 ? "🍽️ **İşte Öğününün Analizi:**\n\n" : "";

      for (const food of parsedFoods) {
          if (food.searchTitle.length < 2) continue;

          const result = await this.searchCalories(food.searchTitle, true);
          if (result.startsWith('NUTRITION_DATA:::')) {
                const data = JSON.parse(result.replace('NUTRITION_DATA:::', ''));
                
                let finalKcal = 0, finalP = 0, finalF = 0, finalC = 0;

                if (food.isGram && data.per100) {
                    const ratio = food.amount / 100;
                    finalKcal = (parseFloat(data.per100.kcal) || 0) * ratio;
                    finalP = (parseFloat(data.per100.protein) || 0) * ratio;
                    finalF = (parseFloat(data.per100.fat) || 0) * ratio;
                    finalC = (parseFloat(data.per100.carbs) || 0) * ratio;
                } else {
                    finalKcal = (parseFloat(data.kcal) || 0) * food.amount;
                    finalP = (parseFloat(data.protein) || 0) * food.amount;
                    finalF = (parseFloat(data.fat) || 0) * food.amount;
                    finalC = (parseFloat(data.carbs) || 0) * food.amount;
                }

                const calcKcal = (finalP * 4) + (finalF * 9) + (finalC * 4);
                if (finalKcal < calcKcal * 0.8) finalKcal = calcKcal;

                const foodItemName = food.isGram ? `${food.amount}g ${data.name}` : 
                                     food.unitName ? `${food.amount} ${food.unitName} ${data.name}` : 
                                     food.amount !== 1 ? `${food.amount}x ${data.name}` : data.name;

                totalKcal += finalKcal;
                totalP += finalP;
                totalF += finalF;
                totalC += finalC;

                responseText += `✅ **${foodItemName}**\n🔥 ${Math.round(finalKcal)} kcal | P: ${Math.round(finalP)}g | Y: ${Math.round(finalF)}g | K: ${Math.round(finalC)}g\n\n`;
          } else {
                responseText += `❌ **${food.original}** - Sistemde tam olarak bulunamadı. Lütfen farklı kelimelerle deneyin.\n\n`;
          }
      }

      if (parsedFoods.length > 1) {
          responseText += `➖➖➖➖➖➖➖➖➖➖\n📊 **TOPLAM DEĞERLER:**\n🔥 **${Math.round(totalKcal)} kcal**\n💪 Protein: ${Math.round(totalP)}g\n🥑 Yağ: ${Math.round(totalF)}g\n🥖 Karbonhidrat: ${Math.round(totalC)}g\n\n`;
          responseText += "Bu öğünü günlüğüne manuel giriş alanından ekleyebilirsin!";
      }

      return responseText.trim();
    }
    
    return "Ne demek istediğini tam anlayamadım. Tarif isteyebilir, kalori sorabilir veya menü önerisi alabilirsin. 🤖";
  }

};
