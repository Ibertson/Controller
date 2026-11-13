/* Sobra: abre sem internet. Guarda as telas e os arquivos do app neste aparelho.
   Os dados ficam fora daqui (o app guarda a cópia e a fila de alterações por conta própria). */
const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const CACHE = `sobra-${VERSION}`;
const ROUTES = [
  "/", "/entrar", "/transacoes", "/cartoes", "/extrato", "/contas", "/previsao", "/categorias", "/metas",
  "/fechamento", "/investimentos", "/dividas", "/lembretes", "/veiculos", "/desejos", "/pessoas", "/tutorial",
  "/configuracoes", "/contas/conta", "/contas/conciliacao", "/empresa/fluxo-de-caixa", "/empresa/dre", "/empresa/precificacao", "/empresa/configuracoes", "/empresa/link-bio", "/empresa/produtos", "/empresa/produtos/produto", "/empresa/servicos", "/empresa/servicos/servico", "/empresa/orcamentos", "/empresa/orcamentos/orcamento", "/empresa/estoque", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png",
];
const ASSET = /\/_next\/static\/[^"'\s)\\]+/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  await Promise.all(ROUTES.map(async (path) => {
    try {
      const res = await fetch(path, { cache: "reload" });
      if (!res.ok) return;
      if ((res.headers.get("content-type") || "").includes("text/html")) {
        for (const m of (await res.clone().text()).match(ASSET) || []) assets.add(m);
      }
      await cache.put(path, res);
    } catch { /* sem conexão na instalação: guarda o resto ao navegar */ }
  }));
  await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
}

self.addEventListener("install", (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("sobra-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  // Arquivos com hash no nome nunca mudam: do aparelho primeiro.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Abrir uma tela: da internet quando der (versão nova), senão a cópia guardada.
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, url.pathname).catch(async () =>
      (await caches.match(url.pathname, { cacheName: CACHE })) || (await caches.match("/", { cacheName: CACHE })) || Response.error()));
    return;
  }

  // Dados da navegação do Next (RSC) e demais arquivos do site.
  e.respondWith(networkFirst(req, req).catch(() => Response.error()));
});
