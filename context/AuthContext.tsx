import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseConfig';

// Kullanıcı tipi tanımı
interface User {
  id: string;
  username: string;
  ad?: string;
  soyad?: string;
  avatar_url?: string | null;
  role?: string;
}

// Context tipi tanımı
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

// Context oluşturuluyor
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Başlangıçta true yaparak session kontrolünü bekle

  useEffect(() => {
    // Uygulama açıldığında mevcut oturumu kontrol et
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Profil bilgilerini de çekelim (username, ad, soyad vb. için)
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setUser({
              id: session.user.id,
              username: profile.username,
              ad: profile.ad,
              soyad: profile.soyad,
              avatar_url: profile.avatar_url,
              role: profile.role
            });
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Oturum değişikliklerini dinle (Login/Logout vb.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Oturum açıldıysa profil bilgilerini çek/güncelle
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUser({
            id: session.user.id,
            username: profile.username,
            ad: profile.ad,
            soyad: profile.soyad,
            avatar_url: profile.avatar_url,
            role: profile.role
          });
        }
      } else {
        // Oturum kapandıysa kullanıcıyı temizle
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login olduğunda çağrılacak fonksiyon (Manuel login için gerekirse)
  const login = (userData: User) => {
    setUser(userData);
  };

  // Kullanıcı verilerini güncellemek için fonksiyon
  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  // Çıkış yapıldığında çağrılacak fonksiyon
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook: Context'i kolayca kullanmak için
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};