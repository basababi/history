/**
 * RFC 4180 CSV — Google Sheets-ийн «Файл → Татах → CSV» гаралт
 *
 * Хашилттай талбар, `""` escape, хашилт доторх мөр шилжилт, UTF-8 BOM,
 * CRLF бүгдийг дэмжинэ. Мөр бүр файлын аль мөрөөс эхэлснийг хадгална —
 * түүхчид «12-р мөрөнд алдаа» гэж ойлгомжтой хэлэхийн тулд.
 */

export interface CsvRow {
  /** Файлын мөрийн дугаар (1-ээс) — энэ бичлэг эхэлсэн мөр */
  line: number;
  cells: string[];
}

export class CsvError extends Error {
  constructor(
    message: string,
    readonly line: number
  ) {
    super(message);
    this.name = 'CsvError';
  }
}

export function parseCsv(text: string): CsvRow[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  let line = 1;
  let rowLine = 1;
  let quoteLine = 1;

  const endRow = () => {
    cells.push(field);
    // Хоосон мөрийг (зөвхөн мөр шилжилт) алгасна
    if (!(cells.length === 1 && cells[0] === '' && !fieldStarted)) rows.push({ line: rowLine, cells });
    cells = [];
    field = '';
    fieldStarted = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else if (ch === '\r' && src[i + 1] === '\n') {
        field += '\n';
        line++;
        i++;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') {
      quoted = true;
      fieldStarted = true;
      quoteLine = line;
    } else if (ch === ',') {
      cells.push(field);
      field = '';
      fieldStarted = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }

  if (quoted) throw new CsvError('Хашилт (") хаагдаагүй байна', quoteLine);
  if (field !== '' || cells.length > 0 || fieldStarted) endRow();
  return rows;
}

/** Excel, Sheets хоёулаа зөв уншдаг CSV (UTF-8 BOM-гүй, LF) */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const quote = (v: string) => (/[",\n\r]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(quote).join(',')).join('\n') + '\n';
}
