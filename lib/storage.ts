import type { Playlist, PlayerSettings, PlayMode, ThemeMode, SortMode } from "@/app/page"

// 每個播放清單各自記住的狀態：排序模式、目前排序後的影片順序（以 videoId 陣列儲存）、目前播到哪一首
export type PlaylistState = {
  sortMode: SortMode
  order: string[] // 目前排序後的 videoId 順序
  currentVideoId: string | null
}

// 整個 App 的狀態，全部存在「單一檔案」（一個 localStorage key）中
export type AppState = {
  version: number
  playlists: Playlist[]
  currentPlaylistId: string | null
  playlistStates: Record<string, PlaylistState>
  settings: PlayerSettings
  playMode: PlayMode
  theme: ThemeMode
  language: string
}

// 主要的單一儲存 key
const STORAGE_KEY = "yt-randomizer-state-v1"

// 舊版分散的 keys（用於資料遷移，避免既有使用者資料遺失）
const LEGACY_KEYS = {
  playlists: "youtube-playlists",
  currentPlaylist: "youtube-current-playlist",
  currentVideoId: "youtube-current-video-id",
  videoIndex: "youtube-video-index",
  settings: "youtube-settings",
  playMode: "youtube-play-mode",
  theme: "youtube-theme",
  language: "youtube-language",
  sortMode: "youtube-sort-mode",
  sortedVideos: "youtube-sorted-videos",
}

const DEFAULT_SETTINGS: PlayerSettings = {
  defaultQuality: "hd720",
  autoplay: true,
  backgroundPlay: false,
}

// 請求瀏覽器「永久儲存」，避免長時間未造訪時資料被自動清除（解決約 10 天後資料消失的問題）
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false
    // 若已經是永久儲存就不重複請求
    if (navigator.storage.persisted) {
      const already = await navigator.storage.persisted()
      if (already) return true
    }
    const granted = await navigator.storage.persist()
    console.log("[v0] Persistent storage granted:", granted)
    return granted
  } catch (e) {
    console.warn("[v0] requestPersistentStorage failed:", e)
    return false
  }
}

// 讀取整合後的狀態；若不存在則嘗試從舊版分散的 keys 遷移
export function loadState(): Partial<AppState> | null {
  if (typeof window === "undefined") return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as AppState
    }
  } catch (e) {
    console.warn("[v0] Failed to parse consolidated state:", e)
  }

  // 嘗試從舊版分散資料遷移
  return migrateFromLegacy()
}

function migrateFromLegacy(): Partial<AppState> | null {
  if (typeof window === "undefined") return null

  const rawPlaylists = localStorage.getItem(LEGACY_KEYS.playlists)
  if (!rawPlaylists) return null

  try {
    const playlists: Playlist[] = JSON.parse(rawPlaylists)
    const currentPlaylistId = localStorage.getItem(LEGACY_KEYS.currentPlaylist)
    const currentVideoId = localStorage.getItem(LEGACY_KEYS.currentVideoId)
    const sortMode = (localStorage.getItem(LEGACY_KEYS.sortMode) as SortMode) || "original"

    const playlistStates: Record<string, PlaylistState> = {}

    // 將舊版「目前播放清單」的排序順序與位置遷移到 per-playlist 狀態
    if (currentPlaylistId) {
      const current = playlists.find((p) => p.id === currentPlaylistId)
      if (current) {
        let order = current.videos.map((v) => v.videoId)
        const rawSorted = localStorage.getItem(LEGACY_KEYS.sortedVideos)
        if (rawSorted) {
          try {
            const sorted: { videoId: string }[] = JSON.parse(rawSorted)
            if (sorted.length === current.videos.length) {
              order = sorted.map((v) => v.videoId)
            }
          } catch {
            // 忽略，沿用原始順序
          }
        }
        playlistStates[currentPlaylistId] = {
          sortMode,
          order,
          currentVideoId: currentVideoId || (order[0] ?? null),
        }
      }
    }

    const migrated: Partial<AppState> = {
      version: 1,
      playlists,
      currentPlaylistId,
      playlistStates,
      settings: parseJSON(localStorage.getItem(LEGACY_KEYS.settings), DEFAULT_SETTINGS),
      playMode: (localStorage.getItem(LEGACY_KEYS.playMode) as PlayMode) || "normal",
      theme: (localStorage.getItem(LEGACY_KEYS.theme) as ThemeMode) || "dark",
      language: localStorage.getItem(LEGACY_KEYS.language) || "zh-TW",
    }

    console.log("[v0] Migrated legacy storage to consolidated state")
    return migrated
  } catch (e) {
    console.warn("[v0] Legacy migration failed:", e)
    return null
  }
}

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// 將整合後的狀態寫入單一 key
export function saveState(state: AppState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn("[v0] Failed to save state:", e)
  }
}

// 清空所有儲存（含舊版 keys）
export function clearState(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  Object.values(LEGACY_KEYS).forEach((k) => localStorage.removeItem(k))
}

// 依據儲存的 per-playlist 狀態，還原某個播放清單的影片順序與目前位置
export function restorePlaylistOrder(
  playlist: Playlist,
  state: PlaylistState | undefined,
): { videos: Playlist["videos"]; index: number; sortMode: SortMode } {
  if (!state) {
    return { videos: playlist.videos, index: 0, sortMode: "original" }
  }

  const byId = new Map(playlist.videos.map((v) => [v.videoId, v]))
  let ordered = state.order.map((id) => byId.get(id)).filter(Boolean) as Playlist["videos"]

  // 若數量對不上（例如清單已重新整理過），回退到原始順序
  if (ordered.length !== playlist.videos.length) {
    return { videos: playlist.videos, index: 0, sortMode: "original" }
  }

  let index = 0
  if (state.currentVideoId) {
    const i = ordered.findIndex((v) => v.videoId === state.currentVideoId)
    if (i !== -1) index = i
  }

  return { videos: ordered, index, sortMode: state.sortMode ?? "original" }
}
