import http from 'http';
import https from 'https';
import env from '../../config/env.js';

const TILE_ID = /^\d+$/;

export const proxyMapTile = (req, res) => {
  const z = String(req.params.z || '');
  const x = String(req.params.x || '');
  const y = String(req.params.y || '').replace(/\.png$/i, '');

  if (!TILE_ID.test(z) || !TILE_ID.test(x) || !TILE_ID.test(y)) {
    return res.status(400).end();
  }

  const template = env.mapTileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileUrl = template
    .replace(/\{s\}/g, 'a')
    .replace(/\{r\}/g, '')
    .replace(/\{z\}/g, z)
    .replace(/\{x\}/g, x)
    .replace(/\{y\}/g, y);

  let parsed;
  try {
    parsed = new URL(tileUrl);
  } catch {
    return res.status(500).end();
  }

  const client = parsed.protocol === 'https:' ? https : http;
  const upstream = client.get(
    parsed,
    {
      headers: {
        'User-Agent': 'FleetOS/1.0 (municipal water fleet command)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    },
    (tileRes) => {
      if (tileRes.statusCode >= 400) {
        res.status(tileRes.statusCode).end();
        tileRes.resume();
        return;
      }

      res.set({
        'Content-Type': tileRes.headers['content-type'] || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      tileRes.pipe(res);
    }
  );

  upstream.on('error', () => {
    if (!res.headersSent) res.status(502).end();
  });

  req.on('close', () => upstream.destroy());
};
