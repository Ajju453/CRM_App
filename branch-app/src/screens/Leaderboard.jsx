import { useEffect, useState } from 'react';
import { formatRupees } from '../api.js';

export default function Leaderboard({ call }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

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

  const query = search.trim().toLowerCase();
  const ranked = data.top
    .map((row, index) => ({ ...row, rank: index + 1 }))
    .filter((row) => !query || row.name.toLowerCase().includes(query) || row.phone.includes(query));

  return (
    <section>
      <h2>Leaderboard</h2>
      <div className="cards">
        <div className="card">
          <span className="muted">Ranked Members</span>
          <strong>{data.top.length}</strong>
        </div>
        <div className="card">
          <span className="muted">Top Seller</span>
          <strong>{data.top[0] ? data.top[0].name : '-'}</strong>
        </div>
      </div>
      <input
        className="search"
        type="search"
        placeholder="Search by name or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {ranked.length === 0 ? (
        <p className="muted">{data.top.length === 0 ? 'No sales yet.' : 'No matches for this search.'}</p>
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
              {ranked.map((row) => (
                <tr key={row.memberId}>
                  <td className="num">{row.rank}</td>
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
