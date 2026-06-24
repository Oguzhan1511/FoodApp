import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Lock } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Sadece belirlenen admin hesabı
    if (email === 'oguzhan@gmail.com' && password === '123456') {
      localStorage.setItem('admin_auth', 'true');
      onLogin();
      navigate('/dashboard');
    } else {
      setError('Yetkisiz giriş denemesi. Lütfen admin bilgilerinizi kontrol edin.');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', textAlign: 'center' }}>
        <ChefHat size={48} color="var(--primary)" style={{ marginBottom: '20px' }} />
        <h1 style={{ marginBottom: '10px', fontSize: '24px' }}>FoodApp Admin</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Yönetim Paneline Giriş Yapın</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <input 
              type="email" 
              placeholder="Admin E-posta" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Şifre" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {error && <p style={{ color: 'var(--primary)', fontSize: '14px', textAlign: 'left' }}>{error}</p>}
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Lock size={18} />
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
