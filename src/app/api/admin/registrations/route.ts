import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function getAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !anon || !token) return null;

  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return null;
  const admin = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'FLT' }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return null;
  return { admin, user };
}

export async function GET(request: Request) {
  const context = await getAdmin(request);
  if (!context) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const { data, error } = await context.admin.schema('FLT').from('registration_applications')
    .select('id, username, email, date_of_birth, image_path, status, rejection_reason, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const applications = await Promise.all((data || []).map(async (item) => {
    const { data: signed } = await context.admin.storage.from('registration-proofs')
      .createSignedUrl(item.image_path, 300);
    return { ...item, image_url: signed?.signedUrl || null };
  }));
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const context = await getAdmin(request);
  if (!context) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const decision = body?.decision;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;
  if (!id || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'A valid application id and decision are required.' }, { status: 400 });
  }

  const { data: application, error: findError } = await context.admin.schema('FLT').from('registration_applications')
    .select('*').eq('id', id).maybeSingle();
  if (findError || !application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (application.status !== 'pending') return NextResponse.json({ error: 'Application has already been reviewed.' }, { status: 409 });

  const { error: updateError } = await context.admin.schema('FLT').from('registration_applications')
    .update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      rejection_reason: decision === 'reject' ? (reason || 'Application declined by admin.') : null,
      reviewed_by: context.user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'pending');
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ message: decision === 'approve' ? 'Application approved. The applicant can now create an account.' : 'Application declined.' });
}