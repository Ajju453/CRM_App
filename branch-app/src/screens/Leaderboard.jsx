import { useEffect, useState } from 'react';
import { formatRupees } from '../api.js';

export default function Leaderboard({ call }) {
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
        <h2>Leaderboard</h2>
        <p className="error" role="alert">{loadError}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section>
        <h2>Leaderboard</h2>
        <p className="muted">Loading...</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Top sellers in your showroom</h2>
      {data.top.length === 0 ? (
        <p className="muted">No sales yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Showroom</th>
                <th className="num">Total</th>
                <th>Trip</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((row, index) => (
                <tr key={row.memberId}>
                  <td className="num">{index + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.phone}</td>
                  <td>{row.branchName}</td>
                  <td className="num">{formatRupees(row.totalSales)}</td>
                  <td>{row.tier ? row.tier.name : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
