import { useEffect, useState } from 'react';
// @ts-ignore
import { supabase } from './services/supabaseConfig';
import { ArrowLeft, Flag, Trash2 } from 'lucide-react';

interface Feedback {
  id: string;
  user_id: string;
  predicted_food: string;
  correct_food: string;
  confidence: number;
  image_url: string | null;
  created_at: string;
  username?: string;
}

export default function AnalysisFeedback({ onBack }: { onBack: () => void }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('analysis_feedback')
        .select('*, profiles:user_id (username)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFeedbacks(
        (data || []).map((f: any) => ({ ...f, username: f.profiles?.username }))
      );
    } catch (e) {
      console.error('Feedback fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    await supabase.from('analysis_feedback').delete().eq('id', id);
    setFeedbacks(prev => prev.filter(f => f.id !== id));
  };

  // Hata istatistiği: hangi yemek en çok yanlış tahmin edildi
  const errorStats: Record<string, number> = {};
  feedbacks.forEach(f => {
    errorStats[f.predicted_food] = (errorStats[f.predicted_food] || 0) + 1;
  });
  const topErrors = Object.entries(errorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <button onClick={onBack} className="btn-primary" style={{ backgroundColor: 'transparent', border: '1px solid var(--glass-border)', padding: '10px' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Flag color="#ef4444" /> Model Hata Bildirimleri
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Kullanıcıların yanlış bulduğu tahminler — {feedbacks.length} bildirim
          </p>
        </div>
      </header>

      {/* Özet İstatistik */}
      {topErrors.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-muted)' }}>
            🔴 En Çok Yanlış Tahmin Edilen Yiyecekler
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {topErrors.map(([food, count]) => (
              <div key={food} style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{food}</span>
                <span style={{
                  backgroundColor: '#ef4444', color: '#fff',
                  borderRadius: '12px', padding: '2px 8px', fontSize: '12px', fontWeight: 700
                }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Yükleniyor...</div>
      ) : feedbacks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Henüz hiç hata bildirimi yok. 🎉
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Tarih</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Kullanıcı</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Model Tahmini ❌</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Doğru Cevap ✅</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Güven</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500 }}>Görsel</th>
                <th style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map(f => (
                <tr key={f.id}>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', fontSize: '13px' }}>
                    {new Date(f.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', fontSize: '13px', color: 'var(--text-muted)' }}>
                    @{f.username || 'Bilinmeyen'}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                      padding: '4px 10px', borderRadius: '6px', fontSize: '13px',
                      textTransform: 'capitalize', fontWeight: 500
                    }}>
                      {f.predicted_food}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                      padding: '4px 10px', borderRadius: '6px', fontSize: '13px',
                      textTransform: 'capitalize', fontWeight: 500
                    }}>
                      {f.correct_food}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', fontSize: '13px' }}>
                    <span style={{ color: f.confidence > 0.7 ? '#eab308' : '#ef4444', fontWeight: 600 }}>
                      %{(f.confidence * 100).toFixed(0)}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    {f.image_url ? (
                      <a href={f.image_url} target="_blank" rel="noreferrer">
                        <img src={f.image_url} alt="food" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--glass-border)' }} />
                      </a>
                    ) : (
                      <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>⚠️ Görsel yok</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(f.id)}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
