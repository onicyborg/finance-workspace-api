export function generateMonthlyReportHtml(report: any): string {
  const { workspace, period, summary, byCategory, byAccount, byTransfer, daily } = report;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const netColor = summary.netCashflow >= 0 ? '#16a34a' : '#dc2626';

  // Tanggal awal & akhir bulan
  const startDateStr = formatDate(period.startDate);
  const endDateStr = formatDate(period.endDate);

  // ── BY CATEGORY ROWS ──
  const byCategoryRows = byCategory
    .map((item: any) => {
      const badge =
        item.type === 'INCOME'
          ? `<span class="badge badge-income">Income</span>`
          : `<span class="badge badge-expense">Expense</span>`;

      const budgetHtml =
        item.budget && item.type === 'EXPENSE'
          ? `
            <div class="budget-bar-wrap">
              <div class="budget-bar">
                <div class="budget-bar-fill ${item.budget.isOverBudget ? 'over' : ''}"
                  style="width: ${Math.min(item.budget.percentUsed, 100)}%"></div>
              </div>
              <span class="budget-label">
                ${item.budget.percentUsed}% dari ${formatCurrency(item.budget.budgetAmount)}
                ${item.budget.isOverBudget ? '⚠️ Melebihi budget' : ''}
              </span>
            </div>`
          : `<span class="no-budget">—</span>`;

      return `
        <tr>
          <td>
            <div class="category-name">
              ${item.category.icon ? `<span>${item.category.icon}</span>` : ''}
              ${item.category.name}
            </div>
          </td>
          <td>${badge}</td>
          <td class="text-right">${formatCurrency(item.total)}</td>
          <td class="text-right">${item.percentage}%</td>
          <td>${budgetHtml}</td>
        </tr>`;
    })
    .join('') || `<tr><td colspan="5" class="empty">Tidak ada data</td></tr>`;

  // ── BY ACCOUNT ROWS ──
  const byAccountRows = byAccount
    .map(
      (item: any) => `
      <tr>
        <td>${item.account.name}</td>
        <td>${item.account.type}</td>
        <td class="text-right income">${formatCurrency(item.totalIncome)}</td>
        <td class="text-right expense">${formatCurrency(item.totalExpense)}</td>
        <td class="text-right">${formatCurrency(item.totalIncome - item.totalExpense)}</td>
      </tr>`,
    )
    .join('') || `<tr><td colspan="5" class="empty">Tidak ada data</td></tr>`;

  // ── TRANSFER ROWS ──
  const transferRows = byTransfer
    .map(
      (t: any) => `
      <tr>
        <td>${new Date(t.transactionDate).toLocaleDateString('id-ID')}</td>
        <td>${t.fromAccount?.name ?? '—'}</td>
        <td style="text-align:center">→</td>
        <td>${t.toAccount?.name ?? '—'}</td>
        <td class="text-right">${formatCurrency(t.amount)}</td>
        <td>${t.description ?? '—'}</td>
      </tr>`,
    )
    .join('') || `<tr><td colspan="6" class="empty">Tidak ada transfer</td></tr>`;

  // ── DAILY ROWS ──
  const dailyRows = daily
    .filter((d: any) => d.totalIncome > 0 || d.totalExpense > 0 || d.totalTransfer > 0)
    .map(
      (d: any) => `
      <tr>
        <td>${d.date}</td>
        <td class="text-right income">${formatCurrency(d.totalIncome)}</td>
        <td class="text-right expense">${formatCurrency(d.totalExpense)}</td>
        <td class="text-right" style="color:#3b82f6">${formatCurrency(d.totalTransfer)}</td>
        <td class="text-right" style="color:${d.totalIncome - d.totalExpense >= 0 ? '#16a34a' : '#dc2626'}">
          ${formatCurrency(d.totalIncome - d.totalExpense)}
        </td>
      </tr>`,
    )
    .join('') || `<tr><td colspan="5" class="empty">Tidak ada transaksi</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
    }

    .header {
      background: #0f172a;
      color: white;
      padding: 28px 32px;
      margin-bottom: 28px;
    }

    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 12px; color: #94a3b8; }

    .section { margin-bottom: 32px; padding: 0 32px; }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
    }

    /* SUMMARY CARDS */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }

    .summary-grid-bottom {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }

    .card-label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-value { font-size: 17px; font-weight: 700; }
    .card-value.income { color: #16a34a; }
    .card-value.expense { color: #dc2626; }
    .card-value.transfer { color: #3b82f6; }

    /* TABLE */
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 8px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
    }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }

    .text-right { text-align: right; }
    .income { color: #16a34a; }
    .expense { color: #dc2626; }
    .empty { text-align: center; color: #94a3b8; padding: 20px; }

    /* BADGE */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge-income { background: #dcfce7; color: #16a34a; }
    .badge-expense { background: #fee2e2; color: #dc2626; }

    /* BUDGET BAR */
    .budget-bar-wrap { display: flex; flex-direction: column; gap: 3px; }
    .budget-bar {
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      width: 120px;
    }
    .budget-bar-fill { height: 100%; background: #3b82f6; border-radius: 999px; }
    .budget-bar-fill.over { background: #dc2626; }
    .budget-label { font-size: 10px; color: #64748b; }
    .no-budget { color: #cbd5e1; }
    .category-name { display: flex; align-items: center; gap: 6px; }

    .footer {
      margin-top: 40px;
      padding: 16px 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <h1>Monthly Report · ${workspace.name}</h1>
    <p>Periode ${startDateStr} - ${endDateStr} · Tahun ${period.year}</p>
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
        <div class="card-value" style="color: ${netColor}">${formatCurrency(summary.netCashflow)}</div>
      </div>
    </div>
    <div class="summary-grid-bottom">
      <div class="card">
        <div class="card-label">Total Transfer</div>
        <div class="card-value transfer">${formatCurrency(summary.totalTransfer)}</div>
      </div>
      <div class="card">
        <div class="card-label">Jumlah Transaksi Transfer</div>
        <div class="card-value">${summary.totalTransferCount}x</div>
      </div>
    </div>
  </div>

  <!-- BY CATEGORY -->
  <div class="section">
    <div class="section-title">Breakdown per Kategori</div>
    <table>
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Tipe</th>
          <th class="text-right">Total</th>
          <th class="text-right">%</th>
          <th>Budget</th>
        </tr>
      </thead>
      <tbody>${byCategoryRows}</tbody>
    </table>
  </div>

  <!-- BY ACCOUNT -->
  <div class="section">
    <div class="section-title">Breakdown per Akun</div>
    <table>
      <thead>
        <tr>
          <th>Akun</th>
          <th>Tipe</th>
          <th class="text-right">Pemasukan</th>
          <th class="text-right">Pengeluaran</th>
          <th class="text-right">Net</th>
        </tr>
      </thead>
      <tbody>${byAccountRows}</tbody>
    </table>
  </div>

  <!-- TRANSFERS -->
  <div class="section">
    <div class="section-title">Riwayat Transfer</div>
    <table>
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Dari</th>
          <th></th>
          <th>Ke</th>
          <th class="text-right">Jumlah</th>
          <th>Keterangan</th>
        </tr>
      </thead>
      <tbody>${transferRows}</tbody>
    </table>
  </div>

  <!-- DAILY -->
  <div class="section">
    <div class="section-title">Transaksi Harian</div>
    <table>
      <thead>
        <tr>
          <th>Tanggal</th>
          <th class="text-right">Pemasukan</th>
          <th class="text-right">Pengeluaran</th>
          <th class="text-right">Transfer</th>
          <th class="text-right">Net</th>
        </tr>
      </thead>
      <tbody>${dailyRows}</tbody>
    </table>
  </div>

  <div class="footer">
    Digenerate pada ${new Date().toLocaleString('id-ID')} · Finance Workspace
  </div>

</body>
</html>`;
}