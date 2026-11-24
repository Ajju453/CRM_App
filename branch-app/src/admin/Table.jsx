// Scrollable table for phone screens. Each row is { key, cells, removed? }.
export default function Table({ head, rows, empty }) {
  if (rows.length === 0) {
    return <p className="adm-empty">{empty}</p>;
  }

  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h.label} className={h.right ? 'num' : undefined}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.removed ? 'removed' : undefined}>
              {row.cells.map((cell, i) => (
                <td key={head[i].label} className={head[i].right ? 'num' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
