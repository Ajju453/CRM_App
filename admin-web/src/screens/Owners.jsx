import { useEffect, useState } from 'react';

export default function Owners({ call, onSelectShowroom }) {
  const [branches, setBranches] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([call('/branches'), call('/admin/owners')])
      .then(([branchRows, ownerRows]) => {
        if (!active) return;
        setBranches(branchRows);
        setOwners(ownerRows);
        setLoadError('');
      })
      .catch((err) => {
        if (active) setLoadError(err.message);
      });
    return () => {
      active = false;
    };
  }, [call]);

  const ownerByBranch = new Map(owners.map((o) => [o.branchId, o]));

  const activeCount = owners.length;

  return (
    <section>
      <div>
        <h1 className="text-xl font-semibold">Showrooms</h1>
        <p className="mt-1 text-sm text-slate-500">
          {branches.length} showrooms, {activeCount} with an active owner. Open a showroom to manage its login and
          reports.
        </p>
      </div>

      {loadError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && branches.length === 0 && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => {
          const owner = ownerByBranch.get(branch.id);
          return (
            <button
              key={branch.id}
              className="card text-left transition hover:ring-brand-400"
              onClick={() => onSelectShowroom(branch.id)}
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">Code {branch.code}</div>
              <div className="mt-1 text-base font-semibold">{branch.name}</div>
              <div className="mt-3 text-sm">
                {owner ? (
                  <>
                    Owner <span className="font-mono text-slate-700">{owner.username}</span>
                  </>
                ) : (
                  <span className="text-brand-700">No owner set</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
