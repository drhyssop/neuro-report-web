import type { SupabaseClient } from '@supabase/supabase-js';

export interface Holiday {
  date: string; // YYYY-MM-DD
  label: string | null;
}

export const holidayRepository = {
  async listAll(supabase: SupabaseClient): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from('holidays')
      .select('date, label')
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Holiday[];
  },

  /** 수동 등록 공휴일 날짜 Set (회진일 계산용) */
  async loadSet(supabase: SupabaseClient): Promise<Set<string>> {
    const rows = await this.listAll(supabase);
    return new Set(rows.map((r) => r.date));
  },

  async add(supabase: SupabaseClient, date: string, label: string) {
    const { error } = await supabase.from('holidays').upsert({ date, label });
    if (error) throw error;
  },

  async remove(supabase: SupabaseClient, date: string) {
    const { error } = await supabase.from('holidays').delete().eq('date', date);
    if (error) throw error;
  },
};
