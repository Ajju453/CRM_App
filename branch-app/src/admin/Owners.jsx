import { useEffect, useState } from 'react';

export default function Owners({ call, onSelectShowroom }) {
  const [branches, setBranches] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([call('/branches'), call('/admin/owners')])
      .then(([branchRows, ownerRows]) => {
        if (!active) return;
        setBranches(branchRows);
        setOwners(ownerRows);
        setLoadError('');
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setLoadError(err.message);
      });
    return () => {
      active = false;
    };
  }, [call]);

  const ownerByBranch = new Map(owners.map((o) => [o.branchId, o]));

  return (
    <section>
      <h1 className="adm-heading">Showrooms</h1>
      <p className="adm-muted">
        {branches.length} showrooms, {owners.length} with an active owner. Tap a showroom to manage its login and
        reports.
      </p>

      {loadError && (
        <p className="adm-alert" role="alert">
          {loadError}
        </p>
      )}
      {!loadError && !loaded && <p className="adm-muted">Loading...</p>}

      {branches.map((branch) => {
        const owner = ownerByBranch.get(branch.id);
        return (
          <div className="adm-card" key={branch.id}>
            <button className="adm-card-link" onClick={() => onSelectShowroom(branch.id)}>
              <div className="adm-stat-label">Code {branch.code}</div>
              <div className="adm-subhead" style={{ marginTop: 4 }}>
                {branch.name}
              </div>
              <div className="adm-muted">
                {owner ? (
                  <>
                    Owner <span className="adm-mono">{owner.username}</span>
                  </>
                ) : (
                  <span style={{ color: '#b91c1c' }}>No owner set</span>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </section>
  );
}
