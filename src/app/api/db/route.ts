import { NextRequest, NextResponse } from 'next/server';
import { createSqliteClient } from '@/lib/db/adapter';

export const dynamic = 'force-dynamic';

/**
 * 브라우저 httpClient가 보낸 쿼리 체인을 서버에서 SQLite로 실행.
 * body: { table, steps: [{m, a}], terminator: 'single'|'maybe'|'many' }
 */
export async function POST(req: NextRequest) {
  try {
    const { table, steps, terminator } = await req.json();
    const client = createSqliteClient();
    // 화이트리스트 테이블만
    if (!['patients', 'examinations', 'holidays', 'professors'].includes(table)) {
      return NextResponse.json({ data: null, error: { message: 'invalid table' } });
    }
    let q: Record<string, (...args: unknown[]) => unknown> = client.from(table) as never;
    for (const step of steps as { m: string; a: unknown[] }[]) {
      const fn = q[step.m];
      if (typeof fn !== 'function') {
        return NextResponse.json({ data: null, error: { message: `bad step ${step.m}` } });
      }
      q = fn.apply(q, step.a) as never;
    }
    const term = terminator === 'single' ? 'single' : terminator === 'maybe' ? 'maybeSingle' : null;
    const result = term ? await (q[term] as () => unknown)() : await (q as unknown as Promise<unknown>);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ data: null, error: { message: e instanceof Error ? e.message : String(e) } });
  }
}
