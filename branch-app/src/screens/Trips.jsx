import { useEffect, useState } from 'react';
import { formatRupees } from '../api.js';

export default function Trips({ call }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    call('/leaderboard')
      .then((res) => {
        setData(res);
        setLoadError('');
      })
      .catch((err) => setLoadError(err.message));
  }, [call]);

  if (loadError) {
    return (
      <section>
        <h2>Trip Eligibility</h2>
        <p className="error" role="alert">{loadError}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section>
        <h2>Trip Eligibility</h2>
        <p className="muted">Loading...</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Trip Eligibility</h2>
      {data.tiers.map((tier) => {
        const rows = data.qualifiers[tier.id] || [];
        return (
          <div key={tier.id} className="month-group">
            <div className="row between">
              <h3>{tier.name}</h3>
              <span className="small-text muted">
                {formatRupees(tier.threshold)} and above · {rows.length} qualified
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="muted small-text">No one qualified yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.memberId}>
                        <td className="num">{index + 1}</td>
                        <td>{row.name}</td>
                        <td>{row.phone}</td>
                        <td className="num">{formatRupees(row.totalSales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
