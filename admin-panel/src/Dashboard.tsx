import { useEffect, useState } from 'react';
// @ts-ignore
import { supabase } from './services/supabaseConfig';
import { Users, FileText, Megaphone, DollarSign, LogOut, ShieldCheck, BarChart3, Activity, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DietitianApprovals from './DietitianApprovals';
import ReportedPosts from './ReportedPosts';
import AnalysisLogs from './AnalysisLogs';
import AnalysisFeedback from './AnalysisFeedback';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

interface AdPost {
  id: string;
  sponsor_budget: number;
  sponsor_keywords: string;
  created_at: string;
  type: 'post' | 'profile';
  name?: string; // profile name or username
  sponsor_views?: number;
  likes?: number;
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    activeAds: 0,
    adRevenue: 0,
    dietPlanSales: 0,
    premiumCount: 0,
    premiumRevenue: 0,
  });
  const [ads, setAds] = useState<AdPost[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [selectedAdAnalytics, setSelectedAdAnalytics] = useState<AdPost | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Kullanıcı sayısı
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      
      // 1.1 Premium Kullanıcı Sayısı
      const { count: premiumCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'premium');

      // 2. Gönderi sayısı
      const { count: postsCount } = await supabase.from('posts').select('*', { count: 'exact', head: true });
      
      // 3. Reklamlar (Gönderiler)
      const { data: postAds } = await supabase
        .from('posts')
        .select('id, sponsor_budget, sponsor_keywords, created_at, sponsor_views, likes')
        .eq('is_sponsored', true);
        
      // 3.1 Reklamlar (Profiller)
      const { data: profileAds } = await supabase
        .from('profiles')
        .select('id, sponsor_budget, sponsor_keywords, created_at, username, ad, soyad, sponsor_views')
        .eq('is_sponsored', true);

      const combinedAds: AdPost[] = [
        ...(postAds?.map((ad: any) => ({ ...ad, type: 'post' as const })) || []),
        ...(profileAds?.map((ad: any) => ({ 
          ...ad, 
          type: 'profile' as const, 
          name: ad.ad ? `${ad.ad} ${ad.soyad}` : ad.username 
        })) || [])
      ];
        
      const activeAdsCount = combinedAds.length;
      const totalRevenue = combinedAds.reduce((sum: number, ad: AdPost) => sum + (Number(ad.sponsor_budget) || 0), 0);

      // 4. Diyet Planı Satışları
      const { data: rawSales, error: salesError } = await supabase
        .from('diet_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) console.error("Sales fetch error:", salesError);

      // Kullanıcı ve Diyetisyen bilgilerini toplu çek (eşleştirme için)
      const { data: allProfiles } = await supabase.from('profiles').select('id, ad, soyad, username');
      const { data: allDietitians } = await supabase.from('dietitians').select('id, first_name, last_name, username');

      const mappedSales = rawSales?.map((s: any) => {
        const dietitianId = s.plan_data?.purchased_dietitian_id;
        const dietitian = allDietitians?.find((d: any) => d.id === dietitianId);
        const buyer = allProfiles?.find((p: any) => p.id === s.user_id);
        
        return {
          ...s,
          amount: s.plan_data?.purchased_amount || 250,
          dietitian_name: dietitian ? `${dietitian.first_name} ${dietitian.last_name}` : 'Bilinmiyor',
          dietitian_username: dietitian ? dietitian.username : '',
          buyer_name: buyer ? `${buyer.ad} ${buyer.soyad}` : 'Bilinmiyor',
          buyer_username: buyer ? buyer.username : '---'
        };
      }) || [];

      const commissionRevenue = mappedSales.reduce((sum: number, s: any) => {
        const amount = Number(s.amount) || 250;
        return sum + (amount * 0.10); // %10 komisyon bize geliyor
      }, 0);

      const pCount = premiumCount || 0;
      setStats({
        totalUsers: usersCount || 0,
        totalPosts: postsCount || 0,
        activeAds: activeAdsCount,
        adRevenue: totalRevenue,
        dietPlanSales: commissionRevenue,
        premiumCount: pCount,
        premiumRevenue: pCount * 99, // ₺99'dan hesaplıyoruz
      });

      setAds(combinedAds.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setSales(mappedSales);

      // Bekleyen diyetisyen başvuruları
      const { count: pendingApps } = await supabase
        .from('dietitians')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');
      setPendingCount(pendingApps || 0);

      // Bekleyen raporlar
      const { count: pendingReports } = await supabase
        .from('post_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setReportCount(pendingReports || 0);
    } catch (error) {
      console.error('Veri çekme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAd = async (postId: string) => {
    if (!window.confirm('Bu reklamı iptal etmek istediğinize emin misiniz?')) return;
    
    try {
      const table = ads.find(a => a.id === postId)?.type === 'post' ? 'posts' : 'profiles';
      const { error } = await supabase
        .from(table)
        .update({ is_sponsored: false, sponsor_budget: null, sponsor_keywords: null })
        .eq('id', postId);
        
      if (error) throw error;
      
      // Refresh data
      fetchDashboardData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    onLogout();
    navigate('/');
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Yükleniyor...</div>;
  }

  if (showApprovals) {
    return <DietitianApprovals onBack={() => { setShowApprovals(false); fetchDashboardData(); }} />;
  }

  if (showReports) {
    return <ReportedPosts onBack={() => { setShowReports(false); fetchDashboardData(); }} />;
  }

  if (showAnalysis) {
    return <AnalysisLogs onBack={() => { setShowAnalysis(false); fetchDashboardData(); }} />;
  }

  if (showFeedback) {
    return <AnalysisFeedback onBack={() => { setShowFeedback(false); }} />;
  }

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>FoodApp Yönetim</h1>
          <p style={{ color: 'var(--text-muted)' }}>Uygulama istatistikleri ve reklam takibi</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowApprovals(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}
          >
            <ShieldCheck size={18} /> Diyetisyen Onayları
            {pendingCount > 0 && (
              <span style={{
                background: '#ef4444', color: 'white',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, marginLeft: '4px'
              }}>{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowReports(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <AlertTriangle size={18} /> Raporlar
            {reportCount > 0 && (
              <span style={{
                background: '#ef4444', color: 'white',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, marginLeft: '4px'
              }}>{reportCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowAnalysis(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}
          >
            <Activity size={18} /> AI Analizleri
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <AlertTriangle size={18} /> Model Hataları
          </button>
          <button onClick={handleLogout} className="btn-primary" style={{ backgroundColor: 'transparent', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={18} /> Çıkış Yap
          </button>
        </div>
      </header>

      {/* İstatistik Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <Users size={32} color="#3b82f6" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Toplam Kullanıcı</p>
            <h2 style={{ fontSize: '32px' }}>{stats.totalUsers}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <FileText size={32} color="#a855f7" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Toplam Gönderi</p>
            <h2 style={{ fontSize: '32px' }}>{stats.totalPosts}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <Megaphone size={32} color="#eab308" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Aktif Reklamlar</p>
            <h2 style={{ fontSize: '32px' }}>{stats.activeAds}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <DollarSign size={32} color="#22c55e" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Reklam Geliri</p>
            <h2 style={{ fontSize: '32px' }}>₺{stats.adRevenue.toLocaleString()}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(20, 184, 166, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <DollarSign size={32} color="#14b8a6" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Diyet Komisyon Geliri (%10)</p>
            <h2 style={{ fontSize: '32px' }}>₺{stats.dietPlanSales.toLocaleString()}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <ShieldCheck size={32} color="#8b5cf6" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Premium Üyeler</p>
            <h2 style={{ fontSize: '32px' }}>{stats.premiumCount}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', padding: '16px', borderRadius: '12px' }}>
            <DollarSign size={32} color="#eab308" />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>Premium Geliri</p>
            <h2 style={{ fontSize: '32px' }}>₺{stats.premiumRevenue.toLocaleString()}</h2>
          </div>
        </div>
      </div>

      {/* Genel Analiz Grafikleri */}
      <h2 style={{ marginBottom: '20px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BarChart3 size={24} /> Reklam Performans Analizi
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="glass-panel" style={{ padding: '24px', height: '350px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--text-muted)' }}>Reklam Türü Dağılımı (Bütçe Bazlı)</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Gönderiler', value: ads.filter((a: AdPost) => a.type === 'post').reduce((sum, a) => sum + (a.sponsor_budget || 0), 0) },
                  { name: 'Profiller', value: ads.filter((a: AdPost) => a.type === 'profile').reduce((sum, a) => sum + (a.sponsor_budget || 0), 0) }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#a855f7" />
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel" style={{ padding: '24px', height: '350px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--text-muted)' }}>En Çok Gösterim Alan Reklamlar</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart
              data={ads
                .sort((a, b) => (b.sponsor_views || 0) - (a.sponsor_views || 0))
                .slice(0, 5)
                .map(a => ({
                  name: a.type === 'post' ? `Post ${a.id.slice(0,4)}` : (a.name || 'Profil'),
                  gosterim: a.sponsor_views || 0,
                  butce: a.sponsor_budget || 0
                }))
              }
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="gosterim" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reklam Tablosu */}
      <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Aktif Sponsorlu Gönderiler (Uygulama İçi Satın Alımlar)</h2>
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {ads.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz aktif bir reklam (sponsorlu gönderi) bulunmuyor.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Tarih</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Tür</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Detay / ID</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Anahtar Kelimeler</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Performans</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Bütçe (Gelir)</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad: AdPost) => (
                <tr key={ad.id} style={{ transition: 'background-color 0.2s' }}>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    {new Date(ad.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ 
                      backgroundColor: ad.type === 'post' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                      color: ad.type === 'post' ? '#3b82f6' : '#a855f7',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                    }}>
                      {ad.type === 'post' ? 'GÖNDERİ' : 'PROFİL'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', fontSize: '13px' }}>
                    {ad.type === 'post' ? `ID: ${ad.id.split('-')[0]}...` : ad.name}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {ad.sponsor_keywords?.split(',').map((k, i) => (
                        <span key={i} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
                          {k.trim()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ fontSize: '13px' }}>
                      <span style={{ color: '#3b82f6' }}>👁️ {ad.sponsor_views || 0}</span>
                      {ad.type === 'post' && <span style={{ color: '#ec4899', marginLeft: '12px' }}>❤️ {ad.likes || 0}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, color: '#22c55e' }}>
                    ₺{ad.sponsor_budget}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => setSelectedAdAnalytics(ad)}
                        style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                          color: '#3b82f6', 
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Activity size={14} /> Analiz
                      </button>
                      <button 
                        onClick={() => handleCancelAd(ad.id)}
                        style={{ 
                          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                          color: '#ef4444', 
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500
                        }}
                      >
                        İptal Et
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Diyet Planı Satış Tablosu */}
      <h2 style={{ margin: '40px 0 20px 0', fontSize: '20px' }}>Diyet Planı Satın Alımları</h2>
      <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: '40px' }}>
        {sales.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Henüz bir diyet planı satışı bulunmuyor.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Tarih</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Satın Alan</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Diyetisyen</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Tutar</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale: any) => (
                <tr key={sale.id}>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    {new Date(sale.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    {sale.buyer_name} (@{sale.buyer_username})
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    {sale.dietitian_name} {sale.dietitian_username && `(@${sale.dietitian_username})`}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, color: '#22c55e' }}>
                    ₺{sale.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Analytics Modal */}
      {selectedAdAnalytics && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-panel" style={{ 
            maxWidth: '900px', width: '100%', padding: '40px', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button 
              onClick={() => setSelectedAdAnalytics(null)}
              style={{ position: 'absolute', top: '25px', right: '25px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
              <div style={{ backgroundColor: selectedAdAnalytics.type === 'post' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)', padding: '16px', borderRadius: '16px' }}>
                <Megaphone size={32} color={selectedAdAnalytics.type === 'post' ? '#3b82f6' : '#a855f7'} />
              </div>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 700 }}>Kampanya Performansı</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                  {selectedAdAnalytics.type === 'post' ? 'Gönderi Reklamı' : 'Profil Reklamı'} • {selectedAdAnalytics.id.slice(0, 12)}
                </p>
              </div>
            </div>

            {/* Temel Metrikler Izgarası */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '35px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Görüntüleme</p>
                <h4 style={{ fontSize: '32px', fontWeight: 800, color: '#3b82f6' }}>{selectedAdAnalytics.sponsor_views || 0}</h4>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#3b82f6', opacity: 0.8 }}>Toplam erişim</div>
              </div>
              
              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Etkileşim</p>
                <h4 style={{ fontSize: '32px', fontWeight: 800, color: '#ec4899' }}>{selectedAdAnalytics.likes || 0}</h4>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#ec4899', opacity: 0.8 }}>Beğeni / Tıklama</div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Birim Maliyet (CPV)</p>
                <h4 style={{ fontSize: '32px', fontWeight: 800, color: '#22c55e' }}>
                  ₺{selectedAdAnalytics.sponsor_views ? (selectedAdAnalytics.sponsor_budget / selectedAdAnalytics.sponsor_views).toFixed(2) : '0.00'}
                </h4>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#22c55e', opacity: 0.8 }}>Görüntüleme başı</div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>E. Skoru (ER)</p>
                <h4 style={{ fontSize: '32px', fontWeight: 800, color: '#eab308' }}>
                  %{selectedAdAnalytics.sponsor_views ? ((selectedAdAnalytics.likes || 0) / selectedAdAnalytics.sponsor_views * 100).toFixed(1) : '0.0'}
                </h4>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#eab308', opacity: 0.8 }}>Etkileşim oranı</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              {/* Sol Taraf: Etkileşim Dağılımı */}
              <div className="glass-panel" style={{ padding: '25px', height: '350px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: 600 }}>Etkileşim Hunisi</h3>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Görüntüleme', value: selectedAdAnalytics.sponsor_views || 1 },
                        { name: 'Etkileşim', value: (selectedAdAnalytics.likes || 0) }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      <Cell fill="rgba(59, 130, 246, 0.3)" />
                      <Cell fill="#ec4899" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Sağ Taraf: Bütçe Verimliliği */}
              <div className="glass-panel" style={{ padding: '25px', height: '350px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px', fontWeight: 600 }}>Bütçe Kullanım Verimliliği</h3>
                <div style={{ marginTop: '20px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>Tahmini Bütçe Tüketimi</p>
                  <div style={{ width: '100%', height: '12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ 
                      width: `${Math.min(100, (selectedAdAnalytics.sponsor_views || 0) / (selectedAdAnalytics.sponsor_budget * 10) * 100)}%`, 
                      height: '100%', 
                      backgroundColor: '#22c55e',
                      borderRadius: '6px'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>₺0</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>₺{selectedAdAnalytics.sponsor_budget} (Max)</span>
                  </div>
                </div>

                <div style={{ marginTop: '40px', padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <Activity size={18} color="#3b82f6" />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Performans Özeti</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    Bu kampanya şu ana kadar <b>₺{((selectedAdAnalytics.sponsor_views || 0) * 0.05).toFixed(2)}</b> değerinde görünürlük sağladı. 
                    Etkileşim oranı sektör ortalamasının <b>{((selectedAdAnalytics.likes || 0) / (selectedAdAnalytics.sponsor_views || 1) * 100 > 5) ? 'üzerinde' : 'altında'}</b>.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setSelectedAdAnalytics(null)}
                className="btn-primary"
                style={{ flex: 1, padding: '15px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid var(--glass-border)' }}
              >
                Kapat
              </button>
              <button 
                onClick={() => { handleCancelAd(selectedAdAnalytics.id); setSelectedAdAnalytics(null); }}
                className="btn-primary"
                style={{ flex: 1, padding: '15px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                Reklamı Yayından Kaldır
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
