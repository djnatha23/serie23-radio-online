const STATUS_URL = process.env.RADIO_STATUS_URL || 'https://c32.radioboss.fm:8884/status-json.xsl';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function asSources(data) {
  const source = data?.icestats?.source;
  if (Array.isArray(source)) return source;
  return source ? [source] : [];
}

function parseStatus(raw) {
  try {
    const data = JSON.parse(raw);
    const sources = asSources(data);
    const source = sources.find(item => item.mount === '/stream' || item.mount === '/live') || sources[0];
    const listeners = Number(source?.listeners ?? data?.icestats?.listeners);
    return {
      listeners,
      title: source?.title || source?.yp_currently_playing || '',
      online: Number.isFinite(listeners)
    };
  } catch (error) {
    const listenersMatch = raw.match(/<listeners[^>]*>(\d+)<\/listeners>/i) || raw.match(/listeners=["'](\d+)["']/i);
    const titleMatch = raw.match(/<title[^>]*>([^<]*)<\/title>/i);
    const listeners = listenersMatch ? Number(listenersMatch[1]) : NaN;
    return {
      listeners,
      title: titleMatch ? titleMatch[1].trim() : '',
      online: Number.isFinite(listeners)
    };
  }
}

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405);
  }

  try {
    const response = await fetch(STATUS_URL, {
      headers: { accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`Estado de radio: ${response.status}`);

    const status = parseStatus(await response.text());
    return json({
      listeners: status.online ? Math.max(0, Math.round(status.listeners)) : null,
      title: status.title,
      online: status.online,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error consultando audiencia:', error);
    return json({
      listeners: null,
      title: '',
      online: false,
      updatedAt: new Date().toISOString()
    });
  }
};
