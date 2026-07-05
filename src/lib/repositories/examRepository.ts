import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExamRegions } from '@/types/domain';

/**
 * 검사 데이터 저장소.
 * 핵심 메서드는 getOrCreateForToday — 오늘자 검사가 없으면 어제값을 복사해 새로 만든다.
 * 이것이 "퇴원 전까지 환자정보 유지" 요구사항의 구현체.
 */
export const examRepository = {
  async findByPatient(supabase: SupabaseClient, patientId: string, limit = 30) {
    const { data, error } = await supabase
      .from('examinations')
      .select('*')
      .eq('patient_id', patientId)
      .order('exam_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  /**
   * 여러 환자의 최근 exam을 한 번의 쿼리로 가져와 환자별 Map으로 그룹핑.
   * N+1 쿼리(환자 수만큼 findByPatient 반복)를 대체.
   * 반환된 각 배열은 exam_date 내림차순 정렬되어 있으므로, 호출부에서 slice(0, N) 하면 됨.
   */
  async findRecentForPatients(
    supabase: SupabaseClient,
    patientIds: string[],
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const map = new Map<string, Record<string, unknown>[]>();
    if (patientIds.length === 0) return map;
    const { data, error } = await supabase
      .from('examinations')
      .select('*')
      .in('patient_id', patientIds)
      .order('exam_date', { ascending: false });
    if (error) throw error;
    for (const e of (data ?? []) as Record<string, unknown>[]) {
      const pid = e.patient_id as string;
      const arr = map.get(pid);
      if (arr) arr.push(e);
      else map.set(pid, [e]);
    }
    return map;
  },

  async findByDate(supabase: SupabaseClient, patientId: string, date: string) {
    const { data, error } = await supabase
      .from('examinations')
      .select('*')
      .eq('patient_id', patientId)
      .eq('exam_date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * 핵심 메서드: 오늘자 검사를 가져오거나, 없으면 가장 최근 검사를 복사해서 생성.
   *
   * - 어제 입력값이 그대로 채워진 채로 화면 진입
   * - 사용자가 변경한 항목만 update하면 됨
   * - 첫 입원이라면 빈 regions로 시작
   */
  async getOrCreateForToday(
    supabase: SupabaseClient,
    patientId: string,
    userId: string,
    today: string,
  ) {
    const existing = await this.findByDate(supabase, patientId, today);

    // 1) 오늘자가 이미 있고 내용이 채워져 있으면 즉시 반환 (재방문 시 1쿼리로 끝).
    if (existing) {
      const existingEmpty =
        !existing.regions || Object.keys(existing.regions as object).length === 0;
      if (!existingEmpty) return existing;
    }

    // 여기부터는 시드가 필요한 경우에만 (오늘자 없음 또는 빈 row 보정).
    // 2) 가장 최근 검사 + baseline 조회 (시드용)
    const { data: recent } = await supabase
      .from('examinations')
      .select('regions')
      .eq('patient_id', patientId)
      .lt('exam_date', today)
      .order('exam_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: patient } = await supabase
      .from('patients')
      .select('admitted_at, baseline_regions')
      .eq('id', patientId)
      .single();

    // 시드 regions 결정:
    //   - 이전 검사가 있으면 그 값을 이어받음 (어제 상태에서 시작)
    //   - 첫 입원이면 입원 시 baseline 복사
    const seedRegions = (recent?.regions ??
      (patient?.baseline_regions as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;
    const seedHasContent = Object.keys(seedRegions).length > 0;

    // 오늘자 빈 row 보정: 비어있고 시드가 있으면 직전값으로 채운다. reviewed_at은 유지.
    if (existing) {
      if (seedHasContent) {
        const { data, error } = await supabase
          .from('examinations')
          .update({ regions: seedRegions })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      return existing;
    }

    // 3) hospital_day 계산
    const hospitalDay = patient
      ? Math.floor(
          (new Date(today).getTime() - new Date(patient.admitted_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    // 4) 오늘자 row 생성 (시드 채워서)
    const { data, error } = await supabase
      .from('examinations')
      .insert({
        patient_id: patientId,
        user_id: userId,
        exam_date: today,
        hospital_day: hospitalDay,
        regions: seedRegions,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * 검사 데이터 부분 업데이트.
   * regions는 통째로 교체 (낙관적 동시성: updated_at 비교 가능하지만 단순화)
   * 저장은 사용자의 명시적 입력으로만 발생하므로(마운트 시 빈 폼 자동채움 제외),
   * 저장 시점에 reviewed_at을 찍어 "오늘 회진에서 확인함"으로 표시한다.
   */
  async updateRegions(
    supabase: SupabaseClient,
    examId: string,
    regions: ExamRegions,
    generatedNote?: string,
    markReviewed = true,
  ) {
    const patch: Record<string, unknown> = { regions, generated_note: generatedNote ?? null };
    // 마운트 시 빈 폼 자동채움(autoInit)은 회진 확인으로 치지 않는다.
    if (markReviewed) patch.reviewed_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('examinations')
      .update(patch)
      .eq('id', examId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * "변화 없음" — regions 변경 없이 회진 확인만 기록.
   * 의사가 환자를 봤고 어제와 동일하다고 확인했을 때 사용.
   */
  async markReviewed(supabase: SupabaseClient, examId: string) {
    const { data, error } = await supabase
      .from('examinations')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', examId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // 특정 부위만 업데이트 (JSONB merge)
  async updateRegion<K extends keyof ExamRegions>(
    supabase: SupabaseClient,
    examId: string,
    region: K,
    data: ExamRegions[K],
  ) {
    // 기존 regions 가져와서 merge 후 저장
    const { data: current, error: e1 } = await supabase
      .from('examinations')
      .select('regions')
      .eq('id', examId)
      .single();
    if (e1) throw e1;

    const merged = { ...(current.regions as ExamRegions), [region]: data };

    const { data: updated, error: e2 } = await supabase
      .from('examinations')
      .update({ regions: merged })
      .eq('id', examId)
      .select()
      .single();
    if (e2) throw e2;
    return updated;
  },

  /**
   * v2 컬럼 (fever, antibiotics, drains, followup_imaging, pod) 업데이트.
   * 부분 업데이트 — patch만 보내면 됨.
   */
  async updateExtras(
    supabase: SupabaseClient,
    examId: string,
    patch: {
      fever?: boolean;
      fever_temp?: number | null;
      antibiotics?: string[];
      drains?: unknown[];
      drain_outputs?: Record<string, number>;
      followup_imaging?: unknown[];
      pod?: number | null;
      daily_note?: string | null;
      labs?: import('@/types/domainV2').Labs;
    },
  ) {
    const { data, error } = await supabase
      .from('examinations')
      .update(patch)
      .eq('id', examId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
