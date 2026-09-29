// Réseau d'abord (les mises à jour arrivent au rafraîchissement), cache en secours hors ligne.
const CACHE = "assiette";
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(rep => { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(e.request, copie)); return rep; })
      .catch(() => caches.match(e.request))
  );
});
