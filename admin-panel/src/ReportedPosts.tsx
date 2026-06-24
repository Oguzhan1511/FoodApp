import { useEffect, useState } from 'react';
// @ts-ignore
import { supabase } from './services/supabaseConfig';
import { ArrowLeft, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

interface Report {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  post_description?: string;
  post_image?: string;
  reporter_name?: string;
}

export default function ReportedPosts({ onBack }: { onBack: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: reportsData, error } = await supabase
        .from('post_reports')
        .select(`
          *,
          posts:post_id (description, image_url),
          profiles:reporter_id (username)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = reportsData?.map((r: any) => ({
        ...r,
        post_description: r.posts?.description,
        post_image: r.posts?.image_url?.split(',')[0],
        reporter_name: r.profiles?.username
      })) || [];

      setReports(mapped);
    } catch (e) {
      console.error("Fetch reports error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('post_reports')
        .update({ status: 'reviewed' })
        .eq('id', reportId);
      if (error) throw error;
      setReports(reports.filter(r => r.id !== reportId));
    } catch (e) {
      alert("Hata oluştu.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Bu gönderiyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    
    try {
      // Post silindiğinde CASCADE ile raporlar da silinebilir veya manuel sileriz
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      
      setReports(reports.filter(r => r.post_id !== postId));
      alert("Gönderi başarıyla silindi.");
    } catch (e) {
      alert("Gönderi silinirken hata oluştu.");
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <button onClick={onBack} className="btn-primary" style={{ backgroundColor: 'transparent', border: '1px solid var(--glass-border)', padding: '10px' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="#ef4444" /> Raporlanan İçerikler
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Kullanıcı şikayetlerini inceleyin ve yönetin</p>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Yükleniyor...</div>
      ) : reports.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Şu an incelenmesi gereken bir şikayet bulunmuyor.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {reports.map((report) => (
            <div key={report.id} className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <img 
                src={report.post_image || 'https://via.placeholder.com/100'} 
                alt="Post" 
                style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>Şikayet Nedeni: {report.reason}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(report.created_at).toLocaleString('tr-TR')}</span>
                </div>
                <p style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Gönderi:</strong> {report.post_description || '(Açıklama yok)'}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}><strong>Şikayet Eden:</strong> @{report.reporter_name || 'Bilinmeyen'}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => handleDismissReport(report.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #22c55e', color: '#22c55e', backgroundColor: 'transparent', cursor: 'pointer' }}
                >
                  <CheckCircle size={16} /> Reddet
                </button>
                <button 
                  onClick={() => handleDeletePost(report.post_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ef4444', color: '#fff', backgroundColor: '#ef4444', cursor: 'pointer' }}
                >
                  <Trash2 size={16} /> Gönderiyi Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
