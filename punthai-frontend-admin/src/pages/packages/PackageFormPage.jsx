import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, Plus, Minus, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { createPackage, updatePackage, getPackageById } from '../../api/adminApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './PackageFormPage.module.css';

const emptyMaterial = () => ({
  name: '', detail: '', sort_order: 0, package_type: 'flat', sizes: []
});

const emptySize = () => ({ size_label: '', sort_order: 0 });

export default function PackageFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '', type: '', categories: [], thumbnail: '', is_active: true, materials: []
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) loadPackage();
  }, [id]);

  const loadPackage = async () => {
    setLoading(true);
    try {
      const res = await getPackageById(id);
      const pkg = res.data;
      setForm({
        name: pkg.name || '',
        type: pkg.type || '',
        categories: typeof pkg.categories === 'string' ? JSON.parse(pkg.categories) : (pkg.categories || []),
        thumbnail: pkg.thumbnail || '',
        is_active: !!pkg.is_active,
        materials: (pkg.materials || []).map(m => ({
          name: m.name || '',
          detail: m.detail || '',
          sort_order: m.sort_order || 0,
          package_type: m.package_type || 'flat',
          sizes: (m.sizes || []).map(s => ({ size_label: s.size_label, sort_order: s.sort_order || 0 })),
        })),
      });
    } catch (err) {
      toast.error('ไม่สามารถโหลดข้อมูล package');
      navigate('/packages');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!form.categories.includes(tagInput.trim())) {
        updateField('categories', [...form.categories, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag) => updateField('categories', form.categories.filter(t => t !== tag));

  const addMaterial = () => updateField('materials', [...form.materials, emptyMaterial()]);

  const removeMaterial = (idx) => updateField('materials', form.materials.filter((_, i) => i !== idx));

  const updateMaterial = (idx, field, value) => {
    const mats = [...form.materials];
    mats[idx] = { ...mats[idx], [field]: value };
    updateField('materials', mats);
  };

  const addSize = (matIdx) => {
    const mats = [...form.materials];
    mats[matIdx] = { ...mats[matIdx], sizes: [...mats[matIdx].sizes, emptySize()] };
    updateField('materials', mats);
  };

  const removeSize = (matIdx, sizeIdx) => {
    const mats = [...form.materials];
    mats[matIdx] = { ...mats[matIdx], sizes: mats[matIdx].sizes.filter((_, i) => i !== sizeIdx) };
    updateField('materials', mats);
  };

  const updateSize = (matIdx, sizeIdx, field, value) => {
    const mats = [...form.materials];
    const sizes = [...mats[matIdx].sizes];
    sizes[sizeIdx] = { ...sizes[sizeIdx], [field]: value };
    mats[matIdx] = { ...mats[matIdx], sizes };
    updateField('materials', mats);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.type.trim()) {
      toast.error('กรุณากรอกชื่อและประเภท');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updatePackage(id, form);
        toast.success('อัพเดท package สำเร็จ');
      } else {
        await createPackage(form);
        toast.success('สร้าง package สำเร็จ');
      }
      navigate('/packages');
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className={styles.page}>
      <form onSubmit={handleSubmit}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Package size={20} /> {isEdit ? 'แก้ไข Package' : 'สร้าง Package ใหม่'}
          </h2>

          <div className={styles.form}>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>ชื่อ Package *</label>
                <input className={styles.input} type="text" placeholder="เช่น Food Pouch"
                  value={form.name} onChange={(e) => updateField('name', e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>ประเภท *</label>
                <input className={styles.input} type="text" placeholder="เช่น ถุงอาหารซิปล็อค"
                  value={form.type} onChange={(e) => updateField('type', e.target.value)} />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>หมวดหมู่ (กด Enter เพื่อเพิ่ม)</label>
              <div className={styles.tagInput}>
                {form.categories.map(tag => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                    <span className={styles.tagRemove} onClick={() => removeTag(tag)}>&times;</span>
                  </span>
                ))}
                <input
                  className={styles.tagInputField}
                  placeholder="เพิ่มหมวดหมู่..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>URL รูป Thumbnail</label>
                <input className={styles.input} type="text" placeholder="/uploads/packages/..."
                  value={form.thumbnail} onChange={(e) => updateField('thumbnail', e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>สถานะ</label>
                <div className={styles.toggle}>
                  <div
                    className={`${styles.toggleSwitch} ${form.is_active ? styles.toggleSwitchActive : ''}`}
                    onClick={() => updateField('is_active', !form.is_active)}
                  >
                    <div className={`${styles.toggleDot} ${form.is_active ? styles.toggleDotActive : ''}`} />
                  </div>
                  <span className={styles.toggleLabel}>{form.is_active ? 'แสดงผล' : 'ซ่อน'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}><Layers size={20} /> วัสดุ (Materials)</h2>

          {form.materials.map((mat, matIdx) => (
            <div key={matIdx} className={styles.materialCard}>
              <div className={styles.materialHeader}>
                <span className={styles.materialTitle}>วัสดุ #{matIdx + 1}</span>
                <button type="button" className={styles.removeMaterialBtn} onClick={() => removeMaterial(matIdx)}>
                  <Minus size={12} /> ลบ
                </button>
              </div>
              <div className={styles.materialForm}>
                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>ชื่อวัสดุ</label>
                    <input className={styles.input} type="text" placeholder="เช่น ฟิล์มอาหาร"
                      value={mat.name} onChange={(e) => updateMaterial(matIdx, 'name', e.target.value)} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>ประเภทแพ็คเกจ</label>
                    <select className={styles.select} value={mat.package_type}
                      onChange={(e) => updateMaterial(matIdx, 'package_type', e.target.value)}>
                      <option value="flat">Flat</option>
                      <option value="wrap">Wrap</option>
                      <option value="box">Box</option>
                    </select>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>รายละเอียด</label>
                  <textarea className={styles.textarea} placeholder="รายละเอียดวัสดุ..."
                    value={mat.detail} onChange={(e) => updateMaterial(matIdx, 'detail', e.target.value)} />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>ขนาดที่มี</label>
                  {mat.sizes.map((size, sizeIdx) => (
                    <div key={sizeIdx} className={styles.sizeRow}>
                      <input className={styles.sizeInput} placeholder="เช่น 50g, M, 100ml"
                        value={size.size_label} onChange={(e) => updateSize(matIdx, sizeIdx, 'size_label', e.target.value)} />
                      <button type="button" className={styles.removeSizeBtn} onClick={() => removeSize(matIdx, sizeIdx)}>
                        &times;
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.addBtn} onClick={() => addSize(matIdx)}>
                    <Plus size={14} /> เพิ่มขนาด
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className={styles.addBtn} onClick={addMaterial}>
            <Plus size={16} /> เพิ่มวัสดุใหม่
          </button>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={() => navigate('/packages')}>
            ยกเลิก
          </button>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : (isEdit ? 'อัพเดท Package' : 'สร้าง Package')}
          </button>
        </div>
      </form>
    </div>
  );
}
