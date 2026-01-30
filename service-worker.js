const CACHE_NAME = 'maximo-primo-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './languages.js',
    './manifest.json',
    './img/icons8-whatsapp-48.png',
    './img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
