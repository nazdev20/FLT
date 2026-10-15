import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Registration service is not configured.' }, { status: 503 });

  const form = await request.formData();
  const username = String(form.get('username') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const image = form.get('image');

  if (username.length < 2 || username.length > 60 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ||
      password.length < 8 || !(image instanceof File)) {
    return NextResponse.json({ error: 'Provide a valid username, email, password (8+ characters), and image.' }, { status: 400 });
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be JPEG, PNG, or WebP and no larger than 5 MB.' }, { status: 400 });
  }

  // Password is validated only; it is never stored before approval.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'FLT' } });
  const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage.from('registration-proofs').upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: insertError } = await client.from('registration_applications').insert({ username, email, image_path: path });
  if (insertError) {
    await client.storage.from('registration-proofs').remove([path]);
    return NextResponse.json({ error: insertError.code === '23505' ? 'An application already exists for this email.' : 'Unable to save the application. Please try again.' }, { status: insertError.code === '23505' ? 409 : 400 });
  }
  return NextResponse.json({ message: 'Application submitted for admin review. No Auth account has been created yet.' }, { status: 201 });
}