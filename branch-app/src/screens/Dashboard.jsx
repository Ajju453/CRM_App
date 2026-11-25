import { useEffect, useState } from 'react';
import { formatRupees } from '../api.js';

export default function Dashboard({ call, branchName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString() ? `?${params.toString()}` : '';
    call(`/dashboard${query}`)
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [call, from, to, reloadKey]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading...</p>;

  return (
    <section>
      <div className="row date-filter">
        <label className="grow">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="grow">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <h2>Overview</h2>
      <div className="cards">
        <Card label="Total Members" value={data.totalMembers} />
        <Card label="Total Bills" value={data.totalBills} />
        <Card label="Total Purchase Value" value={formatRupees(data.totalSales)} />
        <Card label="Active Branch" value={branchName || '-'} />
      </div>

      <h2>Monthly sales</h2>
      {data.monthly.length === 0 ? (
        <p className="muted">No bills yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Bills</th>
              <th className="num">Sales</th>
            </tr>
          </thead>
          <tbody>
            {data.monthly.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td className="num">{row.totalBills}</td>
                <td className="num">{formatRupees(row.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row between">
        <h2>Purchase History</h2>
        <button type="button" className="secondary small" onClick={() => setReloadKey((k) => k + 1)}>
          Refresh Data
        </button>
      </div>
      {data.history.length === 0 ? (
        <p className="muted">No purchases in this period.</p>
      ) : (
        groupByMonth(data.history).map(([month, rows]) => (
          <div key={month} className="month-group">
            <h3>{month}</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Phone</th>
                    <th>Site</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="num">{index + 1}</td>
                      <td>{row.billDate}{row.billTime ? ` ${row.billTime}` : ''}</td>
                      <td>{row.memberName}</td>
                      <td>{row.memberPhone}</td>
                      <td>{row.site || '-'}</td>
                      <td className="num">{formatRupees(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function groupByMonth(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.billDate.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()];
}

function Card({ label, value }) {
  return (
    <div className="card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
