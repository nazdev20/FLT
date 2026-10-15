import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Registration service is not configured.' }, { status: 503 });
  }

  const form = await request.formData();
  const username = String(form.get('username') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const image = form.get('image');

  if (username.length < 2 || username.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 || !(image instanceof File)) {
    return NextResponse.json({ error: 'Provide a valid username, email, password (8+ characters), and image.' }, { status: 400 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be JPEG, PNG, or WebP and no larger than 5 MB.' }, { status: 400 });
  }

  // Password is checked for strength but is deliberately not persisted or sent to Supabase Auth.
  // Approved applicants receive an invitation to set their password securely.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing } = await admin.schema('FLT').from('registration_applications')
    .select('id').eq('email', email).maybeSingle();
  if (existing) return NextResponse.json({ error: 'An application already exists for this email.' }, { status: 409 });

  const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from('registration-proofs')
    .upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: insertError } = await admin.schema('FLT').from('registration_applications')
    .insert({ username, email, image_path: path });
  if (insertError) {
    await admin.storage.from('registration-proofs').remove([path]);
    return NextResponse.json({ error: insertError.code === '23505' ? 'An application already exists for this email.' : insertError.message }, { status: 400 });
  }
  return NextResponse.json({ message: 'Application submitted for admin review. No Auth account has been created yet.' }, { status: 201 });
}