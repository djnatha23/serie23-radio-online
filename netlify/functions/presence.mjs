import { getStore } from '@netlify/blobs';

const store = getStore('serie23-presence');
const PRESENCE_PREFIX = 'visitors/';
const ACTIVE_FOR_MS = 60_000;
const MAX_ID_LENGTH = 160;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function validId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH && /^[a-zA-Z0-9:_-]+$/.test(value);
}

async function countActiveVisitors(now = Date.now()) {
  const { blobs } = await store.list({ prefix: PRESENCE_PREFIX });
  const active = [];
  const expired = [];

  await Promise.all(blobs.map(async ({ key }) => {
    const visitor = await store.get(key, { type: 'json' });
    const lastSeen = Number(visitor?.lastSeen);
    if (Number.isFinite(lastSeen) && now - lastSeen < ACTIVE_FOR_MS) {
      active.push(key);
    } else {
      expired.push(key);
    }
  }));

  if (expired.length) {
    await Promise.all(expired.map(key => store.delete(key)));
  }

  return active.length;
}

export default async (request) => {
  try {
    if (request.method !== 'POST') {
      return json({ error: 'Método no permitido' }, 405);
    }

    const body = await request.json();
    if (!validId(body?.id)) {
      return json({ error: 'Identificador inválido' }, 400);
    }

    const now = Date.now();
    await store.setJSON(`${PRESENCE_PREFIX}${body.id}`, {
      lastSeen: now,
      updatedAt: new Date(now).toISOString()
    });

    return json({
      visitors: await countActiveVisitors(now),
      updatedAt: new Date(now).toISOString()
    });
  } catch (error) {
    console.error('Error registrando presencia:', error);
    return json({ error: 'No se pudo actualizar la presencia' }, 500);
  }
};
