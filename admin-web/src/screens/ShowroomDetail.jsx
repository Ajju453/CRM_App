import { useCallback, useEffect, useState } from 'react';

const EMPTY_OWNER = { username: '', password: '' };

function formatRupees(amount) {
  return `\u20B9${Number(amount || 0).toLocaleString('en-IN')}`;
}

export default function ShowroomDetail({ call, formatDate, branchId, onBack }) {
  const [data, setData] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [ownerError, setOwnerError] = useState('');
  const [ownerForm, setOwnerForm] = useState(EMPTY_OWNER);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback(
    () =>
      call(`/admin/branches/${branchId}`)
        .then((res) => {
          setData(res);
          setLoadError('');
        })
        .catch((err) => setLoadError(err.message)),
    [call, branchId]
  );

  useEffect(() => {
    let active = true;
    setData(null);
    setNotice('');
    setOwnerError('');
    setEditing(false);
    setLoadError('');
    Promise.all([call(`/admin/branches/${branchId}`), call('/leaderboard?limit=1')])
      .then(([detail, board]) => {
        if (!active) return;
        setData(detail);
        setTiers(board.tiers);
      })
      .catch((err) => {
        if (active) setLoadError(err.message);
      });
    return () => {
      active = false;
    };
  }, [call, branchId]);

  function updateOwnerField(field, value) {
    setOwnerForm((current) => ({ ...current, [field]: value }));
  }

  // Runs a credential change, then reloads the showroom so the page reflects it.
  async function runOwnerAction(action, message) {
    setBusy(true);
    setNotice('');
    setOwnerError('');
    try {
      await action();
      setNotice(message);
      await loadDetail();
    } catch (err) {
      setOwnerError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function addOwner(event) {
    event.preventDefault();
    runOwnerAction(async () => {
      await call('/admin/owners', {
        method: 'POST',
        body: { username: ownerForm.username.trim(), password: ownerForm.password, branchId: Number(branchId) },
      });
      setOwnerForm(EMPTY_OWNER);
    }, 'Owner added. They can now sign in to the branch app.');
  }

  function saveLogin(event) {
    event.preventDefault();
    const body = {};
    const username = ownerForm.username.trim();
    if (username) body.username = username;
    if (ownerForm.password) body.password = ownerForm.password;
    runOwnerAction(async () => {
      await call(`/admin/owners/${data.owner.id}`, { method: 'PATCH', body });
      setOwnerForm(EMPTY_OWNER);
      setEditing(false);
    }, 'Login updated. The owner has been signed out and must use the new details.');
  }

  function removeOwner() {
    runOwnerAction(async () => {
      await call(`/admin/owners/${data.owner.id}`, { method: 'DELETE' });
      setConfirmRemove(false);
    }, 'Owner removed. They are signed out and can no longer log in.');
  }

  return (
    <section>
      <button className="btn-ghost mb-4" onClick={onBack}>
        &larr; Back to showrooms
      </button>

      {loadError && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700" role="alert">
          {loadError}
        </p>
      )}

      {!data && !loadError && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

      {data && (
        <>
          <div>
            <h1 className="text-xl font-semibold">{data.branch.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Code {data.branch.code} &middot;{' '}
              {data.owner ? (
                <>
                  Owner <span className="font-mono">{data.owner.username}</span>, added{' '}
                  {formatDate(data.owner.createdAt)}
                </>
              ) : (
                'No active owner'
              )}
            </p>
          </div>

          <div className="card mt-6">
            <h2 className="text-base font-semibold">Owner login</h2>
            {notice && (
              <p className="mt-3 rounded-md bg-brand-100 px-4 py-3 text-sm text-brand-800" role="status">
                {notice}
              </p>
            )}
            {ownerError && (
              <p className="mt-3 text-sm text-brand-600" role="alert">
                {ownerError}
              </p>
            )}

            {data.owner ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Username <span className="font-mono">{data.owner.username}</span>. The password is hidden; set a
                  new one below if needed.
                </p>
                {!editing ? (
                  <div className="mt-4 flex gap-3">
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setEditing(true);
                        setOwnerError('');
                      }}
                      disabled={busy}
                    >
                      Change login
                    </button>
                    <button className="btn-danger" onClick={() => setConfirmRemove(true)} disabled={busy}>
                      Remove owner
                    </button>
                  </div>
                ) : (
                  <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={saveLogin}>
                    <label className="block">
                      <span className="label">New username (leave blank to keep)</span>
                      <input
                        className="input"
                        value={ownerForm.username}
                        onChange={(e) => updateOwnerField('username', e.target.value)}
                        pattern="[A-Za-z0-9_]{3,32}"
                        title="3-32 letters, digits or underscores"
                        autoComplete="off"
                      />
                    </label>
                    <label className="block">
                      <span className="label">New password (leave blank to keep)</span>
                      <input
                        className="input"
                        type="password"
                        value={ownerForm.password}
                        onChange={(e) => updateOwnerField('password', e.target.value)}
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </label>
                    <div className="flex gap-3 sm:col-span-2">
                      <button type="submit" className="btn-primary" disabled={busy}>
                        Save login
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setEditing(false);
                          setOwnerForm(EMPTY_OWNER);
                          setOwnerError('');
                        }}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={addOwner}>
                <p className="text-sm text-slate-600 sm:col-span-2">
                  No active owner for this showroom. Set the fixed login the branch owner will use.
                </p>
                <label className="block">
                  <span className="label">Username</span>
                  <input
                    className="input"
                    value={ownerForm.username}
                    onChange={(e) => updateOwnerField('username', e.target.value)}
                    pattern="[A-Za-z0-9_]{3,32}"
                    title="3-32 letters, digits or underscores"
                    autoComplete="off"
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">Password</span>
                  <input
                    className="input"
                    type="password"
                    value={ownerForm.password}
                    onChange={(e) => updateOwnerField('password', e.target.value)}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary" disabled={busy}>
                    Create owner
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-5">
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-slate-500">Active members</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.memberCount}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-slate-500">With bills</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.membersWithBills}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-slate-500">Without bills</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.membersWithoutBills}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-slate-500">Bills</div>
              <div className="mt-2 text-2xl font-semibold">{data.totals.billCount}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total sales</div>
              <div className="mt-2 text-2xl font-semibold">{formatRupees(data.totals.totalSales)}</div>
            </div>
          </div>

          <h2 className="mt-8 text-base font-semibold">Monthly sales</h2>
          <div className="card mt-3 overflow-hidden p-0">
            {data.monthly.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No sales yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Sr no</th>
                    <th className="px-6 py-3 font-medium">Month</th>
                    <th className="px-6 py-3 text-right font-medium">Bills</th>
                    <th className="px-6 py-3 text-right font-medium">Total sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.monthly.map((row, index) => (
                    <tr key={row.period}>
                      <td className="px-6 py-3">{index + 1}</td>
                      <td className="px-6 py-3 font-medium">{row.period}</td>
                      <td className="px-6 py-3 text-right">{row.totalBills}</td>
                      <td className="px-6 py-3 text-right">{formatRupees(row.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="mt-8 text-base font-semibold">Yearly sales</h2>
          <div className="card mt-3 overflow-hidden p-0">
            {data.yearly.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No sales yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Sr no</th>
                    <th className="px-6 py-3 font-medium">Year</th>
                    <th className="px-6 py-3 text-right font-medium">Bills</th>
                    <th className="px-6 py-3 text-right font-medium">Total sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.yearly.map((row, index) => (
                    <tr key={row.period}>
                      <td className="px-6 py-3">{index + 1}</td>
                      <td className="px-6 py-3 font-medium">{row.period}</td>
                      <td className="px-6 py-3 text-right">{row.totalBills}</td>
                      <td className="px-6 py-3 text-right">{formatRupees(row.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="mt-8 text-base font-semibold">Trip eligibility</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="card">
                <div className="text-sm font-semibold">{tier.name}</div>
                <div className="text-xs text-slate-500">From {formatRupees(tier.threshold)}</div>
                <div className="mt-2 text-2xl font-semibold">{data.eligibility[tier.id] ?? 0}</div>
                <div className="text-xs text-slate-500">members qualified</div>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-base font-semibold">Ranking</h2>
          <div className="card mt-3 overflow-hidden p-0">
            {data.ranking.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No member has sales yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Sr no</th>
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Phone</th>
                    <th className="px-6 py-3 font-medium">Trip</th>
                    <th className="px-6 py-3 text-right font-medium">Total sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.ranking.map((row, index) => (
                    <tr key={row.memberId}>
                      <td className="px-6 py-3">{index + 1}</td>
                      <td className="px-6 py-3 font-medium">{row.name}</td>
                      <td className="px-6 py-3 font-mono">{row.phone}</td>
                      <td className="px-6 py-3">{row.tier ? row.tier.name : '-'}</td>
                      <td className="px-6 py-3 text-right">{formatRupees(row.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="mt-8 text-base font-semibold">Members</h2>
          <div className="card mt-3 overflow-hidden p-0">
            {data.members.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No members yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Sr no</th>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Phone</th>
                    <th className="px-6 py-3 font-medium">Address</th>
                    <th className="px-6 py-3 font-medium">Occupation</th>
                    <th className="px-6 py-3 text-right font-medium">Bills</th>
                    <th className="px-6 py-3 text-right font-medium">Total sales</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.members.map((m, index) => (
                    <tr key={m.id} className={m.isDeleted ? 'text-slate-400' : ''}>
                      <td className="px-6 py-3">{index + 1}</td>
                      <td className="px-6 py-3 font-medium">{m.name}</td>
                      <td className="px-6 py-3 font-mono">{m.phone}</td>
                      <td className="px-6 py-3">{m.address || '-'}</td>
                      <td className="px-6 py-3">{m.occupation}</td>
                      <td className="px-6 py-3 text-right">{m.billCount}</td>
                      <td className="px-6 py-3 text-right">{formatRupees(m.totalAmount)}</td>
                      <td className="px-6 py-3">{m.isDeleted ? 'Removed' : 'Active'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="mt-8 text-base font-semibold">Bills</h2>
          <div className="card mt-3 overflow-hidden p-0">
            {data.bills.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No bills yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Sr no</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Phone</th>
                    <th className="px-6 py-3 font-medium">Site</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.bills.map((b, index) => (
                    <tr key={b.id}>
                      <td className="px-6 py-3">{index + 1}</td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {formatDate(b.billDate)}
                        {b.billTime ? ` ${b.billTime}` : ''}
                      </td>
                      <td className="px-6 py-3">{b.memberName}</td>
                      <td className="px-6 py-3 font-mono">{b.memberPhone}</td>
                      <td className="px-6 py-3">{b.site || '-'}</td>
                      <td className="px-6 py-3 text-right font-medium">{formatRupees(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {confirmRemove && data && data.owner && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-brand-900/50 px-4" role="dialog" aria-modal="true" aria-labelledby="remove-title">
          <div className="card w-full max-w-sm">
            <h2 id="remove-title" className="text-base font-semibold">
              Remove owner?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Remove <strong>{data.owner.username}</strong> as owner of {data.branch.name}? They will be signed out
              immediately and cannot log in again. Showroom data stays in place.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-ghost" onClick={() => setConfirmRemove(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-danger" onClick={removeOwner} disabled={busy}>
                Remove owner
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
