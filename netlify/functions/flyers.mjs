import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const store = getStore('serie23-flyers');
const ADMIN_CODE = process.env.FLYER_ADMIN_CODE || 'serie23';
const MAX_IMAGE_LENGTH = 2_500_000;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function isAuthorized(request) {
  return request.headers.get('x-flyer-admin-code') === ADMIN_CODE;
}

async function listFlyers() {
  const { blobs } = await store.list({ prefix: 'flyers/' });
  const items = await Promise.all(
    blobs.map(({ key }) => store.get(key, { type: 'json' }))
  );
  return items
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export default async (request) => {
  const url = new URL(request.url);

  try {
    if (request.method === 'GET') {
      return json({ flyers: await listFlyers() });
    }

    if (!isAuthorized(request)) {
      return json({ error: 'No autorizado' }, 401);
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const image = typeof body.image === 'string' ? body.image : '';

      if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(image)) {
        return json({ error: 'Imagen inválida' }, 400);
      }
      if (image.length > MAX_IMAGE_LENGTH) {
        return json({ error: 'La imagen es demasiado grande' }, 400);
      }

      const flyer = {
        id: randomUUID(),
        image,
        order: Date.now(),
        createdAt: new Date().toISOString()
      };
      await store.setJSON(`flyers/${flyer.id}`, flyer);
      return json({ flyer }, 201);
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');

      if (id === 'all') {
        const { blobs } = await store.list({ prefix: 'flyers/' });
        await Promise.all(blobs.map(({ key }) => store.delete(key)));
        return json({ deleted: blobs.length });
      }

      if (!id || !/^[\w-]+$/.test(id)) {
        return json({ error: 'ID inválido' }, 400);
      }
      await store.delete(`flyers/${id}`);
      return json({ ok: true });
    }

    return json({ error: 'Método no permitido' }, 405);
  } catch (error) {
    console.error('Error en función flyers:', error);
    return json({ error: 'Error interno del servidor' }, 500);
  }
};
