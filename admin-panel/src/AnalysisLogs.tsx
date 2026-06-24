import { useEffect, useState } from 'react';
// @ts-ignore
import { supabase } from './services/supabaseConfig';
import { ArrowLeft, Brain } from 'lucide-react';

interface AnalysisLog {
  id: string;
  user_id: string;
  image_url: string;
  food_name: string;
  confidence: number;
  created_at: string;
  username?: string;
}

export default function AnalysisLogs({ onBack }: { onBack: () => void }) {
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('analysis_logs')
        .select(`
          *,
          profiles:user_id (username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = data?.map((l: any) => ({
        ...l,
        username: l.profiles?.username
      })) || [];

      setLogs(mapped);
    } catch (e) {
      console.error("Fetch logs error:", e);
    } finally {
      setLoading(false);
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
            <Brain color="#3b82f6" /> AI Analiz Kayıtları
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Modelin performansını ve kullanıcı aramalarını takip edin</p>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Yükleniyor...</div>
      ) : logs.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Henüz bir analiz kaydı bulunmuyor.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {logs.map((log) => (
            <div key={log.id} className="glass-panel" style={{ overflow: 'hidden' }}>
              <img 
                src={log.image_url} 
                alt="Analiz" 
                style={{ width: '100%', height: '200px', objectFit: 'cover' }}
              />
              <div style={{ padding: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '18px', textTransform: 'capitalize' }}>{log.food_name}</h3>
                  <span style={{ 
                    backgroundColor: log.confidence > 0.7 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: log.confidence > 0.7 ? '#22c55e' : '#eab308',
                    padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                  }}>
                    %{(log.confidence * 100).toFixed(0)} Güven
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <p>👤 @{log.username || 'Bilinmeyen'}</p>
                  <p>📅 {new Date(log.created_at).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
