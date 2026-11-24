import { useCallback, useEffect, useState } from 'react';
import Table from './Table.jsx';
import { formatDate, formatRupees } from './format.js';

const EMPTY_FORM = { username: '', password: '' };

export default function ShowroomDetail({ call, branchId, onBack }) {
  const [data, setData] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [ownerError, setOwnerError] = useState('');
  const [ownerForm, setOwnerForm] = useState(EMPTY_FORM);
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
      setOwnerForm(EMPTY_FORM);
    }, 'Owner added. They can now sign in to the app.');
  }

  function saveLogin(event) {
    event.preventDefault();
    const body = {};
    const username = ownerForm.username.trim();
    if (username) body.username = username;
    if (ownerForm.password) body.password = ownerForm.password;
    runOwnerAction(async () => {
      await call(`/admin/owners/${data.owner.id}`, { method: 'PATCH', body });
      setOwnerForm(EMPTY_FORM);
      setEditing(false);
    }, 'Login updated. The owner has been signed out and must use the new details.');
  }

  function removeOwner() {
    runOwnerAction(async () => {
      await call(`/admin/owners/${data.owner.id}`, { method: 'DELETE' });
      setConfirmRemove(false);
    }, 'Owner removed. They are signed out and can no longer log in.');
  }

  function cancelEdit() {
    setEditing(false);
    setOwnerForm(EMPTY_FORM);
    setOwnerError('');
  }

  return (
    <section>
      <button className="adm-btn adm-btn-ghost adm-back" onClick={onBack}>
        &larr; All showrooms
      </button>

      {loadError && (
        <p className="adm-alert" role="alert">
          {loadError}
        </p>
      )}
      {!data && !loadError && <p className="adm-muted">Loading...</p>}

      {data && (
        <>
          <h1 className="adm-heading">{data.branch.name}</h1>
          <p className="adm-muted">
            Code {data.branch.code} &middot;{' '}
            {data.owner ? (
              <>
                Owner <span className="adm-mono">{data.owner.username}</span>, added{' '}
                {formatDate(data.owner.createdAt)}
              </>
            ) : (
              'No active owner'
            )}
          </p>

          <div className="adm-card">
            <h2 className="adm-subhead">Owner login</h2>
            {notice && (
              <p className="adm-notice" role="status">
                {notice}
              </p>
            )}
            {ownerError && (
              <p className="adm-alert" role="alert">
                {ownerError}
              </p>
            )}

            {data.owner && !editing && (
              <>
                <p className="adm-muted">
                  Username <span className="adm-mono">{data.owner.username}</span>. The password is hidden; set a new
                  one if needed.
                </p>
                <div className="adm-row">
                  <button
                    className="adm-btn adm-btn-primary"
                    onClick={() => {
                      setEditing(true);
                      setOwnerError('');
                    }}
                    disabled={busy}
                  >
                    Change login
                  </button>
                  <button className="adm-btn adm-btn-danger" onClick={() => setConfirmRemove(true)} disabled={busy}>
                    Remove owner
                  </button>
                </div>
              </>
            )}

            {data.owner && editing && (
              <form className="adm-form" onSubmit={saveLogin}>
                <label className="adm-label">
                  New username (leave blank to keep)
                  <input
                    className="adm-input"
                    value={ownerForm.username}
                    onChange={(e) => updateOwnerField('username', e.target.value)}
                    pattern="[A-Za-z0-9_]{3,32}"
                    title="3-32 letters, digits or underscores"
                    autoComplete="off"
                  />
                </label>
                <label className="adm-label">
                  New password (leave blank to keep)
                  <input
                    className="adm-input"
                    type="password"
                    value={ownerForm.password}
                    onChange={(e) => updateOwnerField('password', e.target.value)}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
                <div className="adm-row">
                  <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
                    Save login
                  </button>
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={cancelEdit} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!data.owner && (
              <form className="adm-form" onSubmit={addOwner}>
                <p className="adm-muted">
                  No active owner for this showroom. Set the fixed login the branch owner will use.
                </p>
                <label className="adm-label">
                  Username
                  <input
                    className="adm-input"
                    value={ownerForm.username}
                    onChange={(e) => updateOwnerField('username', e.target.value)}
                    pattern="[A-Za-z0-9_]{3,32}"
                    title="3-32 letters, digits or underscores"
                    autoComplete="off"
                    required
                  />
                </label>
                <label className="adm-label">
                  Password
                  <input
                    className="adm-input"
                    type="password"
                    value={ownerForm.password}
                    onChange={(e) => updateOwnerField('password', e.target.value)}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <div className="adm-row">
                  <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
                    Create owner
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="adm-stats">
            <div className="adm-card">
              <div className="adm-stat-label">Active members</div>
              <div className="adm-stat-value">{data.totals.memberCount}</div>
            </div>
            <div className="adm-card">
              <div className="adm-stat-label">With bills</div>
              <div className="adm-stat-value">{data.totals.membersWithBills}</div>
            </div>
            <div className="adm-card">
              <div className="adm-stat-label">Without bills</div>
              <div className="adm-stat-value">{data.totals.membersWithoutBills}</div>
            </div>
            <div className="adm-card">
              <div className="adm-stat-label">Bills</div>
              <div className="adm-stat-value">{data.totals.billCount}</div>
            </div>
            <div className="adm-card" style={{ gridColumn: '1 / -1' }}>
              <div className="adm-stat-label">Total sales</div>
              <div className="adm-stat-value">{formatRupees(data.totals.totalSales)}</div>
            </div>
          </div>

          <h2 className="adm-section">Monthly sales</h2>
          <Table
            head={[
              { label: 'Sr no' },
              { label: 'Month' },
              { label: 'Bills', right: true },
              { label: 'Total sales', right: true },
            ]}
            rows={data.monthly.map((row, index) => ({
              key: row.period,
              cells: [index + 1, row.period, row.totalBills, formatRupees(row.totalSales)],
            }))}
            empty="No sales yet."
          />

          <h2 className="adm-section">Yearly sales</h2>
          <Table
            head={[
              { label: 'Sr no' },
              { label: 'Year' },
              { label: 'Bills', right: true },
              { label: 'Total sales', right: true },
            ]}
            rows={data.yearly.map((row, index) => ({
              key: row.period,
              cells: [index + 1, row.period, row.totalBills, formatRupees(row.totalSales)],
            }))}
            empty="No sales yet."
          />

          <h2 className="adm-section">Trip eligibility</h2>
          <div className="adm-stats">
            {tiers.map((tier) => (
              <div className="adm-card" key={tier.id}>
                <div className="adm-subhead">{tier.name}</div>
                <div className="adm-muted">From {formatRupees(tier.threshold)}</div>
                <div className="adm-stat-value">{data.eligibility[tier.id] ?? 0}</div>
                <div className="adm-muted">members qualified</div>
              </div>
            ))}
          </div>

          <h2 className="adm-section">Ranking</h2>
          <Table
            head={[
              { label: 'Sr no' },
              { label: 'Member' },
              { label: 'Phone' },
              { label: 'Trip' },
              { label: 'Total sales', right: true },
            ]}
            rows={data.ranking.map((row, index) => ({
              key: row.memberId,
              cells: [
                index + 1,
                row.name,
                <span className="adm-mono">{row.phone}</span>,
                row.tier ? row.tier.name : '-',
                formatRupees(row.totalSales),
              ],
            }))}
            empty="No member has sales yet."
          />

          <h2 className="adm-section">Members</h2>
          <Table
            head={[
              { label: 'Sr no' },
              { label: 'Name' },
              { label: 'Phone' },
              { label: 'Address' },
              { label: 'Occupation' },
              { label: 'Bills', right: true },
              { label: 'Total sales', right: true },
              { label: 'Status' },
            ]}
            rows={data.members.map((m, index) => ({
              key: m.id,
              removed: m.isDeleted,
              cells: [
                index + 1,
                m.name,
                <span className="adm-mono">{m.phone}</span>,
                m.address || '-',
                m.occupation,
                m.billCount,
                formatRupees(m.totalAmount),
                m.isDeleted ? 'Removed' : 'Active',
              ],
            }))}
            empty="No members yet."
          />

          <h2 className="adm-section">Bills</h2>
          <Table
            head={[
              { label: 'Sr no' },
              { label: 'Date' },
              { label: 'Member' },
              { label: 'Phone' },
              { label: 'Site' },
              { label: 'Amount', right: true },
            ]}
            rows={data.bills.map((b, index) => ({
              key: b.id,
              cells: [
                index + 1,
                `${formatDate(b.billDate)}${b.billTime ? ` ${b.billTime}` : ''}`,
                b.memberName,
                <span className="adm-mono">{b.memberPhone}</span>,
                b.site || '-',
                formatRupees(b.amount),
              ],
            }))}
            empty="No bills yet."
          />
        </>
      )}

      {confirmRemove && data && data.owner && (
        <div className="adm-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="remove-title">
          <div className="adm-modal">
            <h2 id="remove-title" className="adm-subhead">
              Remove owner?
            </h2>
            <p className="adm-muted" style={{ fontSize: '0.95rem' }}>
              Remove <strong>{data.owner.username}</strong> as owner of {data.branch.name}? They will be signed out
              immediately and cannot log in again. Showroom data stays in place.
            </p>
            <div className="adm-row" style={{ justifyContent: 'flex-end' }}>
              <button className="adm-btn adm-btn-ghost" onClick={() => setConfirmRemove(false)} disabled={busy}>
                Cancel
              </button>
              <button className="adm-btn adm-btn-danger" onClick={removeOwner} disabled={busy}>
                Remove owner
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
