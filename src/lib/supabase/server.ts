import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버 컴포넌트 / Route Handler / Server Action에서 사용.
 * Next.js cookies()로 세션을 읽고 갱신한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
                cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출된 경우 무시 (Middleware가 세션 갱신 책임)
          }
        },
      },
    },
  );
}
