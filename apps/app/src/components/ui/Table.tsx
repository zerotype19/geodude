import React from "react";

export function Table({
  columns,
  rows,
  stackOnMobile = true
}: {
  columns: { key: string; label: string }[];
  rows: any[];
  stackOnMobile?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="ui" data-stack={stackOnMobile ? "true" : undefined}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} data-th={c.label}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

