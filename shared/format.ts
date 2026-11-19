/**
 * MySQL command-line client output formatting.
 *
 * Mirrors print_table_data() / print_table_data_vertically() in mysql.cc:
 *  - column width = max(header, longest value), at least 4 for nullable columns
 *  - numeric columns are right-aligned, everything else left-aligned
 *  - NULL is printed as NULL
 *  - "N rows in set", "Empty set", "Query OK, N rows affected" + timing
 */
import type { ColumnMeta } from './types';

/** Display width of a string in a monospace terminal (wide CJK glyphs count 2). */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0) continue;
    if (cp >= 0x300 && cp <= 0x36f) continue; // combining marks
    if (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function padRight(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)));
}

function padLeft(s: string, width: number): string {
  return ' '.repeat(Math.max(0, width - displayWidth(s))) + s;
}

/** Render a result set as a MySQL ASCII table. Returns the lines of the table. */
export function formatTable(columns: ColumnMeta[], rows: (string | null)[][]): string[] {
  const widths = columns.map((col, c) => {
    let w = displayWidth(col.name);
    for (const row of rows) {
      const v = row[c];
      w = Math.max(w, v === null ? 4 : displayWidth(v));
    }
    if (w < 4 && col.nullable) w = 4;
    return w;
  });

  const border = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const header = '|' + columns.map((col, c) => ' ' + padRight(col.name, widths[c]) + ' ').join('|') + '|';
  const lines = [border, header, border];
  for (const row of rows) {
    const cells = columns.map((col, c) => {
      const v = row[c] ?? 'NULL';
      return ' ' + (col.numeric ? padLeft(v, widths[c]) : padRight(v, widths[c])) + ' ';
    });
    lines.push('|' + cells.join('|') + '|');
  }
  lines.push(border);
  return lines;
}

/** Render a result set the way `\G` does. */
export function formatVertical(columns: ColumnMeta[], rows: (string | null)[][]): string[] {
  const nameWidth = Math.max(0, ...columns.map((c) => displayWidth(c.name)));
  const lines: string[] = [];
  rows.forEach((row, r) => {
    lines.push(`${'*'.repeat(27)} ${r + 1}. row ${'*'.repeat(27)}`);
    columns.forEach((col, c) => {
      lines.push(`${padLeft(col.name, nameWidth)}: ${row[c] ?? 'NULL'}`);
    });
  });
  return lines;
}

/** "(0.01 sec)" from a measured duration in milliseconds. */
export function formatElapsed(ms: number): string {
  return `(${(Math.max(0, ms) / 1000).toFixed(2)} sec)`;
}

function warningSuffix(warnings: number): string {
  if (!warnings) return '';
  return `, ${warnings} warning${warnings === 1 ? '' : 's'}`;
}

/** "3 rows in set (0.00 sec)" / "Empty set (0.00 sec)" */
export function resultSetSummary(rowCount: number, warnings: number, ms: number): string {
  if (rowCount === 0) return `Empty set${warningSuffix(warnings)} ${formatElapsed(ms)}`;
  return `${rowCount} ${rowCount === 1 ? 'row' : 'rows'} in set${warningSuffix(warnings)} ${formatElapsed(ms)}`;
}

/** "Query OK, 1 row affected (0.01 sec)" */
export function okSummary(affectedRows: number, warnings: number, ms: number): string {
  return `Query OK, ${affectedRows} ${affectedRows === 1 ? 'row' : 'rows'} affected${warningSuffix(warnings)} ${formatElapsed(ms)}`;
}

/** "ERROR 1146 (42S02): Table 'x.y' doesn't exist" */
export function mysqlErrorLine(errno: number, sqlState: string, message: string): string {
  return `ERROR ${errno} (${sqlState}): ${message}`;
}
