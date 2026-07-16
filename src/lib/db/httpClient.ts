'use client';

/**
 * 브라우저용 클라이언트: 쿼리 체인을 기록했다가 /api/db로 전송해 실행.
 * 서버의 SQLite 어댑터와 동일한 결과({data,error})를 반환한다.
 */

type Step = { m: string; a: unknown[] };

class HttpQuery {
  private table: string;
  private steps: Step[] = [];
  constructor(table: string) { this.table = table; }

  private push(m: string, ...a: unknown[]) { this.steps.push({ m, a }); return this; }

  select(cols?: string) { return this.push('select', cols); }
  insert(payload: unknown) { return this.push('insert', payload); }
  update(payload: unknown) { return this.push('update', payload); }
  upsert(payload: unknown) { return this.push('upsert', payload); }
  delete() { return this.push('delete'); }
  eq(c: string, v: unknown) { return this.push('eq', c, v); }
  neq(c: string, v: unknown) { return this.push('neq', c, v); }
  lt(c: string, v: unknown) { return this.push('lt', c, v); }
  lte(c: string, v: unknown) { return this.push('lte', c, v); }
  gt(c: string, v: unknown) { return this.push('gt', c, v); }
  gte(c: string, v: unknown) { return this.push('gte', c, v); }
  is(c: string, v: unknown) { return this.push('is', c, v); }
  in(c: string, v: unknown[]) { return this.push('in', c, v); }
  order(c: string, o?: unknown) { return this.push('order', c, o); }
  limit(n: number) { return this.push('limit', n); }

  private async exec(terminator: string) {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: this.table, steps: this.steps, terminator }),
    });
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } };
    return res.json();
  }

  single() { return this.exec('single'); }
  maybeSingle() { return this.exec('maybe'); }
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T) {
    return this.exec('many').then(resolve);
  }
}

export function createHttpClient() {
  return {
    from(table: string) { return new HttpQuery(table); },
    auth: {
      async getUser() {
        return { data: { user: { id: 'local', email: 'neuro@local' } }, error: null };
      },
      async signInWithPassword() { return { data: { user: { id: 'local' } }, error: null }; },
      async signOut() { return { error: null }; },
    },
  };
}
