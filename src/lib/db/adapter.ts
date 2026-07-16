import { getDb, JSON_COLUMNS, BOOL_COLUMNS } from './sqlite';

/**
 * Supabase 쿼리 빌더를 흉내내는 얇은 어댑터.
 * 기존 코드가 supabase.from('x').select().eq().order()... 형태를 그대로 쓰도록 한다.
 *
 * 반환 형태도 Supabase와 동일: { data, error }
 * 지원: from/select/insert/update/upsert/delete/eq/neq/in/lt/lte/gte/gt/is/order/limit/single/maybeSingle
 */

type Row = Record<string, unknown>;
type Filter = { col: string; op: string; val: unknown };

// DB row(문자열 JSON, 0/1) → JS 객체(파싱된 JSON, boolean)
function decodeRow(table: string, row: Row | undefined): Row | null {
  if (!row) return null;
  const jsonCols = JSON_COLUMNS[table];
  const boolCols = BOOL_COLUMNS[table];
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (jsonCols?.has(k) && typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    } else if (boolCols?.has(k)) {
      out[k] = v === 1 || v === true;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// JS 값 → DB 저장용 (JSON stringify, boolean→0/1, undefined 제거)
function encodeValue(table: string, col: string, val: unknown): unknown {
  if (val === undefined) return undefined;
  if (JSON_COLUMNS[table]?.has(col)) return JSON.stringify(val ?? null);
  if (BOOL_COLUMNS[table]?.has(col)) return val ? 1 : 0;
  if (val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val as string | number;
}

const OPS: Record<string, string> = {
  eq: '=', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=',
};

class QueryBuilder {
  private table: string;
  private filters: Filter[] = [];
  private _select = '*';
  private _order: { col: string; asc: boolean }[] = [];
  private _limit?: number;
  private mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private wantReturn = false;

  constructor(table: string) { this.table = table; }

  // ---- 필터 ----
  eq(col: string, val: unknown) { this.filters.push({ col, op: 'eq', val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, op: 'neq', val }); return this; }
  lt(col: string, val: unknown) { this.filters.push({ col, op: 'lt', val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ col, op: 'lte', val }); return this; }
  gt(col: string, val: unknown) { this.filters.push({ col, op: 'gt', val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ col, op: 'gte', val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ col, op: 'is', val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ col, op: 'in', val: vals }); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    this._order.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this._limit = n; return this; }

  // ---- 동작 ----
  select(_cols?: string) {
    if (this.mode === 'select') this._select = _cols || '*';
    else this.wantReturn = true;   // insert/update 후 .select()
    return this;
  }
  insert(payload: Row | Row[]) { this.mode = 'insert'; this.payload = payload; return this; }
  update(payload: Row) { this.mode = 'update'; this.payload = payload; return this; }
  upsert(payload: Row | Row[]) { this.mode = 'upsert'; this.payload = payload; return this; }
  delete() { this.mode = 'delete'; return this; }

  // ---- 종결자 ----
  single() { return this.run('single'); }
  maybeSingle() { return this.run('maybe'); }
  // await 시 (종결자 없이) — thenable
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T) {
    return Promise.resolve(this.run('many')).then(resolve);
  }

  private whereClause(): { sql: string; params: unknown[] } {
    if (this.filters.length === 0) return { sql: '', params: [] };
    const parts: string[] = [];
    const params: unknown[] = [];
    for (const f of this.filters) {
      const enc = (v: unknown) => encodeValue(this.table, f.col, v);
      if (f.op === 'in') {
        const arr = f.val as unknown[];
        if (arr.length === 0) { parts.push('0=1'); continue; }
        parts.push(`${f.col} in (${arr.map(() => '?').join(',')})`);
        arr.forEach((v) => params.push(enc(v)));
      } else if (f.op === 'is') {
        parts.push(f.val === null ? `${f.col} is null` : `${f.col} is ?`);
        if (f.val !== null) params.push(enc(f.val));
      } else {
        parts.push(`${f.col} ${OPS[f.op]} ?`);
        params.push(enc(f.val));
      }
    }
    return { sql: 'where ' + parts.join(' and '), params };
  }

  private run(kind: 'single' | 'maybe' | 'many'): { data: unknown; error: unknown } {
    try {
      const db = getDb();
      const now = new Date().toISOString();

      if (this.mode === 'select') {
        const { sql, params } = this.whereClause();
        let q = `select ${this._select} from ${this.table} ${sql}`;
        if (this._order.length)
          q += ' order by ' + this._order.map((o) => `${o.col} ${o.asc ? 'asc' : 'desc'}`).join(', ');
        if (this._limit != null) q += ` limit ${this._limit}`;
        const rows = db.prepare(q).all(...params) as Row[];
        const decoded = rows.map((r) => decodeRow(this.table, r));
        if (kind === 'many') return { data: decoded, error: null };
        return { data: decoded[0] ?? null, error: kind === 'single' && decoded.length === 0 ? { message: 'No rows' } : null };
      }

      if (this.mode === 'insert' || this.mode === 'upsert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload!];
        // 이 테이블에 실제 존재하는 컬럼 목록 (id/created_at/updated_at 없는 테이블 대응)
        const tableCols = new Set(
          (db.prepare(`PRAGMA table_info(${this.table})`).all() as { name: string }[]).map((c) => c.name),
        );
        const pkCol =
          (db.prepare(`PRAGMA table_info(${this.table})`).all() as { name: string; pk: number }[])
            .find((c) => c.pk === 1)?.name ?? 'id';
        const inserted: Row[] = [];
        for (const raw of rows) {
          const row: Row = { ...raw };
          if (tableCols.has('id') && !row.id) row.id = crypto.randomUUID();
          if (tableCols.has('created_at') && !row.created_at) row.created_at = now;
          if (tableCols.has('updated_at')) row.updated_at = now;
          const cols = Object.keys(row).filter((c) => row[c] !== undefined && tableCols.has(c));
          const vals = cols.map((c) => encodeValue(this.table, c, row[c]));
          const ph = cols.map(() => '?').join(',');
          const verb = this.mode === 'upsert' ? 'insert or replace' : 'insert';
          db.prepare(`${verb} into ${this.table} (${cols.join(',')}) values (${ph})`).run(...vals);
          const got = db.prepare(`select * from ${this.table} where ${pkCol} = ?`).get(row[pkCol]) as Row;
          if (got) inserted.push(decodeRow(this.table, got)!);
        }
        if (!this.wantReturn && kind === 'many') return { data: null, error: null };
        if (kind === 'many') return { data: inserted, error: null };
        return { data: inserted[0] ?? null, error: null };
      }

      if (this.mode === 'update') {
        const patch = this.payload as Row;
        const tableCols = new Set(
          (db.prepare(`PRAGMA table_info(${this.table})`).all() as { name: string }[]).map((c) => c.name),
        );
        const cols = Object.keys(patch).filter((c) => patch[c] !== undefined && tableCols.has(c));
        if (tableCols.has('updated_at')) cols.push('updated_at');
        const setSql = cols.map((c) => `${c} = ?`).join(', ');
        const setVals = cols.map((c) => (c === 'updated_at' ? now : encodeValue(this.table, c, patch[c])));
        const { sql, params } = this.whereClause();
        db.prepare(`update ${this.table} set ${setSql} ${sql}`).run(...setVals, ...params);
        if (!this.wantReturn && kind === 'many') return { data: null, error: null };
        const { sql: wsql, params: wparams } = this.whereClause();
        const rows = db.prepare(`select * from ${this.table} ${wsql}`).all(...wparams) as Row[];
        const decoded = rows.map((r) => decodeRow(this.table, r));
        if (kind === 'many') return { data: decoded, error: null };
        return { data: decoded[0] ?? null, error: null };
      }

      if (this.mode === 'delete') {
        const { sql, params } = this.whereClause();
        db.prepare(`delete from ${this.table} ${sql}`).run(...params);
        return { data: null, error: null };
      }

      return { data: null, error: { message: 'unknown mode' } };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }
}

/** Supabase 클라이언트 흉내 — from()과 auth 스텁 제공 */
export function createSqliteClient() {
  return {
    from(table: string) { return new QueryBuilder(table); },
    // 오프라인엔 인증 없음 — 항상 로컬 사용자 반환
    auth: {
      async getUser() {
        return { data: { user: { id: 'local', email: 'neuro@local' } }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: { id: 'local' } }, error: null };
      },
      async signOut() { return { error: null }; },
    },
  };
}
