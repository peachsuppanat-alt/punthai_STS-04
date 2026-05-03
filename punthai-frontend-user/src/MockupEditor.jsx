// punthai-frontend-user/src/MockupEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KImg, Transformer } from 'react-konva';
import html2canvas from 'html2canvas';

const API = 'http://localhost:3000';

// Color palette (match other pages)
const C = {
    primary: '#c94e1f',
    primaryDark: '#8f1d1d',
    label: '#8a9a3c',
    accent: '#d3542b',
    text: '#2a2a2a',
    sub: '#6b7280',
    border: '#e5e7eb',
    bgLight: '#fafafa',
    bgPage: '#f5f5f5',
};

// === Helper: load image (CORS-safe) ===
function useHtmlImage(src) {
    const [img, setImg] = useState(null);
    useEffect(() => {
        if (!src) { setImg(null); return; }
        const i = new window.Image();
        i.crossOrigin = 'anonymous';
        i.src = src;
        i.onload = () => setImg(i);
        i.onerror = () => setImg(null);
    }, [src]);
    return img;
}

// === Render label data → image (hidden DOM via html2canvas) ===
function LabelImageRenderer({ labelData, brandAssets, onReady }) {
    const ref = useRef();
    useEffect(() => {
        if (!labelData || !ref.current) return;
        const t = setTimeout(async () => {
            try {
                const canvas = await html2canvas(ref.current, {
                    scale: 2, backgroundColor: null, useCORS: true, logging: false
                });
                onReady(canvas.toDataURL('image/png'));
            } catch (e) { console.error('label render error', e); }
        }, 500);
        return () => clearTimeout(t);
    }, [labelData, brandAssets]);

    if (!labelData) return null;

    const colors = brandAssets?.colors || ['#fff', '#222', '#d3542b', '#777', '#eee'];
    const bgColor = labelData.bg_color || colors[0] || '#fff';
    const textColor = colors[1] || '#222';
    const accent = colors[2] || '#d3542b';
    const sub = colors[3] || '#888';

    return (
        <div style={{ position: 'fixed', left: -99999, top: -99999, pointerEvents: 'none' }}>
            <div ref={ref} style={{
                width: 380, padding: 24, background: bgColor, color: textColor,
                fontFamily: brandAssets?.font || "'Sarabun', sans-serif",
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                borderRadius: 12, boxSizing: 'border-box', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                {brandAssets?.logoUrl && (
                    <img src={brandAssets.logoUrl} crossOrigin="anonymous" alt="logo"
                         style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: 12 }} />
                )}
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
                    {labelData.product_name || 'Product Name'}
                </div>
                {labelData.tagline && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: accent, marginTop: 6 }}>
                        {labelData.tagline}
                    </div>
                )}
                {labelData.net_weight && (
                    <div style={{ fontSize: 11, marginTop: 4, color: sub }}>{labelData.net_weight}</div>
                )}
                {labelData.ingredients && (
                    <div style={{ background: 'rgba(255,255,255,0.6)', padding: 10, borderRadius: 8, fontSize: 11, marginTop: 12, textAlign: 'left', width: '100%', lineHeight: 1.5 }}>
                        <strong>ส่วนประกอบ:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{labelData.ingredients}</div>
                    </div>
                )}
                {labelData.certifications?.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {labelData.certifications.map(c => (
                            <span key={c} style={{ background: accent, color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 999, fontWeight: 'bold' }}>
                                {c}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// === Sticker Editor ===
function StickerEditor({ packageImageUrl, labelImageUrl, onExportPng, onSwitchToAI, isExporting, isAIGen }) {
    const stageRef = useRef();
    const trRef = useRef();
    const [stickerProps, setStickerProps] = useState({ x: 200, y: 200, w: 200, h: 250, rotation: 0 });
    const [selected, setSelected] = useState(true);
    const [stageSize, setStageSize] = useState({ w: 700, h: 700 });

    const pkgImg = useHtmlImage(packageImageUrl);
    const lblImg = useHtmlImage(labelImageUrl);

    useEffect(() => {
        if (pkgImg) {
            const maxSize = 700;
            const ratio = pkgImg.width / pkgImg.height;
            const w = ratio > 1 ? maxSize : maxSize * ratio;
            const h = ratio > 1 ? maxSize / ratio : maxSize;
            setStageSize({ w, h });
            setStickerProps(p => ({ ...p, x: w / 2 - p.w / 2, y: h / 2 - p.h / 2 }));
        }
    }, [pkgImg]);

    useEffect(() => {
        if (lblImg) {
            const aspect = lblImg.height / lblImg.width;
            setStickerProps(p => ({ ...p, h: p.w * aspect }));
        }
    }, [lblImg]);

    useEffect(() => {
        if (selected && trRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#sticker');
            if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        } else if (trRef.current) {
            trRef.current.nodes([]);
        }
    }, [selected, stickerProps]);

    const handleStageClick = (e) => {
        if (e.target === e.target.getStage()) setSelected(false);
    };

    const handleExport = () => {
        if (!stageRef.current) return null;
        if (trRef.current) trRef.current.hide();
        stageRef.current.draw();
        const url = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
        if (trRef.current) trRef.current.show();
        return url;
    };

    return (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 300px', background: '#fff', padding: 20, borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 16px', color: C.primaryDark, fontSize: 18, fontWeight: 700 }}>ติดสติ๊กเกอร์ฉลาก</h3>

                <div style={{ marginBottom: 16, padding: 12, background: C.bgLight, borderRadius: 8, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                    คลิกที่ฉลากแล้วลากเพื่อย้าย ลากที่มุมเพื่อย่อ-ขยาย หรือลากด้านบนเพื่อหมุน
                </div>

                <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>
                        ขนาด: {Math.round(stickerProps.w)} px
                    </label>
                    <input type="range" min="80" max="600" value={stickerProps.w}
                           onChange={e => {
                               const w = parseInt(e.target.value);
                               const aspect = lblImg ? (lblImg.height / lblImg.width) : 1.25;
                               setStickerProps(p => ({ ...p, w, h: w * aspect }));
                           }} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: 'block', marginBottom: 6 }}>
                        หมุน: {Math.round(stickerProps.rotation)}°
                    </label>
                    <input type="range" min="-180" max="180" value={stickerProps.rotation}
                           onChange={e => setStickerProps(p => ({ ...p, rotation: parseInt(e.target.value) }))}
                           style={{ width: '100%' }} />
                </div>

                <button onClick={() => {
                    const aspect = lblImg ? (lblImg.height / lblImg.width) : 1.25;
                    setStickerProps({ x: stageSize.w / 2 - 100, y: stageSize.h / 2 - 125, w: 200, h: 200 * aspect, rotation: 0 });
                    setSelected(true);
                }} style={{
                    width: '100%', padding: 10, background: '#fff', border: `1px solid ${C.border}`,
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16
                }}>
                    <iconify-icon icon="mdi:restore"></iconify-icon>
                    คืนค่าตำแหน่ง
                </button>

                <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '16px 0' }} />

                <button onClick={() => { const url = handleExport(); if (url) onExportPng(url); }}
                        disabled={isExporting} style={{
                    width: '100%', padding: 12, background: C.text, color: '#fff', border: 'none',
                    borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginBottom: 8, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                    <iconify-icon icon="mdi:download"></iconify-icon>
                    {isExporting ? 'กำลังบันทึก...' : 'บันทึกเป็น PNG'}
                </button>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>
                    บันทึกภาพ Mockup จากการประกอบโค้ด ฟรี ไม่ใช้เครดิต
                </div>

                <button onClick={onSwitchToAI} disabled={isAIGen} style={{
                    width: '100%', padding: 12, background: C.primaryDark, color: '#fff', border: 'none',
                    borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                    <iconify-icon icon="mdi:auto-fix"></iconify-icon>
                    สลับไปโหมด AI Mockup
                </button>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
                    AI สร้างภาพ Studio Photography ใช้ DALL-E credit
                </div>
            </div>

            <div style={{ flex: 1, background: C.bgPage, borderRadius: 14, padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 600 }}>
                <Stage ref={stageRef} width={stageSize.w} height={stageSize.h}
                       onMouseDown={handleStageClick} onTouchStart={handleStageClick}
                       style={{ background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', borderRadius: 8 }}>
                    <Layer>
                        {pkgImg && <KImg image={pkgImg} x={0} y={0} width={stageSize.w} height={stageSize.h} listening={false} />}
                        {lblImg && (
                            <KImg image={lblImg} id="sticker"
                                  x={stickerProps.x} y={stickerProps.y}
                                  width={stickerProps.w} height={stickerProps.h}
                                  rotation={stickerProps.rotation} draggable
                                  shadowColor="black" shadowBlur={8} shadowOpacity={0.25}
                                  shadowOffset={{ x: 2, y: 4 }}
                                  onClick={() => setSelected(true)} onTap={() => setSelected(true)}
                                  onDragEnd={e => setStickerProps(p => ({ ...p, x: e.target.x(), y: e.target.y() }))}
                                  onTransformEnd={e => {
                                      const n = e.target;
                                      setStickerProps({
                                          x: n.x(), y: n.y(),
                                          w: Math.max(30, n.width() * n.scaleX()),
                                          h: Math.max(30, n.height() * n.scaleY()),
                                          rotation: n.rotation()
                                      });
                                      n.scaleX(1); n.scaleY(1);
                                  }} />
                        )}
                        <Transformer ref={trRef} rotateEnabled={true}
                                     boundBoxFunc={(oldB, newB) => newB.width < 30 ? oldB : newB} />
                    </Layer>
                </Stage>
            </div>
        </div>
    );
}

// === Mode Selector ===
function ModeSelector({ onPick, onBack, productName }) {
    return (
        <div style={{ padding: 24 }}>
            <button onClick={onBack} style={{
                background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
                marginBottom: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, padding: 0
            }}>
                <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                เลือกสินค้าใหม่
            </button>
            <h2 style={{ color: C.primaryDark, margin: '0 0 8px', fontSize: 22 }}>
                เลือกรูปแบบ Mockup
            </h2>
            <p style={{ color: C.sub, fontSize: 14, marginBottom: 28 }}>
                สำหรับสินค้า "{productName}" — เลือกวิธีที่เหมาะกับงานของคุณ
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                <ModeCard iconName="mdi:sticker-outline" title="ติดสติ๊กเกอร์ฉลาก"
                    desc="วางฉลากที่ออกแบบไว้ลงบนภาพบรรจุภัณฑ์ ปรับตำแหน่ง ขนาด หรือหมุน บันทึกเป็น PNG ฟรี"
                    badge="แนะนำ" badgeColor={C.label} onClick={() => onPick('sticker')} />
                <ModeCard iconName="mdi:auto-fix" title="AI สร้างภาพถ่ายผลิตภัณฑ์"
                    desc="ให้ DALL-E สร้างภาพ Realistic Photography คุณภาพสูง พร้อมฉลากบนสินค้าจริง สำหรับโปรโมต"
                    badge="ใช้ Credit" badgeColor={C.primaryDark} onClick={() => onPick('aimockup')} />
            </div>
        </div>
    );
}

function ModeCard({ iconName, title, desc, badge, badgeColor, onClick }) {
    const [hover, setHover] = useState(false);
    return (
        <button onClick={onClick}
                onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
                style={{
            background: '#fff', border: `2px solid ${hover ? badgeColor : C.border}`, borderRadius: 14, padding: 28,
            textAlign: 'left', cursor: 'pointer', position: 'relative', fontFamily: 'inherit',
            transform: hover ? 'translateY(-2px)' : 'none',
            boxShadow: hover ? '0 12px 32px rgba(0,0,0,0.1)' : '0 4px 16px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease'
        }}>
            <div style={{
                position: 'absolute', top: 14, right: 14, background: badgeColor, color: '#fff',
                padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600
            }}>
                {badge}
            </div>
            <div style={{ fontSize: 36, color: badgeColor, marginBottom: 10 }}>
                <iconify-icon icon={iconName}></iconify-icon>
            </div>
            <h3 style={{ margin: '0 0 8px', color: badgeColor, fontSize: 17 }}>{title}</h3>
            <p style={{ margin: 0, color: C.sub, fontSize: 13, lineHeight: 1.6 }}>{desc}</p>
        </button>
    );
}

// === AI Mockup View ===
function AIMockupView({ packageImageUrl, labelImageUrl, labelData, onGenerate, isGenerating, generatedUrl, onBack }) {
    return (
        <div style={{ padding: 24 }}>
            <button onClick={onBack} style={{
                background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
                marginBottom: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, padding: 0
            }}>
                <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                เปลี่ยนสินค้า / โหมด
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={{ background: '#fff', padding: 20, borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                    <h4 style={{ margin: '0 0 12px', color: C.primaryDark, fontSize: 14, fontWeight: 600 }}>
                        บรรจุภัณฑ์ที่เลือก
                    </h4>
                    {packageImageUrl ? (
                        <img src={packageImageUrl} style={{ width: '100%', borderRadius: 8 }} alt="package" />
                    ) : <div style={{ padding: 40, textAlign: 'center', color: C.border }}>ไม่มีภาพ</div>}
                </div>
                <div style={{ background: '#fff', padding: 20, borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                    <h4 style={{ margin: '0 0 12px', color: C.primaryDark, fontSize: 14, fontWeight: 600 }}>
                        ฉลากที่ออกแบบไว้
                    </h4>
                    {labelImageUrl ? (
                        <img src={labelImageUrl} style={{ width: '100%', borderRadius: 8 }} alt="label" />
                    ) : <div style={{ padding: 40, textAlign: 'center', color: C.border }}>ยังไม่ได้ทำฉลาก</div>}
                </div>
            </div>

            {!generatedUrl ? (
                <div style={{ background: '#fff', padding: 32, borderRadius: 14, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: 48, color: C.primaryDark, marginBottom: 12 }}>
                        <iconify-icon icon="mdi:auto-fix"></iconify-icon>
                    </div>
                    <p style={{ color: C.sub, marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                        AI จะสร้างภาพ Realistic Studio Product Photography โดยใช้ข้อมูลชื่อแบรนด์<br/>
                        ชื่อสินค้า สีแบรนด์ และประเภทบรรจุภัณฑ์
                    </p>
                    <button onClick={onGenerate} disabled={isGenerating} style={{
                        padding: '14px 36px', background: C.primaryDark, color: '#fff', border: 'none',
                        borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 15,
                        display: 'inline-flex', alignItems: 'center', gap: 8
                    }}>
                        <iconify-icon icon="mdi:auto-fix"></iconify-icon>
                        {isGenerating ? 'AI กำลังสร้าง... (20-40 วินาที)' : 'Generate AI Mockup'}
                    </button>
                </div>
            ) : (
                <div style={{ background: '#fff', padding: 24, borderRadius: 14, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ color: C.primaryDark, marginTop: 0 }}>ผลลัพธ์ AI Mockup</h3>
                    <img src={generatedUrl} style={{ maxWidth: '100%', maxHeight: 600, borderRadius: 10, marginTop: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }} alt="ai mockup" />
                    <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <a href={generatedUrl} download={'mockup_ai.png'} style={{
                            padding: '12px 24px', background: C.text, color: '#fff', textDecoration: 'none',
                            borderRadius: 8, fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6
                        }}>
                            <iconify-icon icon="mdi:download"></iconify-icon>
                            ดาวน์โหลด
                        </a>
                        <button onClick={onGenerate} disabled={isGenerating} style={{
                            padding: '12px 24px', background: C.primaryDark, color: '#fff', border: 'none',
                            borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14,
                            display: 'inline-flex', alignItems: 'center', gap: 6
                        }}>
                            <iconify-icon icon="mdi:refresh"></iconify-icon>
                            สร้างใหม่
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
// === Mini Label Preview (static HTML, no html2canvas) สำหรับ thumbnail ===
function MiniLabelPreview({ labelData, brandAssets }) {
    if (!labelData) return null;
    const colors = brandAssets?.colors || ['#fff', '#222', '#d3542b'];
    const bgColor = labelData.bg_color || colors[0] || '#fff';
    const textColor = colors[1] || '#222';
    const accent = colors[2] || '#d3542b';

    return (
        <div style={{
            width: '100%', height: '100%', background: bgColor, color: textColor,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 6, boxSizing: 'border-box', overflow: 'hidden',
            fontFamily: brandAssets?.font || "'Sarabun', sans-serif"
        }}>
            {brandAssets?.logoUrl && (
                <img src={brandAssets.logoUrl} alt="logo" crossOrigin="anonymous"
                     style={{ width: 28, height: 28, objectFit: 'contain', marginBottom: 4 }}
                     onError={e => e.target.style.display = 'none'} />
            )}
            <div style={{ fontSize: 10, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {labelData.product_name || ''}
            </div>
            {labelData.tagline && (
                <div style={{ fontSize: 7, color: accent, marginTop: 2, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {labelData.tagline}
                </div>
            )}
        </div>
    );
}
// === Product Card ===
function ProductCard({ product, brandAssets, onSelect }) {
    const [pkgImg, setPkgImg] = useState(null);
    const [labelData, setLabelData] = useState(null);
    const [hover, setHover] = useState(false);

    useEffect(() => {
        // โหลดภาพบรรจุภัณฑ์
        const matId = product.materials?.[0]?.id;
        if (matId) {
            fetch(`${API}/api/mockup/material/${matId}`)
                .then(r => r.json())
                .then(d => {
                    if (d.status === 'success' && d.data.images?.length > 0) {
                        setPkgImg(d.data.images[0].image_path);
                    }
                })
                .catch(e => console.warn('fetch material error', e));
        }

        // โหลดฉลากของสินค้านี้ (per product)
        fetch(`${API}/api/labels/product/${product.product_id}`)
            .then(r => r.json())
            .then(d => {
                if (d.status === 'success' && d.data) {
                    setLabelData(d.data);
                    console.log(`[Mockup] Label for product ${product.product_id}:`, d.data.product_name);
                } else {
                    console.log(`[Mockup] No label for product ${product.product_id}`);
                }
            })
            .catch(e => console.warn('fetch label error', e));
    }, [product.product_id]);

    const productImg = product.image_product ? `${API}/uploads/${product.image_product}` : null;
    const hasLabel = !!labelData;

    let buttonText, buttonColor, buttonIcon, statusType;
    if (!product.has_package) {
        buttonText = 'ไปเลือกบรรจุภัณฑ์'; buttonColor = C.accent;
        buttonIcon = 'mdi:package-variant-closed'; statusType = 'no_package';
    } else if (!hasLabel) {
        buttonText = 'ไปออกแบบฉลาก'; buttonColor = C.label;
        buttonIcon = 'mdi:tag-outline'; statusType = 'no_label';
    } else {
        buttonText = 'เริ่มทำ Mockup'; buttonColor = C.primaryDark;
        buttonIcon = 'mdi:image-edit-outline'; statusType = 'ready';
    }

    return (
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
            background: '#fff', borderRadius: 16, overflow: 'hidden',
            boxShadow: hover ? '0 12px 32px rgba(0,0,0,0.1)' : '0 4px 16px rgba(0,0,0,0.06)',
            border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
            transform: hover ? 'translateY(-3px)' : 'none', transition: 'all 0.2s ease'
        }}>
            <div style={{
                position: 'relative', height: 240,
                background: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
                {productImg ? (
                    <img src={productImg} alt={product.name_product}
                         style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                         onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                    <div style={{ color: C.border, fontSize: 64 }}>
                        <iconify-icon icon="mdi:image-outline"></iconify-icon>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex', gap: 10, padding: '14px 16px',
                background: C.bgLight, borderTop: `1px solid ${C.border}`
            }}>
                {/* Package thumbnail */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        width: '100%', aspectRatio: '1', background: '#fff',
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        {pkgImg ? (
                            <img src={pkgImg} alt="package" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ color: C.border, fontSize: 28 }}>
                                <iconify-icon icon="mdi:package-variant-closed"></iconify-icon>
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 4 }}>บรรจุภัณฑ์</div>
                </div>

                {/* Label thumbnail (mini preview) */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        width: '100%', aspectRatio: '1', background: '#fff',
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        {hasLabel ? (
                            <MiniLabelPreview labelData={labelData} brandAssets={brandAssets} />
                        ) : (
                            <div style={{ color: C.border, fontSize: 28 }}>
                                <iconify-icon icon="mdi:tag-outline"></iconify-icon>
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 4 }}>ฉลาก</div>
                </div>
            </div>

            <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>
                    {product.name_product}
                </div>
                {product.type_product && (
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
                        ประเภท: {product.type_product}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    <StatusLine ok={product.has_package} okText={`บรรจุภัณฑ์: ${product.name_package || ''}`}
                                noText="ยังไม่ได้เลือกบรรจุภัณฑ์" />
                    <StatusLine ok={hasLabel} okText={`ฉลาก: ${labelData?.product_name || 'ออกแบบแล้ว'}`}
                                noText="ยังไม่ได้ออกแบบฉลาก" />
                </div>

                <button onClick={() => onSelect(statusType, labelData)} style={{
                    marginTop: 'auto', padding: '12px 16px',
                    background: buttonColor, color: '#fff', border: 'none', borderRadius: 8,
                    fontWeight: 600, cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                    <iconify-icon icon={buttonIcon}></iconify-icon>
                    {buttonText}
                </button>
            </div>
        </div>
    );
}

function Thumbnail({ label, image, fallbackIcon, hasContent }) {
    return (
        <div style={{ flex: 1 }}>
            <div style={{
                width: '100%', aspectRatio: '1',
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                position: 'relative'
            }}>
                {image ? (
                    <img src={image} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                    <div style={{ color: C.border, fontSize: 28 }}>
                        <iconify-icon icon={fallbackIcon}></iconify-icon>
                    </div>
                )}
            </div>
            <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 4 }}>{label}</div>
        </div>
    );
}

function StatusLine({ ok, okText, noText }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: ok ? '#5a7020' : '#9a5e15'
        }}>
            <iconify-icon icon={ok ? "mdi:check-circle" : "mdi:alert-circle-outline"}
                          style={{ fontSize: 14 }}></iconify-icon>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ok ? okText : noText}
            </span>
        </div>
    );
}

// === Product Picker ===
function ProductPickerView({ products, isLoading, brandAssets, onSelectProduct, onRefresh }) {
    if (isLoading) return (
        <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>กำลังโหลดสินค้า...</div>
    );
    if (!products || products.length === 0) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>
                <div style={{ fontSize: 48, marginBottom: 12, color: C.border }}>
                    <iconify-icon icon="mdi:package-variant-closed-remove"></iconify-icon>
                </div>
                ยังไม่มีสินค้าในโปรเจกต์นี้ กรุณาเพิ่มสินค้าก่อน
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: '0 0 6px', color: C.primaryDark, fontSize: 22, fontWeight: 700 }}>
                        เลือกสินค้าที่ต้องการทำ Mockup
                    </h2>
                    <p style={{ margin: 0, color: C.sub, fontSize: 14 }}>
                        แต่ละสินค้ามีฉลากของตัวเอง — เลือกสินค้าที่มีบรรจุภัณฑ์และฉลากครบเพื่อทำภาพ Mockup
                    </p>
                </div>
                <button onClick={onRefresh} style={{
                    padding: '8px 14px', background: '#fff', border: `1px solid ${C.border}`,
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.text,
                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, whiteSpace: 'nowrap'
                }}>
                    <iconify-icon icon="mdi:refresh"></iconify-icon>
                    รีเฟรชข้อมูล
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {products.map(p => (
                    <ProductCard key={p.product_id} product={p}
                                 brandAssets={brandAssets}
                                 onSelect={(statusType, labelData) => onSelectProduct(p, statusType, labelData)} />
                ))}
            </div>
        </div>
    );
}

// === MAIN ===
export default function MockupEditor({ projectId, userId, projectName, onNavigateToPackage, onNavigateToLabel }) {
    const [view, setView] = useState('picker');
    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [brandAssets, setBrandAssets] = useState(null);
    const [selectedLabelData, setSelectedLabelData] = useState(null);  // 👈 ใหม่: label ของสินค้าที่เลือก
    const [labelImageUrl, setLabelImageUrl] = useState(null);
    const [packageImageUrl, setPackageImageUrl] = useState(null);

    const [isExporting, setIsExporting] = useState(false);
    const [isAIGen, setIsAIGen] = useState(false);
    const [aiMockupUrl, setAiMockupUrl] = useState(null);

    useEffect(() => {
        fetchProducts();
        fetchBrandAssets();
    }, [projectId]);

    const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const res = await fetch(`${API}/api/mockup/products-status/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProducts(data.data);
        } catch (err) { console.error(err); }
        finally { setIsLoadingProducts(false); }
    };

    // ดึงเฉพาะ brand assets — ไม่ดึง label เพราะ label ผูกกับ product แต่ละตัว
    const fetchBrandAssets = async () => {
        try {
            const projRes = await fetch(`${API}/api/projects/detail/${projectId}`);
            const proj = await projRes.json();
            const logo = proj.project?.image_logo ? `${API}${proj.project.image_logo}` : '';

            const aRes = await fetch(`${API}/api/projects/${projectId}/selected-assets`);
            const a = await aRes.json();
            const colors = a.color
                ? [a.color.color_code_1, a.color.color_code_2, a.color.color_code_3, a.color.color_code_4, a.color.color_code_5].filter(Boolean)
                : ['#fff', '#222', '#d3542b', '#777', '#eee'];
            const font = a.font ? `'${a.font.font_name}', sans-serif` : "'Sarabun', sans-serif";
            setBrandAssets({ logoUrl: logo, font, colors });
        } catch (err) {
            console.error('[Mockup] Brand assets fetch error:', err);
        }
    };

    const handleRefresh = async () => {
        setSelectedLabelData(null);
        setLabelImageUrl(null);
        await fetchProducts();
        await fetchBrandAssets();
    };

    const handleSelectProduct = async (product, statusType, labelData) => {
        if (statusType === 'no_package') {
            if (typeof onNavigateToPackage === 'function') onNavigateToPackage();
            else alert('กรุณาไปที่แท็บ Package เพื่อเลือกบรรจุภัณฑ์ก่อน');
            return;
        }
        if (statusType === 'no_label') {
            if (typeof onNavigateToLabel === 'function') onNavigateToLabel();
            else alert('กรุณาไปที่แท็บ Label เพื่อออกแบบฉลากก่อน');
            return;
        }

        setSelectedProduct(product);
        setSelectedLabelData(labelData);  // ใช้ label ที่ ProductCard fetch มาแล้ว
        console.log('[Mockup] Selected product:', product.name_product, 'with label:', labelData?.product_name);

        const matId = product.materials?.[0]?.id;
        if (matId) {
            try {
                const r = await fetch(`${API}/api/mockup/material/${matId}`);
                const d = await r.json();
                if (d.status === 'success' && d.data.images?.length > 0) {
                    setPackageImageUrl(d.data.images[0].image_path);
                }
            } catch (e) { console.error(e); }
        }
        setView('mode');
    };

    const handlePickMode = (m) => setView(m);
    const handleBackToPicker = () => {
        setView('picker'); setSelectedProduct(null);
        setSelectedLabelData(null); setLabelImageUrl(null);
        setPackageImageUrl(null); setAiMockupUrl(null);
        fetchProducts();
    };
    const handleBackToMode = () => { setView('mode'); setAiMockupUrl(null); };

    const handleExportPng = (dataUrl) => {
        if (!dataUrl) return;
        setIsExporting(true);
        try {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `mockup_${selectedProduct?.name_product || 'design'}.png`;
            link.click();
        } finally { setIsExporting(false); }
    };

    const handleAIMockup = async () => {
        if (!selectedProduct) return;
        setIsAIGen(true);
        setAiMockupUrl(null);
        try {
            const res = await fetch(`${API}/api/mockup/generate-ai-image`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    user_id: userId,
                    product_id: selectedProduct.product_id,
                    package_name: selectedProduct.name_package,
                    package_material: selectedProduct.materials?.[0]?.material_name || '',
                    label_data: {
                        product_name: selectedLabelData?.product_name || selectedProduct.name_product,
                        tagline: selectedLabelData?.tagline,
                        colors: brandAssets?.colors?.slice(0, 3).join(', ') || ''
                    },
                    project_name: projectName
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setAiMockupUrl(`${API}${data.image_url}`);
            } else alert('AI สร้างไม่สำเร็จ: ' + data.message);
        } catch (err) { alert('Error: ' + err.message); }
        finally { setIsAIGen(false); }
    };

    return (
        <>
            {/* Render label เป็น image เฉพาะ label ของสินค้าที่เลือก */}
            {selectedLabelData && brandAssets && (
                <LabelImageRenderer labelData={selectedLabelData} brandAssets={brandAssets} onReady={setLabelImageUrl} />
            )}

            {view === 'picker' && (
                <ProductPickerView
                    products={products} isLoading={isLoadingProducts}
                    brandAssets={brandAssets}
                    onSelectProduct={handleSelectProduct}
                    onRefresh={handleRefresh}
                />
            )}

            {view === 'mode' && selectedProduct && (
                <ModeSelector onPick={handlePickMode} onBack={handleBackToPicker}
                              productName={selectedProduct.name_product} />
            )}

            {view === 'sticker' && (
                <div style={{ padding: 24 }}>
                    <button onClick={handleBackToMode} style={{
                        background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
                        marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, padding: 0
                    }}>
                        <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                        กลับไปเลือกโหมด
                    </button>
                    {packageImageUrl && labelImageUrl ? (
                        <StickerEditor
                            packageImageUrl={packageImageUrl}
                            labelImageUrl={labelImageUrl}
                            onExportPng={handleExportPng}
                            onSwitchToAI={() => setView('aimockup')}
                            isExporting={isExporting} isAIGen={isAIGen}
                        />
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>
                            กำลังเตรียม Preview... {!packageImageUrl && '(โหลดภาพบรรจุภัณฑ์)'} {!labelImageUrl && '(เรนเดอร์ฉลาก)'}
                        </div>
                    )}
                </div>
            )}

            {view === 'aimockup' && (
                <AIMockupView
                    packageImageUrl={packageImageUrl}
                    labelImageUrl={labelImageUrl}
                    labelData={selectedLabelData}
                    onGenerate={handleAIMockup}
                    isGenerating={isAIGen}
                    generatedUrl={aiMockupUrl}
                    onBack={handleBackToMode}
                />
            )}
        </>
    );
}
