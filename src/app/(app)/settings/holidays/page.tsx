import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { holidayRepository } from '@/lib/repositories/holidayRepository';
import { HolidayManager } from '@/components/settings/HolidayManager';

export const dynamic = 'force-dynamic';

export default async function HolidaysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const holidays = await holidayRepository.listAll(supabase);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium dark:text-slate-100">공휴일 설정</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            m-view · 회진문서의 drain 제거 / f/u 검사 / 수술예정 표시가 공휴일을 건너뜁니다.
          </p>
        </div>
        <Link
          href="/board"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          ← 보드로
        </Link>
      </div>
      <HolidayManager initial={holidays} />
    </div>
  );
}
