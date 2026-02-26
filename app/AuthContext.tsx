import React, { createContext, ReactNode, useContext, useState } from 'react';

// Kullanıcı tipi tanımı
interface User {
  id: string;
  username: string;
}

// Context tipi tanımı
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
}

// Context oluşturuluyor (Başlangıç değeri undefined olabilir, kontrol edeceğiz)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false); // Varsayılan olarak false, gerçek auth kontrolü varsa true başlayabilir

  // Login olduğunda çağrılacak fonksiyon
  const login = (userData: User) => {
    setUser(userData);
  };

  // Çıkış yapıldığında çağrılacak fonksiyon
  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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