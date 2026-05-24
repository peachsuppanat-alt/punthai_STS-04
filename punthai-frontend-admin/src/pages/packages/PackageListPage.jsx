import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Trash2, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPackages, deletePackage } from '../../api/adminApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './PackageListPage.module.css';

export default function PackageListPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadPackages();
  }, [search]);

  const loadPackages = async () => {
    try {
      const res = await getPackages({ search, limit: 100 });
      setPackages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePackage(deleteTarget.id);
      toast.success('ลบ package สำเร็จ');
      setDeleteTarget(null);
      loadPackages();
    } catch (err) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <input
            className={styles.searchInput}
            placeholder="ค้นหาชื่อหรือประเภท..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.addBtn} onClick={() => navigate('/packages/new')}>
          <Plus size={18} /> สร้างแพ็คเกจใหม่
        </button>
      </div>

      <div className={styles.grid}>
        {packages.length === 0 ? (
          <div className={styles.empty}>
            <Package size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>ยังไม่มี package</p>
          </div>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className={styles.card}>
              <div className={styles.cardThumb}>
                {pkg.thumbnail ? (
                  <img src={`http://localhost:3000${pkg.thumbnail}`} alt={pkg.name} />
                ) : (
                  <span className={styles.thumbPlaceholder}><Package size={40} /></span>
                )}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{pkg.name}</div>
                <div className={styles.cardType}>{pkg.type}</div>
                <div className={styles.cardMeta}>
                  <span>{pkg.material_count || 0} วัสดุ</span>
                  <span className={`${styles.statusBadge} ${pkg.is_active ? styles.statusActive : styles.statusInactive}`}>
                    {pkg.is_active ? 'แสดงผล' : 'ซ่อน'}
                  </span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.editBtn} onClick={() => navigate(`/packages/${pkg.id}/edit`)}>
                  <Edit3 size={14} /> แก้ไข
                </button>
                <button className={styles.deleteBtn} onClick={() => setDeleteTarget(pkg)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {deleteTarget && (
        <div className={styles.confirmOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <Trash2 size={40} color="var(--color-danger)" style={{ marginBottom: '12px' }} />
            <div className={styles.confirmTitle}>ยืนยันการลบ</div>
            <div className={styles.confirmText}>
              ต้องการลบ "{deleteTarget.name}" หรือไม่? (Package จะถูกซ่อนจากผู้ใช้)
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>ยกเลิก</button>
              <button className={styles.confirmDeleteBtn} onClick={handleDelete}>ยืนยันลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
