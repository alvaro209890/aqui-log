#!/usr/bin/env node
// Servidor estatico minimo para o dashboard do Aqui Log (DEC-26 / OPS-01A).
//
// Por que nao `vite preview`: o proprio Vite avisa que o preview e ferramenta
// de desenvolvimento, nao servidor de producao. Este arquivo nao tem nenhuma
// dependencia (so o core do Node), serve `dist/` e faz o fallback de SPA que o
// `BrowserRouter` do dashboard exige (deep link em /entregas precisa devolver
// index.html em vez de 404).
//
// Uso: node infra/static-server.mjs <diretorio> [porta] [host]

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'apps/dashboard/dist');
const port = Number(process.env.PORT ?? process.argv[3] ?? 3012);
const host = process.env.HOST ?? process.argv[4] ?? '127.0.0.1';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/// Resolve o caminho pedido dentro de `root`, barrando path traversal.
function caminhoSeguro(urlPath) {
  const semQuery = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const alvo = resolve(join(root, normalize(semQuery)));
  if (alvo !== root && !alvo.startsWith(root + sep)) return null;
  return alvo;
}

async function arquivo(caminho) {
  try {
    const info = await stat(caminho);
    if (info.isDirectory()) return arquivo(join(caminho, 'index.html'));
    return info.isFile() ? caminho : null;
  } catch {
    return null;
  }
}

const servidor = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Metodo nao permitido');
    return;
  }

  const pedido = caminhoSeguro(req.url ?? '/');
  if (!pedido) {
    res.writeHead(403).end('Proibido');
    return;
  }

  // Fallback de SPA: rota sem arquivo correspondente devolve o index.html.
  const alvo = (await arquivo(pedido)) ?? (await arquivo(join(root, 'index.html')));
  if (!alvo) {
    res.writeHead(404).end('Nao encontrado');
    return;
  }

  const ext = extname(alvo).toLowerCase();
  // Os bundles do Vite tem hash no nome; o index.html nunca pode ser cacheado,
  // senao o navegador continua pedindo um bundle que o deploy novo apagou.
  const cache = alvo.endsWith('index.html')
    ? 'no-store'
    : 'public, max-age=31536000, immutable';

  res.writeHead(200, {
    'Content-Type': TIPOS[ext] ?? 'application/octet-stream',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(alvo).pipe(res);
});

servidor.listen(port, host, () => {
  process.stdout.write(`Aqui Log dashboard estatico: http://${host}:${port} (raiz ${root})\n`);
});
