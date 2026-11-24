import { useEffect, useState } from 'react';
import Table from './Table.jsx';
import { formatRupees } from './format.js';

export default function Leaderboard({ call }) {
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ limit: '25' });
    if (period.from) params.set('from', period.from);
    if (period.to) params.set('to', period.to);
    let active = true;
    call(`/leaderboard?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoadError('');
      })
      .catch((err) => {
        if (active) setLoadError(err.message);
      });
    return () => {
      active = false;
    };
  }, [call, period.from, period.to]);

  return (
    <section>
      <h1 className="adm-heading">Leaderboard</h1>
      <p className="adm-muted">Member total sales across all showrooms</p>

      <div className="adm-form">
        <label className="adm-label">
          From
          <input
            className="adm-input"
            type="date"
            value={period.from}
            onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
          />
        </label>
        <label className="adm-label">
          To
          <input
            className="adm-input"
            type="date"
            value={period.to}
            onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
          />
        </label>
      </div>

      {loadError && (
        <p className="adm-alert" role="alert">
          {loadError}
        </p>
      )}
      {!data && !loadError && <p className="adm-muted">Loading...</p>}

      {data && (
        <>
          <div className="adm-stats">
            {data.tiers.map((tier) => (
              <div className="adm-card" key={tier.id}>
                <div className="adm-subhead">{tier.name}</div>
                <div className="adm-muted">From {formatRupees(tier.threshold)}</div>
                <div className="adm-stat-value">{data.eligibility[tier.id] ?? 0}</div>
                <div className="adm-muted">members qualified</div>
              </div>
            ))}
          </div>

          <Table
            head={[
              { label: 'Sr no' },
              { label: 'Member' },
              { label: 'Phone' },
              { label: 'Showroom' },
              { label: 'Trip' },
              { label: 'Total sales', right: true },
            ]}
            rows={data.top.map((row, index) => ({
              key: row.memberId,
              cells: [
                index + 1,
                row.name,
                <span className="adm-mono">{row.phone}</span>,
                row.branchName,
                row.tier ? row.tier.name : '-',
                formatRupees(row.totalSales),
              ],
            }))}
            empty="No sales in this period."
          />
        </>
      )}
    </section>
  );
}
