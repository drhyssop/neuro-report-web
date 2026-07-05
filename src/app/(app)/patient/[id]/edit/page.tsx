import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { redirect } from 'next/navigation';
import { PatientEditForm } from '@/components/patient/PatientEditForm';

export const dynamic = 'force-dynamic';

export default async function PatientEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const patient = await patientRepository.findById(supabase, id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium dark:text-slate-100">환자 정보 편집</h1>
      <PatientEditForm patientId={id} initial={patient} />
    </div>
  );
}
