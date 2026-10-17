import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function ageOnDate(dateOfBirth: string, today = new Date()) {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== dateOfBirth) return -1;
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Registration service is not configured.' }, { status: 503 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'Invalid registration form.' }, { status: 400 }); }

  const username = String(form.get('username') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const dateOfBirth = String(form.get('date_of_birth') || '');
  const password = String(form.get('password') || '');
  const image = form.get('image');

  if (username.length < 2 || username.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 || ageOnDate(dateOfBirth) < 0 || !(image instanceof File)) {
    return NextResponse.json({ error: 'Provide a valid username, email, date of birth, password (8+ characters), and ID image.' }, { status: 400 });
  }
  if (ageOnDate(dateOfBirth) < 18) {
    return NextResponse.json({ error: 'You must be at least 18 years old to apply.' }, { status: 400 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size === 0 || image.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'ID image must be JPEG, PNG, or WebP and no larger than 5 MB.' }, { status: 400 });
  }

  // Password is validated only and intentionally discarded; never persist it.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'FLT' } });
  const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage.from('registration-proofs').upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: 'Unable to upload ID image. Check the registration storage policy.' }, { status: 500 });

  const { error: insertError } = await client.from('registration_applications').insert({
    username,
    email,
    date_of_birth: dateOfBirth,
    image_path: path,
  });
  if (insertError) {
    await client.storage.from('registration-proofs').remove([path]);
    return NextResponse.json({ error: insertError.code === '23505' ? 'An application already exists for this email.' : 'Unable to save the application. Please try again.' }, { status: insertError.code === '23505' ? 409 : 400 });
  }
  return NextResponse.json({ message: 'Application submitted for admin review. Your password was not saved and no Auth account has been created.' }, { status: 201 });
}
