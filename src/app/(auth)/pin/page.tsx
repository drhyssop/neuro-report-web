import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PinUnlockForm } from '@/components/auth/PinUnlockForm';
import { PinSetupForm } from '@/components/auth/PinSetupForm';

export const dynamic = 'force-dynamic';

export default async function PinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? '/board';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, pin_hash')
    .eq('user_id', user.id)
    .single();

  const hasPin = !!profile?.pin_hash;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.display_name ?? user.email}</p>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">{hasPin ? 'PIN 입력' : 'PIN 설정'}</h1>
        </div>
        {hasPin ? (
          <PinUnlockForm next={next} />
        ) : (
          <PinSetupForm next={next} />
        )}
      </div>
    </main>
  );
}
