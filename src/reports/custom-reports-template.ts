export function generateCustomReportHtml(report: any): string {
  const { workspace, filters, summary, groups } = report;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const groupByLabel: Record<string, string> = {
    day: 'Harian',
    week: 'Mingguan',
    month: 'Bulanan',
    category: 'Kategori',
    account: 'Akun',
  };

  const netColor = summary.netCashflow >= 0 ? '#16a34a' : '#dc2626';

  // ── GROUP ROWS ──
  const isTimeseries = ['day', 'week', 'month'].includes(filters.groupBy);

  const groupRows = groups
    .map((g: any) => {
      if (filters.groupBy === 'category') {
        const badge =
          g.type === 'INCOME'
            ? `<span class="badge badge-income">Income</span>`
            : g.type === 'EXPENSE'
              ? `<span class="badge badge-expense">Expense</span>`
              : `<span class="badge badge-transfer">Transfer</span>`;

        return `
          <tr>
            <td>${g.label}</td>
            <td>${badge}</td>
            <td class="text-right">${formatCurrency(g.total)}</td>
            <td class="text-right">${g.percentage}%</td>
            <td class="text-right">${g.count}x</td>
          </tr>`;
      }

      if (filters.groupBy === 'account') {
        return `
          <tr>
            <td>${g.label}</td>
            <td>${g.accountType}</td>
            <td class="text-right income">${formatCurrency(g.totalIncome)}</td>
            <td class="text-right expense">${formatCurrency(g.totalExpense)}</td>
            <td class="text-right" style="color:#3b82f6">${formatCurrency(g.totalTransfer)}</td>
            <td class="text-right">${formatCurrency(g.totalIncome - g.totalExpense)}</td>
          </tr>`;
      }

      // timeseries: day/week/month
      return `
        <tr>
          <td>${g.label}</td>
          <td class="text-right income">${formatCurrency(g.totalIncome)}</td>
          <td class="text-right expense">${formatCurrency(g.totalExpense)}</td>
          <td class="text-right" style="color:#3b82f6">${formatCurrency(g.totalTransfer)}</td>
          <td class="text-right" style="color:${g.totalIncome - g.totalExpense >= 0 ? '#16a34a' : '#dc2626'}">
            ${formatCurrency(g.totalIncome - g.totalExpense)}
          </td>
        </tr>`;
    })
    .join('') || `<tr><td colspan="6" class="empty">Tidak ada data</td></tr>`;

  // ── TABLE HEADERS ──
  let tableHeaders = '';
  if (filters.groupBy === 'category') {
    tableHeaders = `
      <th>Kategori</th>
      <th>Tipe</th>
      <th class="text-right">Total</th>
      <th class="text-right">%</th>
      <th class="text-right">Jumlah Transaksi</th>`;
  } else if (filters.groupBy === 'account') {
    tableHeaders = `
      <th>Akun</th>
      <th>Tipe Akun</th>
      <th class="text-right">Pemasukan</th>
      <th class="text-right">Pengeluaran</th>
      <th class="text-right">Transfer</th>
      <th class="text-right">Net</th>`;
  } else {
    tableHeaders = `
      <th>Periode</th>
      <th class="text-right">Pemasukan</th>
      <th class="text-right">Pengeluaran</th>
      <th class="text-right">Transfer</th>
      <th class="text-right">Net</th>`;
  }

  // ── FILTER SUMMARY ──
  const activeFilters = [
    `Periode: ${formatDate(filters.from)} - ${formatDate(filters.to)}`,
    filters.types?.length
      ? `Tipe: ${filters.types.join(', ')}`
      : 'Tipe: Semua',
    `Group by: ${groupByLabel[filters.groupBy] ?? filters.groupBy}`,
  ].join(' · ');

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }

    .header { background: #0f172a; color: white; padding: 28px 32px; margin-bottom: 28px; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 12px; color: #94a3b8; }

    .section { margin-bottom: 32px; padding: 0 32px; }
    .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }

    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .card-label { font-size: 11px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 17px; font-weight: 700; }
    .card-value.income { color: #16a34a; }
    .card-value.expense { color: #dc2626; }

    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }

    .text-right { text-align: right; }
    .income { color: #16a34a; }
    .expense { color: #dc2626; }
    .empty { text-align: center; color: #94a3b8; padding: 20px; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
    .badge-income { background: #dcfce7; color: #16a34a; }
    .badge-expense { background: #fee2e2; color: #dc2626; }
    .badge-transfer { background: #dbeafe; color: #3b82f6; }

    .filter-bar { background: #f1f5f9; border-radius: 8px; padding: 10px 16px; font-size: 11px; color: #64748b; margin-bottom: 20px; }

    .footer { margin-top: 40px; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>

  <div class="header">
    <h1>Custom Report · ${workspace.name}</h1>
    <p>${formatDate(filters.from)} - ${formatDate(filters.to)} · Tahun ${new Date(filters.to).getFullYear()}</p>
  </div>

  <!-- FILTER INFO -->
  <div class="section">
    <div class="filter-bar">${activeFilters}</div>
  </div>

  <!-- SUMMARY -->
  <div class="section">
    <div class="section-title">Ringkasan</div>
    <div class="summary-grid">
      <div class="card">
        <div class="card-label">Total Pemasukan</div>
        <div class="card-value income">${formatCurrency(summary.totalIncome)}</div>
      </div>
      <div class="card">
        <div class="card-label">Total Pengeluaran</div>
        <div class="card-value expense">${formatCurrency(summary.totalExpense)}</div>
      </div>
      <div class="card">
        <div class="card-label">Net Cashflow</div>
        <div class="card-value" style="color:${netColor}">${formatCurrency(summary.netCashflow)}</div>
      </div>
    </div>
  </div>

  <!-- GROUP DATA -->
  <div class="section">
    <div class="section-title">Detail per ${groupByLabel[filters.groupBy] ?? filters.groupBy}</div>
    <table>
      <thead><tr>${tableHeaders}</tr></thead>
      <tbody>${groupRows}</tbody>
    </table>
  </div>

  <div class="footer">
    Digenerate pada ${new Date().toLocaleString('id-ID')} · Finance Workspace
  </div>

</body>
</html>`;
}