import { useEffect, useState } from 'react';

function formatRupees(amount) {
  return `\u20B9${Number(amount || 0).toLocaleString('en-IN')}`;
}

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-500">Member total sales across all showrooms</p>
        </div>
        <div className="flex gap-3">
          <label className="block">
            <span className="label">From</span>
            <input
              className="input"
              type="date"
              value={period.from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="label">To</span>
            <input
              className="input"
              type="date"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            />
          </label>
        </div>
      </div>

      {loadError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700" role="alert">
          {loadError}
        </p>
      )}

      {!data && !loadError && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {data.tiers.map((tier) => (
              <div key={tier.id} className="card">
                <div className="text-sm font-semibold">{tier.name}</div>
                <div className="text-xs text-slate-500">From {formatRupees(tier.threshold)}</div>
                <div className="mt-2 text-2xl font-semibold">{data.eligibility[tier.id] ?? 0}</div>
                <div className="text-xs text-slate-500">members qualified</div>
              </div>
            ))}
          </div>

          <div className="card mt-6 p-0">
            {data.top.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No sales in this period.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Sr no</th>
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Showroom</th>
                    <th className="px-5 py-3 font-medium">Trip</th>
                    <th className="px-5 py-3 text-right font-medium">Total sales</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((row, index) => (
                    <tr key={row.memberId} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3">{index + 1}</td>
                      <td className="px-5 py-3 font-medium">{row.name}</td>
                      <td className="px-5 py-3 font-mono">{row.phone}</td>
                      <td className="px-5 py-3">{row.branchName}</td>
                      <td className="px-5 py-3">{row.tier ? row.tier.name : '-'}</td>
                      <td className="px-5 py-3 text-right">{formatRupees(row.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
