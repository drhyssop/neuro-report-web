'use client';

import { useState, useTransition } from 'react';
import {
  createUserAction,
  deleteUserAction,
  resetPinAction,
  changeRoleAction,
} from '@/lib/auth/adminActions';

interface Profile {
  user_id: string;
  display_name: string;
  role: 'user' | 'admin';
  pin_set_at: string | null;
  created_at: string;
}

export function AdminUsersClient({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
        >
          {showForm ? '닫기' : '+ 새 계정 등록'}
        </button>
      </div>

      {showForm && <NewUserForm onClose={() => setShowForm(false)} />}

      <div className="space-y-2">
        {profiles.map((p) => (
          <UserRow key={p.user_id} profile={p} isMe={p.user_id === currentUserId} />
        ))}
      </div>
    </div>
  );
}

function NewUserForm({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createUserAction(formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium">새 계정</div>
      <input
        name="display_name"
        placeholder="표시 이름 (예: 김의사)"
        required
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        type="email"
        name="email"
        placeholder="이메일"
        required
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        type="password"
        name="password"
        placeholder="초기 비밀번호 (6자 이상)"
        minLength={6}
        required
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
      <select name="role" defaultValue="user" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
        <option value="user">user (일반)</option>
        <option value="admin">admin (관리자)</option>
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {isPending ? '생성 중…' : '계정 생성'}
      </button>
    </form>
  );
}

function UserRow({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  const [isPending, startTransition] = useTransition();

  function resetPin() {
    if (!confirm(`${profile.display_name}의 PIN을 초기화합니다. 다음 로그인 시 새 PIN을 설정하게 됩니다.`)) return;
    const fd = new FormData();
    fd.set('user_id', profile.user_id);
    startTransition(async () => {
      const r = await resetPinAction(fd);
      if (r?.error) alert(r.error);
    });
  }

  function deleteUser() {
    if (!confirm(`${profile.display_name} 계정과 모든 환자 데이터를 영구 삭제합니다.`)) return;
    if (!confirm('정말 삭제할까요? 복구할 수 없습니다.')) return;
    const fd = new FormData();
    fd.set('user_id', profile.user_id);
    startTransition(async () => {
      const r = await deleteUserAction(fd);
      if (r?.error) alert(r.error);
    });
  }

  function toggleRole() {
    const newRole = profile.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`${profile.display_name}을(를) ${newRole}로 변경합니다.`)) return;
    const fd = new FormData();
    fd.set('user_id', profile.user_id);
    fd.set('role', newRole);
    startTransition(async () => {
      const r = await changeRoleAction(fd);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{profile.display_name}</span>
          {profile.role === 'admin' && (
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">admin</span>
          )}
          {isMe && (
            <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600">나</span>
          )}
        </div>
        <div className="text-[10px] text-slate-400">
          {profile.pin_set_at ? `PIN 설정됨 · ${profile.pin_set_at.slice(0, 10)}` : 'PIN 미설정'}
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-1">
        <button
          type="button"
          onClick={resetPin}
          disabled={isPending}
          className="rounded border border-amber-200 px-2 py-1 text-[10px] text-amber-800 disabled:opacity-40"
        >
          PIN 리셋
        </button>
        {!isMe && (
          <button
            type="button"
            onClick={toggleRole}
            disabled={isPending}
            className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700 disabled:opacity-40"
          >
            {profile.role === 'admin' ? '→user' : '→admin'}
          </button>
        )}
        {!isMe && (
          <button
            type="button"
            onClick={deleteUser}
            disabled={isPending}
            className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-700 disabled:opacity-40"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
