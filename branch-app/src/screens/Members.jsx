import { useEffect, useState } from 'react';
import { formatRupees } from '../api.js';

const OCCUPATIONS = ['Contractor', 'Engineer', 'Mistri'];
const EMPTY_FORM = { name: '', phone: '', address: '', occupation: 'Contractor' };

export default function Members({ call, onAddBill }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');

  function openMember(id) {
    call(`/members/${id}`)
      .then(setDetail)
      .catch((err) => setLoadError(err.message));
  }

  function loadMembers() {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    return call(`/members${query}`)
      .then((rows) => {
        setMembers(rows);
        setLoadError('');
      })
      .catch((err) => setLoadError(err.message));
  }

  useEffect(() => {
    const timer = setTimeout(loadMembers, 250);
    return () => clearTimeout(timer);
    // loadMembers depends on search and call; the timer debounces typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, call]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveMember(event) {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      await call('/members', { method: 'POST', body: form });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice('Member added');
      await loadMembers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const member = toDelete;
    setBusy(true);
    try {
      await call(`/members/${member.id}`, { method: 'DELETE' });
      setToDelete(null);
      setNotice(`${member.name} removed from your list`);
      await loadMembers();
    } catch (err) {
      setToDelete(null);
      setLoadError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="row between">
        <h2>Members</h2>
        <button className="primary small" onClick={() => { setShowForm((v) => !v); setFormError(''); }}>
          {showForm ? 'Cancel' : 'Add member'}
        </button>
      </div>

      {notice && <p className="notice">{notice}</p>}

      {showForm && (
        <form className="form card-form" onSubmit={saveMember}>
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
            Address
            <input value={form.address} onChange={(e) => updateField('address', e.target.value)} maxLength={300} />
          </label>
          <label>
            Occupation
            <select value={form.occupation} onChange={(e) => updateField('occupation', e.target.value)}>
              {OCCUPATIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          {formError && <p className="error" role="alert">{formError}</p>}
          <button type="submit" className="primary" disabled={busy}>Save member</button>
        </form>
      )}

      <input
        className="search"
        type="search"
        placeholder="Search by name or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loadError && <p className="error" role="alert">{loadError}</p>}

      {members.length === 0 ? (
        <p className="muted">No members found.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Occupation</th>
                <th className="num">Bills</th>
                <th className="num">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, index) => (
                <tr key={m.id}>
                  <td className="num">{index + 1}</td>
                  <td>
                    <button className="link name-link" onClick={() => openMember(m.id)}>{m.name}</button>
                  </td>
                  <td>{m.phone}</td>
                  <td>{m.address || '-'}</td>
                  <td>{m.occupation}</td>
                  <td className="num">{m.billCount}</td>
                  <td className="num">{formatRupees(m.totalAmount)}</td>
                  <td className="actions">
                    <button className="primary small" onClick={() => onAddBill(m.id)} disabled={busy}>
                      Add bill
                    </button>
                    <button className="danger small" onClick={() => setToDelete(m)} disabled={busy}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div className="modal wide-modal">
            <h3 id="detail-title">{detail.name}</h3>
            <p className="muted small-text">
              {detail.phone} · {detail.occupation}{detail.address ? ` · ${detail.address}` : ''}
            </p>
            <p>
              <strong>{detail.billCount}</strong> bills · <strong>{formatRupees(detail.totalAmount)}</strong> total
            </p>
            {detail.bills.length === 0 ? (
              <p className="muted">No bills yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Date</th>
                      <th>Site</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.bills.map((b, index) => (
                      <tr key={b.id}>
                        <td className="num">{index + 1}</td>
                        <td>{b.billDate}{b.billTime ? ` ${b.billTime}` : ''}</td>
                        <td>{b.site || '-'}</td>
                        <td className="num">{formatRupees(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row end">
              <button className="secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="modal">
            <h3 id="confirm-title">Remove member?</h3>
            <p>
              Remove <strong>{toDelete.name}</strong> from your showroom list? Their past bills stay in
              sales history.
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
