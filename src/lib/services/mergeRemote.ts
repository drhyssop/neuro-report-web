import type { ExamRegions } from '@/types/domain';

/**
 * Dirty 필드 추적기.
 * 사용자가 필드를 만지면 (path, timestamp)로 기록.
 * 일정 시간 (기본 5초) 이내의 만짐만 dirty로 간주 — 그보다 오래 전이면 어차피 저장됐을 것
 */
/**
 * Dirty 필드 추적기.
 * 사용자가 필드를 만지면 그 필드는 페이지가 살아있는 동안 영구히 dirty로 유지.
 * 이렇게 해야 다른 기기/탭에서 빈 데이터로 덮어쓰는 사고를 막을 수 있음.
 *
 * 기존 windowMs 옵션은 호환을 위해 유지하지만 무시 (영구 모드).
 */
export class DirtyTracker {
  private touches = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_windowMs = 5000) {
    // windowMs는 호환을 위해 받지만 사용하지 않음 — 페이지 lifetime 동안 영구 dirty
  }

  /** 필드 경로(예: "lumbar.motor.hipFlex.lt")가 만져졌다고 기록 */
  touch(path: string) {
    this.touches.add(path);
  }

  /** 어떤 경로가 dirty인지 — 페이지 lifetime 동안 영구 유지 */
  isDirty(path: string): boolean {
    return this.touches.has(path);
  }

  /** 한 객체 안의 어떤 키든 dirty면 true (재귀 경로 prefix 체크) */
  hasDirtyUnder(pathPrefix: string): boolean {
    for (const path of this.touches) {
      if (path === pathPrefix || path.startsWith(pathPrefix + '.')) return true;
    }
    return false;
  }

  clear() {
    this.touches.clear();
  }
}

/**
 * 원격 변경을 dirty 필드 보호하며 머지.
 *
 * 알고리즘 (재귀):
 *  - leaf 값이면: dirty path면 local 유지, 아니면 remote 채택
 *  - 객체이면: 키별로 재귀
 *  - remote에만 있는 새 키: 추가
 *  - local에만 있는 키: dirty면 유지, 아니면 삭제(원격이 제거한 것으로 간주)
 *
 * "삭제"는 보수적으로 유지 — 본인이 방금 입력했는데 다른 기기 데이터가
 * 안 갖고 있다는 이유로 사라지면 데이터 손실이라 안전 쪽으로
 */
export function mergeRemoteRegions(
  local: ExamRegions,
  remote: ExamRegions,
  dirty: DirtyTracker,
): ExamRegions {
  return mergeRec('', local, remote, dirty) as ExamRegions;
}

function mergeRec(path: string, local: unknown, remote: unknown, dirty: DirtyTracker): unknown {
  // local 쪽이 dirty면 통째로 보호
  if (path && dirty.isDirty(path)) return local;

  if (isPlainObject(local) && isPlainObject(remote)) {
    const out: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const k of keys) {
      const nextPath = path ? `${path}.${k}` : k;
      if (k in local && k in remote) {
        out[k] = mergeRec(nextPath, local[k], remote[k], dirty);
      } else if (k in remote) {
        // remote에만 있음 → 새 변경 흡수
        if (dirty.isDirty(nextPath)) {
          // 거의 일어나지 않음 (방금 만진 키가 remote에 새로 생긴 경우)
          out[k] = local[k as keyof typeof local];
        } else {
          out[k] = remote[k];
        }
      } else {
        // local에만 있음 → 보수적으로 유지
        out[k] = local[k as keyof typeof local];
      }
    }
    return out;
  }

  // leaf
  return remote;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
