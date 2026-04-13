/* ===============================
   YouTube 隨機播放器 PWA Service Worker
   - Cache + 通知控制按鈕(NEXT/TOGGLE/PREV)
   =============================== */

const CACHE_VERSION = "v5" // ← 改版本號可強制更新快取
const CACHE_NAME = `yt-randomizer-${CACHE_VERSION}`

const CORE_ASSETS = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.ico"]

/* 安裝：快取核心資源 */
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)))
  self.skipWaiting()
})

/* 啟用：清掉舊版快取 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))),
  )
  self.clients.claim()
})

/* 擷取：HTML 網路優先，其它快取優先 */
self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)

  if (req.method !== "GET" || url.origin !== self.location.origin) return

  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/index.html"))),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone))
          return res
        })
        .catch(() => cached)
    }),
  )
})

/* 訊息：版本切換 & 顯示/關閉通知 */
self.addEventListener("message", (event) => {
  const data = event.data || {}

  if (data === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }

  if (data.type === "SHOW_NOTIFICATION") {
    const { title, body, icon, tag } = data
    event.waitUntil(
      (async () => {
        // 先關閉同 tag 的舊通知，避免重複
        const existing = await self.registration.getNotifications({ tag: tag || "ytplayer-controls" })
        existing.forEach((n) => n.close())

        await self.registration.showNotification(title || "Now Playing", {
          body: body || "",
          icon: icon || "/icons/icon-192.png",
          badge: icon || "/icons/icon-192.png",
          tag: tag || "ytplayer-controls",
          renotify: true,
          requireInteraction: true, // 常駐
          actions: [
            { action: "prev", title: "上一首" },
            { action: "toggle", title: "播放/暫停" },
            { action: "next", title: "下一首" },
          ],
          data: { _from: "sw" },
          silent: true,
        })
      })(),
    )
    return
  }

  if (data.type === "CLOSE_NOTIFICATION") {
    event.waitUntil(
      self.registration.getNotifications({ tag: "ytplayer-controls" }).then((list) => {
        list.forEach((n) => n.close())
      }),
    )
  }
})

/* 點擊通知動作按鈕 → 丟訊息給已開啟的分頁（VideoPlayer 已監聽） */
self.addEventListener("notificationclick", (event) => {
  const action = event.action // prev / toggle / next
  event.notification.close()

  const payload = action === "next" ? { type: "NEXT" } : action === "prev" ? { type: "PREV" } : { type: "TOGGLE" }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients && clients.length) {
        clients[0].postMessage(payload)
        // 不強制 focus，避免擾民；需要可改成 clients[0].focus()
      } else {
        // 沒有開啟中的分頁，可視需求開新頁
        return self.clients.openWindow("/")
      }
    }),
  )
})
