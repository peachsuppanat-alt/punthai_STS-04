import React, { useState } from 'react';
import styles from './DataTable.module.css';

export default function DataTable({
  title,
  columns,
  data = [],
  searchPlaceholder = 'ค้นหา...',
  onSearch,
  pagination,
  onPageChange,
  extra,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [localSearch, setLocalSearch] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  let displayData = [...data];
  if (sortKey) {
    displayData.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }

  if (!onSearch && localSearch) {
    const q = localSearch.toLowerCase();
    displayData = displayData.filter((row) =>
      columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q))
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;
  const currentPage = pagination?.page || 1;

  const renderPageButtons = () => {
    const pages = [];
    const maxShow = 5;
    let start = Math.max(1, currentPage - Math.floor(maxShow / 2));
    let end = Math.min(totalPages, start + maxShow - 1);
    if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);

    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          className={`${styles.pageBtn} ${i === currentPage ? styles.pageBtnActive : ''}`}
          onClick={() => onPageChange?.(i)}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <h3 className={styles.title}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {extra}
          <input
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            value={onSearch ? undefined : localSearch}
            onChange={(e) => {
              if (onSearch) {
                onSearch(e.target.value);
              } else {
                setLocalSearch(e.target.value);
              }
            }}
          />
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? styles.sortable : ''}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className={styles.sortIcon}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              displayData.map((row, idx) => (
                <tr key={row.id || row.key || idx}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            แสดง {(currentPage - 1) * pagination.limit + 1}–
            {Math.min(currentPage * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
          </span>
          <div className={styles.pageButtons}>
            <button
              className={styles.pageBtn}
              disabled={currentPage <= 1}
              onClick={() => onPageChange?.(currentPage - 1)}
            >
              ก่อนหน้า
            </button>
            {renderPageButtons()}
            <button
              className={styles.pageBtn}
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange?.(currentPage + 1)}
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Badge({ type, children }) {
  const cls = {
    success: styles.badgeSuccess,
    danger: styles.badgeDanger,
    warning: styles.badgeWarning,
    info: styles.badgeInfo,
  };
  return <span className={`${styles.badge} ${cls[type] || ''}`}>{children}</span>;
}
