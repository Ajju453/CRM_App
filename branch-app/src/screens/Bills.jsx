import { useEffect, useState } from 'react';
import { formatRupees, todayLocal } from '../api.js';

const OCCUPATIONS = ['Contractor', 'Engineer', 'Mistri'];

function emptyForm(branchName, memberId = '') {
  return {
    mode: memberId ? 'existing' : 'new',
    memberId,
    name: '',
    phone: '',
    occupation: 'Contractor',
    address: '',
    amount: '',
    billDate: todayLocal(),
    billTime: '',
    site: branchName || '',
  };
}

export default function Bills({ call, branchName, presetMemberId = '', onBack }) {
  const [members, setMembers] = useState([]);
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(() => emptyForm(branchName, presetMemberId));
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  function loadAll() {
    return Promise.all([call('/members'), call('/bills?limit=50')])
      .then(([memberRows, billRows]) => {
        setMembers(memberRows);
        setBills(billRows);
        setLoadError('');
      })
      .catch((err) => setLoadError(err.message));
  }

  useEffect(() => {
    loadAll();
    // loadAll is recreated per render only through call, which is stable in App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function confirmDelete() {
    const bill = toDelete;
    setBusy(true);
    try {
      await call(`/bills/${bill.id}`, { method: 'DELETE' });
      setToDelete(null);
      setNotice('Bill deleted');
      await loadAll();
    } catch (err) {
      setToDelete(null);
      setLoadError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBill(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');
    setBusy(true);
    const member = form.mode === 'existing'
      ? { memberId: Number(form.memberId) }
      : { name: form.name, phone: form.phone, occupation: form.occupation, address: form.address };
    try {
      const saved = await call('/bills', {
        method: 'POST',
        body: {
          ...member,
          amount: Number(form.amount),
          billDate: form.billDate,
          billTime: form.billTime || null,
          site: form.site,
        },
      });
      setForm(emptyForm(branchName));
      setNotice(saved.createdMember ? `Bill saved. ${saved.memberName} added to members.` : `Bill saved for ${saved.memberName}.`);
      await loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isExisting = form.mode === 'existing';
  const selected = presetMemberId
    ? members.find((m) => String(m.id) === String(presetMemberId))
    : null;

  return (
    <section>
      <div className="row between">
        <h2>Add Bill</h2>
        {onBack && (
          <button type="button" className="secondary small" onClick={onBack}>Back to members</button>
        )}
      </div>
      {selected && (
        <div className="card member-summary">
          <span className="muted">Selected member</span>
          <strong>{selected.name}</strong>
          <span className="muted small-text">{selected.phone} · {selected.occupation}</span>
        </div>
      )}
      <form className="form card-form" onSubmit={saveBill}>
        <div className="segmented" role="group" aria-label="Member">
          <button
            type="button"
            className={!isExisting ? 'active' : ''}
            onClick={() => updateField('mode', 'new')}
          >
            New or by phone
          </button>
          <button
            type="button"
            className={isExisting ? 'active' : ''}
            onClick={() => updateField('mode', 'existing')}
          >
            Existing member
          </button>
        </div>

        {isExisting ? (
          <label>
            Member
            <select value={form.memberId} onChange={(e) => updateField('memberId', e.target.value)} required>
              <option value="" disabled>Select a member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              Name
              <input value={form.name} onChange={(e) => updateField('name', e.target.value)} required maxLength={100} />
            </label>
            <label>
              Phone
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                required
              />
            </label>
            <label>
              Occupation
              <select value={form.occupation} onChange={(e) => updateField('occupation', e.target.value)}>
                {OCCUPATIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Address (optional)
              <input value={form.address} onChange={(e) => updateField('address', e.target.value)} maxLength={300} />
            </label>
          </>
        )}

        <label>
          Bill amount (₹)
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={form.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            required
          />
        </label>
        <div className="row">
          <label className="grow">
            Date
            <input type="date" value={form.billDate} onChange={(e) => updateField('billDate', e.target.value)} required />
          </label>
          <label className="grow">
            Time
            <input type="time" value={form.billTime} onChange={(e) => updateField('billTime', e.target.value)} />
          </label>
        </div>
        <label>
          Site
          <input value={form.site} onChange={(e) => updateField('site', e.target.value)} maxLength={150} />
        </label>

        {formError && <p className="error" role="alert">{formError}</p>}
        {notice && <p className="notice">{notice}</p>}
        <button type="submit" className="primary" disabled={busy || (isExisting && members.length === 0)}>
          Save bill
        </button>
        {isExisting && members.length === 0 && !loadError && (
          <p className="muted small-text">No members yet. Use New or by phone.</p>
        )}
      </form>

      <h2>Recent bills</h2>
      {notice && <p className="notice">{notice}</p>}
      {loadError && <p className="error" role="alert">{loadError}</p>}
      {bills.length === 0 ? (
        <p className="muted">No bills yet.</p>
      ) : (
        <ul className="list">
          {bills.map((b, index) => (
            <li key={b.id} className="list-item">
              <span className="muted small-text sr">{index + 1}</span>
              <div className="grow">
                <strong>{b.memberName}</strong>
                <div className="muted small-text">
                  {b.memberPhone} · {b.billDate}{b.billTime ? ` ${b.billTime}` : ''}{b.site ? ` · ${b.site}` : ''}
                </div>
              </div>
              <strong>{formatRupees(b.amount)}</strong>
              <button className="danger small" onClick={() => setToDelete(b)} disabled={busy}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-bill-title">
          <div className="modal">
            <h3 id="confirm-bill-title">Delete bill?</h3>
            <p>
              Delete the {formatRupees(toDelete.amount)} bill for <strong>{toDelete.memberName}</strong> on{' '}
              {toDelete.billDate}? This removes it from sales totals.
            </p>
            <div className="row end">
              <button className="secondary" onClick={() => setToDelete(null)} disabled={busy}>Cancel</button>
              <button className="danger" onClick={confirmDelete} disabled={busy}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
