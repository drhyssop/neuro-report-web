import Link from 'next/link';
// import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserMenu } from '@/components/auth/UserMenu';
import { IdleLock } from '@/components/auth/IdleLock';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
// import { PIN_COOKIE_NAME, isPinCookieValid } from '@/lib/auth/pinCookie';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // PIN unlock 체크 (middleware 대신 layout에서)
  // ── 테스트 기간 동안 PIN 우회 (재활성화 시 아래 주석 해제) ──
  // const cookieStore = await cookies();
  // const pinRaw = cookieStore.get(PIN_COOKIE_NAME)?.value;
  // if (!isPinCookieValid(pinRaw, user.id)) {
  //   redirect('/pin');
  // }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <Link href="/board" className="shrink-0 text-xs font-semibold leading-tight dark:text-slate-100">
            Neuro
            <br />
            Report
          </Link>
          <nav className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 sm:gap-3">
            <Link href="/board">보드</Link>
            <Link
              href="/archive"
              title="아카이브"
              aria-label="아카이브"
              className="text-slate-500 dark:text-slate-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </Link>
          </nav>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <Link
                href="/board/print"
                className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              >
                회진
              </Link>
              <Link
                href="/board/report"
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                일보
              </Link>
              <Link
                href="/mview"
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                m-view
              </Link>
              <Link
                href="/calendar"
                title="캘린더"
                aria-label="캘린더"
                className="rounded-md border border-slate-300 px-1.5 py-1 text-slate-600 dark:border-slate-600 dark:text-slate-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </Link>
              <ThemeToggle />
              <UserMenu
                displayName={profile?.display_name ?? user.email ?? '익명'}
                role={(profile?.role ?? 'user') as 'user' | 'admin'}
              />
            </div>
            <span className="pr-1 text-[9px] text-slate-400 dark:text-slate-600">by W.S Kim</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
      <IdleLock />
    </div>
  );
}
