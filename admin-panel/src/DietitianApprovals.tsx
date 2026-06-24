import { useEffect, useState } from 'react';
// @ts-ignore
import { supabase } from './services/supabaseConfig';
import { CheckCircle, XCircle, User, FileText, ArrowLeft } from 'lucide-react';

interface DietitianApplication {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  location: string;
  diploma_no: string;
  diploma_image_url: string | null;
  is_verified: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function DietitianApprovals({ onBack }: { onBack: () => void }) {
  const [applications, setApplications] = useState<DietitianApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dietitians')
        .select('*')
        .eq('approval_status', filter)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error: any) {
      console.error('Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('dietitians')
        .update({ is_verified: true, approval_status: 'approved' })
        .eq('id', id);
      if (error) throw error;

      // Profiles tablosunu da güncelle
      await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', id);

      alert('✅ Diyetisyen başarıyla onaylandı!');
      fetchApplications();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = 'Admin tarafından reddedildi.';
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('dietitians')
        .update({ is_verified: false, approval_status: 'rejected', rejection_reason: reason })
        .eq('id', id);
      if (error) throw error;
      alert('❌ Başvuru reddedildi.');
      fetchApplications();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span style={styles.badgeApproved}>✅ Onaylandı</span>;
    if (status === 'rejected') return <span style={styles.badgeRejected}>❌ Reddedildi</span>;
    return <span style={styles.badgePending}>⏳ Bekliyor</span>;
  };



  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} />
          Geri
        </button>
        <h1 style={styles.title}>Diyetisyen Başvuruları</h1>
      </div>

      {/* Filter Tabs */}
      <div style={styles.tabs}>
        {(['pending', 'approved', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              ...styles.tab,
              ...(filter === tab ? styles.tabActive : {})
            }}
          >
            {tab === 'pending' ? `⏳ Bekleyenler` : tab === 'approved' ? '✅ Onaylananlar' : '❌ Reddedilenler'}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div style={styles.center}>Yükleniyor...</div>
      ) : applications.length === 0 ? (
        <div style={styles.center}>
          <FileText size={48} color="#ccc" />
          <p style={{ color: '#999', marginTop: 12 }}>Bu kategoride başvuru yok.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {applications.map(app => (
            <div key={app.id} style={styles.card}>
              {/* Card Header */}
              <div style={styles.cardHeader}>
                <div style={styles.avatar}>
                  <User size={28} color="#800020" />
                </div>
                <div style={styles.cardInfo}>
                  <h3 style={styles.name}>{app.first_name} {app.last_name}</h3>
                  <p style={styles.sub}>@{app.username} · {app.email}</p>
                  <p style={styles.sub}>📍 {app.location} · Diploma No: {app.diploma_no}</p>
                  <p style={styles.date}>🕐 {new Date(app.created_at).toLocaleString('tr-TR')}</p>
                </div>
                {statusBadge(app.approval_status)}
              </div>

              {/* Diploma Image */}
              {app.diploma_image_url && (
                <div style={styles.diplomaSection}>
                  <p style={styles.diplomaLabel}>📄 Diploma / Belge</p>
                  <img
                    src={app.diploma_image_url}
                    alt="Diploma"
                    style={styles.diplomaThumb}
                    onClick={() => setSelectedImage(app.diploma_image_url)}
                    title="Büyütmek için tıkla"
                  />
                </div>
              )}

              {/* Action Buttons */}
              {app.approval_status === 'pending' && (
                <div style={styles.actions}>
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={processing === app.id}
                    style={styles.approveBtn}
                  >
                    <CheckCircle size={18} />
                    {processing === app.id ? 'İşleniyor...' : 'Onayla'}
                  </button>
                  <button
                    onClick={() => handleReject(app.id)}
                    disabled={processing === app.id}
                    style={styles.rejectBtn}
                  >
                    <XCircle size={18} />
                    Reddet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div style={styles.lightbox} onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Diploma Büyük" style={styles.lightboxImg} />
          <p style={{ color: 'white', marginTop: 10 }}>Kapatmak için tıkla</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#f5f5f5', border: 'none', borderRadius: '8px',
    padding: '8px 14px', cursor: 'pointer', fontSize: '14px'
  },
  title: { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: 0 },
  tabs: { display: 'flex', gap: '10px', marginBottom: '24px' },
  tab: {
    padding: '10px 20px', border: '2px solid #e0e0e0',
    borderRadius: '8px', cursor: 'pointer',
    background: 'white', fontSize: '14px', fontWeight: 500
  },
  tabActive: {
    borderColor: '#800020', color: '#800020',
    background: '#fff5f5'
  },
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    background: 'white', borderRadius: '12px',
    padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #f0f0f0'
  },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' },
  avatar: {
    width: '52px', height: '52px', borderRadius: '50%',
    background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0
  },
  cardInfo: { flex: 1 },
  name: { margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#1a1a2e' },
  sub: { margin: '0 0 2px', fontSize: '13px', color: '#666' },
  date: { margin: '4px 0 0', fontSize: '12px', color: '#999' },
  diplomaSection: { marginBottom: '14px' },
  diplomaLabel: { fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px' },
  diplomaThumb: {
    width: '160px', height: '110px', objectFit: 'cover',
    borderRadius: '8px', border: '2px solid #e0e0e0', cursor: 'pointer'
  },
  actions: { display: 'flex', gap: '10px' },
  approveBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#16a34a', color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px',
    cursor: 'pointer', fontSize: '14px', fontWeight: 600
  },
  rejectBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#dc2626', color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px',
    cursor: 'pointer', fontSize: '14px', fontWeight: 600
  },
  badgeApproved: {
    background: '#dcfce7', color: '#16a34a',
    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
  },
  badgePending: {
    background: '#fef9c3', color: '#ca8a04',
    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
  },
  badgeRejected: {
    background: '#fee2e2', color: '#dc2626',
    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
  },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px', color: '#999'
  },
  lightbox: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000, cursor: 'pointer'
  },
  lightboxImg: { maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px' },
};
