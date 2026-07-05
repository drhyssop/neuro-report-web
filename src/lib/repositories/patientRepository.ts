import type { SupabaseClient } from '@supabase/supabase-js';
import type { PatientCreate, PatientUpdate } from '@/lib/schemas/patient';

/**
 * Spring의 PatientRepository에 해당.
 * 모든 메서드는 SupabaseClient를 주입받음 (서버/클라이언트 양쪽 사용 가능).
 * RLS가 자동으로 user_id 필터를 강제하므로 코드에서 user_id 비교 불필요.
 */
export const patientRepository = {
  // 활성 환자 (입원 중) 목록
  async listActive(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('active', true)
      .order('admitted_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // 아카이브 (퇴원 환자)
  async listArchived(supabase: SupabaseClient, limit = 50) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('active', false)
      .order('discharged_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async findById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(supabase: SupabaseClient, input: PatientCreate, userId: string) {
    const { data, error } = await supabase
      .from('patients')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(supabase: SupabaseClient, id: string, input: PatientUpdate) {
    const { data, error } = await supabase
      .from('patients')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * 입원 시 "기존 증상"(baseline) regions 저장.
   * examinations.regions 와 동일한 ExamRegions 구조의 JSONB.
   */
  async updateBaselineRegions(
    supabase: SupabaseClient,
    id: string,
    baselineRegions: unknown,
  ) {
    const { data, error } = await supabase
      .from('patients')
      .update({ baseline_regions: baselineRegions })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // 퇴원: active=false 로 두고 데이터 보존
  async discharge(supabase: SupabaseClient, id: string, dischargedAt: string) {
    const { data, error } = await supabase
      .from('patients')
      .update({ active: false, discharged_at: dischargedAt })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // 재입원: active 복원
  async readmit(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from('patients')
      .update({ active: true, discharged_at: null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // 영구 삭제 (cascade로 examinations도 함께)
  async remove(supabase: SupabaseClient, id: string) {
    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) throw error;
  },
};
