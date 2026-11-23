import { NextResponse, type NextRequest } from 'next/server';
import { db, handle, HttpError, requireAdmin } from '@/lib/server';

const OK = ['image/jpeg', 'image/png', 'image/webp'];
export const POST = handle(async (req: NextRequest) => {
  await requireAdmin();
  const f = (await req.formData()).get('file');
  if (!(f instanceof File)) throw new HttpError(400, 'Arquivo ausente');
  if (!OK.includes(f.type) || f.size > 5 * 1024 * 1024) throw new HttpError(400, 'Use JPG, PNG ou WebP de até 5 MB.');
  const path = `${crypto.randomUUID()}.${f.type.split('/')[1]}`;
  const { error } = await db().storage.from('services').upload(path, await f.arrayBuffer(), { contentType: f.type });
  if (error) throw new HttpError(500, `Storage: ${error.message} (crie o bucket público "services")`);
  return NextResponse.json({ url: db().storage.from('services').getPublicUrl(path).data.publicUrl });
});
