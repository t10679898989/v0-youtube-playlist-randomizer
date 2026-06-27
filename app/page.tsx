"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { PlaylistManager } from "@/components/playlist-manager"
import { PlaylistSidebar } from "@/components/playlist-sidebar"
import { VideoPlayer } from "@/components/video-player"
import { VideoList } from "@/components/video-list"
import { AddToCompilationDialog } from "@/components/add-to-compilation-dialog"
import { Coffee, Sun, Moon, ImageIcon, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/translations"

export type Video = {
  videoId: string
  title: string
  thumbnail: string
  channelTitle?: string
  publishedAt?: string
}

export type Playlist = {
  id: string
  name: string
  videos: Video[]
  createdAt: number
}

export type SortMode = "original" | "random" | "name-asc" | "name-desc" | "newest" | "oldest"
export type PlayMode = "normal" | "single-loop"
export type ThemeMode = "light" | "dark" | "thumbnail"

export type PlayerSettings = {
  defaultQuality: string
  autoplay: boolean
  backgroundPlay: boolean
}

// 每個播放清單各自保存的狀態：排序方式、排列順序（以 videoId 陣列表示）、播放到第幾首
export type PerPlaylistState = {
  sortMode: SortMode
  order: string[]
  index: number
  videoId: string | null
}

// 單一狀態檔內容（龐大的影片資料另存於 youtube-playlists）
type StoredPlayerState = {
  currentPlaylistId: string | null
  byPlaylist: Record<string, PerPlaylistState>
  settings: PlayerSettings
  playMode: PlayMode
  theme: ThemeMode
  language: string
}

const PLAYER_STATE_KEY = "youtube-player-state"
const PLAYLISTS_KEY = "youtube-playlists"

// 依照已保存的排列順序（videoId 陣列）重建影片清單
// 已不存在的影片會被略過，清單更新後新增的影片則接在後面
function buildOrderedVideos(playlistVideos: Video[], order?: string[]): Video[] {
  if (!order || order.length === 0) return playlistVideos
  const map = new Map(playlistVideos.map((v) => [v.videoId, v]))
  const ordered = order.map((id) => map.get(id)).filter((v): v is Video => Boolean(v))
  const seen = new Set(order)
  const extras = playlistVideos.filter((v) => !seen.has(v.videoId))
  return [...ordered, ...extras]
}

// 把舊版分散的 localStorage 鍵遷移成新的單一狀態檔，遷移後清除舊鍵
function migrateLegacyState(): StoredPlayerState | null {
  if (typeof window === "undefined") return null

  const curId = localStorage.getItem("youtube-current-playlist")
  const rawSorted = localStorage.getItem("youtube-sorted-videos")
  const rawIndex = localStorage.getItem("youtube-video-index")
  const videoId = localStorage.getItem("youtube-current-video-id")
  const sortMode = localStorage.getItem("youtube-sort-mode")
  const rawSettings = localStorage.getItem("youtube-settings")
  const playMode = localStorage.getItem("youtube-play-mode")
  const theme = localStorage.getItem("youtube-theme")
  const language = localStorage.getItem("youtube-language")

  if (!curId && !rawSettings && !playMode && !theme && !language) {
    return null
  }

  const byPlaylist: Record<string, PerPlaylistState> = {}
  if (curId) {
    let order: string[] = []
    if (rawSorted) {
      try {
        order = (JSON.parse(rawSorted) as Video[]).map((v) => v.videoId)
      } catch {
        order = []
      }
    }
    byPlaylist[curId] = {
      sortMode: (sortMode as SortMode) || "original",
      order,
      index: rawIndex ? Number.parseInt(rawIndex) : 0,
      videoId: videoId || null,
    }
  }

  const state: StoredPlayerState = {
    currentPlaylistId: curId || null,
    byPlaylist,
    settings: rawSettings
      ? JSON.parse(rawSettings)
      : { defaultQuality: "hd720", autoplay: true, backgroundPlay: false },
    playMode: (playMode as PlayMode) || "normal",
    theme: (theme as ThemeMode) || "dark",
    language: language || "zh-TW",
  }

  ;[
    "youtube-current-playlist",
    "youtube-sorted-videos",
    "youtube-video-index",
    "youtube-current-video-id",
    "youtube-sort-mode",
    "youtube-settings",
    "youtube-play-mode",
    "youtube-theme",
    "youtube-language",
  ].forEach((k) => localStorage.removeItem(k))

  return state
}

export default function Home() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [originalVideos, setOriginalVideos] = useState<Video[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>("original")
  const [playMode, setPlayMode] = useState<PlayMode>("normal")
  const [settings, setSettings] = useState<PlayerSettings>({
    defaultQuality: "hd720",
    autoplay: true,
    backgroundPlay: false,
  })
  const [theme, setTheme] = useState<ThemeMode>("dark")
  const [language, setLanguage] = useState<string>("zh-TW")
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [showAddToCompilationDialog, setShowAddToCompilationDialog] = useState(false)
  const { toast } = useToast()

  // 每個播放清單各自的狀態（排序方式 / 排列順序 / 播放位置），跨清單切換時保留
  const byPlaylistRef = useRef<Record<string, PerPlaylistState>>({})
  const [isHydrated, setIsHydrated] = useState(false)

  const t = useTranslation(language)

  // 還原狀態：每個播放清單各自記住排序方式、排列順序與播放到第幾首
  // 注意：hasUserInteracted 故意不還原，每次開啟都從 false 開始，
  // 避免 Watchdog 誤判已互動而在預載時跳歌
  useEffect(() => {
    let parsedPlaylists: Playlist[] = []
    const rawPlaylists = localStorage.getItem(PLAYLISTS_KEY)
    if (rawPlaylists) {
      try {
        parsedPlaylists = JSON.parse(rawPlaylists)
      } catch {
        parsedPlaylists = []
      }
    }

    // 讀取新的單一狀態檔；若不存在則嘗試從舊版分散的鍵遷移
    let state: StoredPlayerState | null = null
    const rawState = localStorage.getItem(PLAYER_STATE_KEY)
    if (rawState) {
      try {
        state = JSON.parse(rawState)
      } catch {
        state = null
      }
    }
    if (!state) {
      state = migrateLegacyState()
    }

    if (parsedPlaylists.length > 0) {
      setPlaylists(parsedPlaylists)
    }

    if (state) {
      if (state.settings) setSettings(state.settings)
      if (state.playMode) setPlayMode(state.playMode)
      if (state.theme) setTheme(state.theme)
      if (state.language) setLanguage(state.language)
      byPlaylistRef.current = state.byPlaylist || {}

      const curId = state.currentPlaylistId
      if (curId) {
        const playlist = parsedPlaylists.find((p) => p.id === curId)
        if (playlist) {
          const saved = byPlaylistRef.current[curId]
          const ordered = buildOrderedVideos(playlist.videos, saved?.order)

          let restoredIndex = 0
          if (saved?.videoId) {
            const foundIndex = ordered.findIndex((v) => v.videoId === saved.videoId)
            if (foundIndex !== -1) {
              restoredIndex = foundIndex
            } else if (typeof saved.index === "number") {
              restoredIndex = Math.min(saved.index, ordered.length - 1)
            }
          } else if (saved && typeof saved.index === "number") {
            restoredIndex = Math.min(saved.index, ordered.length - 1)
          }

          setCurrentPlaylistId(playlist.id)
          setOriginalVideos(playlist.videos)
          setVideos(ordered)
          setCurrentVideoIndex(Math.max(0, restoredIndex))
          if (saved?.sortMode) setSortMode(saved.sortMode)
        }
      }
    }

    setIsHydrated(true)
  }, [])

  // 套用主題的 class（持久化交由統一儲存處理）
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark", "thumbnail")
    root.classList.add(theme)
  }, [theme])

  // 統一儲存：把目前播放清單的排序方式、排列順序與播放位置寫入 byPlaylist，
  // 連同設定 / 播放模式 / 主題 / 語言一起存成單一狀態檔
  const persistPlayerState = useCallback(() => {
    if (currentPlaylistId) {
      byPlaylistRef.current[currentPlaylistId] = {
        sortMode,
        order: videos.map((v) => v.videoId),
        index: currentVideoIndex,
        videoId: videos[currentVideoIndex]?.videoId ?? null,
      }
    }
    const state: StoredPlayerState = {
      currentPlaylistId,
      byPlaylist: byPlaylistRef.current,
      settings,
      playMode,
      theme,
      language,
    }
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state))
  }, [currentPlaylistId, videos, currentVideoIndex, sortMode, settings, playMode, theme, language])

  useEffect(() => {
    if (!isHydrated) return
    persistPlayerState()
  }, [isHydrated, persistPlayerState])

  // 播放清單影片資料較大，單獨存放，僅在清單增刪 / 更新時寫入
  useEffect(() => {
    if (!isHydrated) return
    if (playlists.length > 0) {
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
    } else {
      localStorage.removeItem(PLAYLISTS_KEY)
    }
  }, [playlists, isHydrated])

  const handlePlaylistLoad = async (id: string, name?: string) => {
    console.log("[v0] Loading playlist with ID:", id)

    const existingPlaylist = playlists.find((p) => p.id === id)
    if (existingPlaylist) {
      toast({
        title: t.playlistExists || "播放清單已存在",
        description: t.playlistExistsDesc || "此播放清單已經在列表中",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/playlist?id=${id}`)
      console.log("[v0] API response status:", response.status)

      const data = await response.json()
      console.log("[v0] API response data:", data)

      if (!response.ok) {
        if (response.status === 500 && data.error?.includes("API key")) {
          toast({
            title: t.apiKeyMissing,
            description: t.apiKeyMissingDesc,
            variant: "destructive",
          })
        } else {
          toast({
            title: t.loadFailed,
            description: data.error || t.loadFailedDesc,
            variant: "destructive",
          })
        }
        return
      }

      if (data.videos && data.videos.length > 0) {
        const newPlaylist: Playlist = {
          id: id,
          name: name || `${t.myPlaylists} ${playlists.length + 1}`,
          videos: data.videos,
          createdAt: Date.now(),
        }

        setPlaylists((prev) => [...prev, newPlaylist])
        setCurrentPlaylistId(newPlaylist.id)
        setOriginalVideos(data.videos)
        setVideos(data.videos)
        setCurrentVideoIndex(0)
        setSortMode("original")
        setHasUserInteracted(false)

        toast({
          title: t.playlistLoaded,
          description: t.playlistLoadedDesc.replace("{count}", data.videos.length.toString()),
        })

        console.log("[v0] Playlist loaded successfully:", newPlaylist)
      } else {
        toast({
          title: t.playlistEmpty,
          description: t.playlistEmptyDesc,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error fetching playlist:", error)
      toast({
        title: t.networkError,
        description: t.networkErrorDesc,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlaylistSelect = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist) return

    setCurrentPlaylistId(playlist.id)
    setOriginalVideos(playlist.videos)

    // 還原此播放清單先前保存的排序方式、排列順序與播放位置
    const saved = byPlaylistRef.current[playlistId]
    if (saved) {
      const ordered = buildOrderedVideos(playlist.videos, saved.order)
      let restoredIndex = 0
      if (saved.videoId) {
        const foundIndex = ordered.findIndex((v) => v.videoId === saved.videoId)
        restoredIndex = foundIndex !== -1 ? foundIndex : Math.min(saved.index ?? 0, ordered.length - 1)
      } else if (typeof saved.index === "number") {
        restoredIndex = Math.min(saved.index, ordered.length - 1)
      }
      setVideos(ordered)
      setCurrentVideoIndex(Math.max(0, restoredIndex))
      setSortMode(saved.sortMode ?? "original")
    } else {
      setVideos(playlist.videos)
      setCurrentVideoIndex(0)
      setSortMode("original")
    }

    setHasUserInteracted(false)
  }

  const handlePlaylistRefresh = async (playlistId: string) => {
    // 合輯（compilation）沒有來源 ID 可以重新拉取，跳過
    if (playlistId.startsWith("compilation-")) {
      toast({
        title: t.loadFailed,
        description: "合輯無法更新，請重新建立",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/playlist?id=${playlistId}`)
      const data = await response.json()

      if (!response.ok) {
        toast({
          title: t.loadFailed,
          description: data.error || t.loadFailedDesc,
          variant: "destructive",
        })
        return
      }

      if (data.videos && data.videos.length > 0) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, videos: data.videos } : p
          )
        )

        // 如果目前正在播放這個清單，同步更新影片列表
        if (currentPlaylistId === playlistId) {
          setOriginalVideos(data.videos)
          setVideos(data.videos)
          setCurrentVideoIndex(0)
          setSortMode("original")
        }

        toast({
          title: t.playlistRefreshed,
          description: (t.playlistRefreshedDesc as string).replace("{count}", data.videos.length.toString()),
        })
      } else {
        toast({
          title: t.playlistEmpty,
          description: t.playlistEmptyDesc,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: t.networkError,
        description: t.networkErrorDesc,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlaylistDelete = (playlistId: string) => {
    const updatedPlaylists = playlists.filter((p) => p.id !== playlistId)
    setPlaylists(updatedPlaylists)

    // 移除此播放清單保存的狀態
    delete byPlaylistRef.current[playlistId]

    if (currentPlaylistId === playlistId) {
      // 重置當前播放狀態，後續的狀態變更會觸發 effect 自動寫回
      setCurrentPlaylistId(null)
      setVideos([])
      setOriginalVideos([])
      setCurrentVideoIndex(0)
      setSortMode("original")
      setHasUserInteracted(false)
    } else {
      // 刪除非當前清單時相依的 effect 不會觸發，需手動寫回
      persistPlayerState()
    }

    toast({
      title: t.playlistDeleted || "播放清單已刪除",
      description: t.playlistDeletedDesc || "播放清單已成功刪除",
    })
  }

  const handleCreateCompilation = (selectedPlaylists: string[], name: string) => {
    const selectedVideos = playlists.filter((p) => selectedPlaylists.includes(p.id)).flatMap((p) => p.videos)

    const compilation: Playlist = {
      id: `compilation-${Date.now()}`,
      name: name,
      videos: selectedVideos,
      createdAt: Date.now(),
    }

    setPlaylists((prev) => [...prev, compilation])
    setCurrentPlaylistId(compilation.id)
    setOriginalVideos(selectedVideos)
    setVideos(selectedVideos)
    setCurrentVideoIndex(0)
    setSortMode("original")
  }

  // Add current video to existing compilations
  const handleAddVideoToCompilations = (compilationIds: string[]) => {
    if (videos.length === 0) return
    const currentVideo = videos[currentVideoIndex]
    
    setPlaylists((prev) => 
      prev.map((p) => {
        if (compilationIds.includes(p.id)) {
          // Check if video already exists in compilation
          if (p.videos.some(v => v.videoId === currentVideo.videoId)) {
            return p
          }
          return { ...p, videos: [...p.videos, currentVideo] }
        }
        return p
      })
    )

    const compilationName = playlists.find(p => compilationIds[0] === p.id)?.name || ""
    toast({
      title: t.videoAddedToCompilation,
      description: (t.videoAddedToCompilationDesc as string).replace("{name}", compilationName),
    })
  }

  // Create new compilation with current video
  const handleCreateCompilationWithVideo = (name: string) => {
    if (videos.length === 0) return
    const currentVideo = videos[currentVideoIndex]

    const compilation: Playlist = {
      id: `compilation-${Date.now()}`,
      name: name,
      videos: [currentVideo],
      createdAt: Date.now(),
    }

    setPlaylists((prev) => [...prev, compilation])
    
    toast({
      title: t.compilationCreated,
      description: (t.compilationCreatedDesc as string).replace("{name}", name),
    })
  }

  const applySorting = (mode: SortMode) => {
    let sorted = [...originalVideos]

    switch (mode) {
      case "random":
        sorted = sorted.sort(() => Math.random() - 0.5)
        break
      case "name-asc":
        sorted = sorted.sort((a, b) => a.title.localeCompare(b.title))
        break
      case "name-desc":
        sorted = sorted.sort((a, b) => b.title.localeCompare(a.title))
        break
      case "newest":
        sorted = sorted.sort((a, b) => {
          const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return dateB - dateA
        })
        break
      case "oldest":
        sorted = sorted.sort((a, b) => {
          const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return dateA - dateB
        })
        break
      case "original":
      default:
        sorted = [...originalVideos]
        break
    }

    setVideos(sorted)
    setCurrentVideoIndex(0)
  }

  const handleSortModeChange = (mode: SortMode) => {
    setSortMode(mode)
    applySorting(mode)
  }

  const handleVideoSelect = (index: number) => {
    setCurrentVideoIndex(index)
    setHasUserInteracted(true)
  }

  const handleNext = useCallback(() => {
    if (playMode === "single-loop") return
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length)
  }, [playMode, videos.length])

  const handlePrevious = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev - 1 + videos.length) % videos.length)
  }, [videos.length])

  const handleVideoEnd = useCallback(() => {
    console.log(
      "[v0] handleVideoEnd called, playMode:",
      playMode,
      "autoplay:",
      settings.autoplay,
      "hasUserInteracted:",
      hasUserInteracted,
    )
    if (playMode === "single-loop") return
    if (settings.autoplay && hasUserInteracted) {
      handleNext()
    }
  }, [playMode, settings.autoplay, hasUserInteracted, handleNext])

  const handleThemeToggle = () => {
    const themes: ThemeMode[] = ["light", "dark", "thumbnail"]
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-5 w-5" />
      case "dark":
        return <Moon className="h-5 w-5" />
      case "thumbnail":
        return <ImageIcon className="h-5 w-5" />
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope)
        })
        .catch((err) => console.error("SW registration failed:", err))
    }

    window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])

  return (
    <main className="min-h-screen transition-colors duration-300">
      {theme === "thumbnail" && videos.length > 0 && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 blur-sm"
          style={{
            backgroundImage: `url(${videos[currentVideoIndex]?.thumbnail})`,
          }}
        />
      )}

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {playlists.length > 0 && (
                <PlaylistSidebar
                  playlists={playlists}
                  currentPlaylistId={currentPlaylistId}
                  onPlaylistLoad={handlePlaylistLoad}
                  onPlaylistSelect={handlePlaylistSelect}
                  onPlaylistDelete={handlePlaylistDelete}
                  onPlaylistRefresh={handlePlaylistRefresh}
                  onCreateCompilation={handleCreateCompilation}
                  isLoading={isLoading}
                  language={language}
                />
              )}
              <Button variant="outline" size="sm" className="gap-2 bg-background/80 backdrop-blur-sm" asChild>
                <a href="https://ytplaylistcoffee.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <Coffee className="h-4 w-4" />
                  {t.buyMeCoffee}
                </a>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm">
                    <Globe className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLanguage("zh-TW")}>{t.langZhTW}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage("en")}>{t.langEn}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage("ja")}>{t.langJa}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="icon"
                onClick={handleThemeToggle}
                title={theme === "light" ? t.themeLight : theme === "dark" ? t.themeDark : t.themeThumbnail}
                className="bg-background/80 backdrop-blur-sm"
              >
                {getThemeIcon()}
              </Button>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-chart-3 to-chart-1 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-muted-foreground text-lg">{t.subtitle}</p>
          </div>
        </div>

        {/* Show PlaylistManager only when no playlists exist (first time user) */}
        {playlists.length === 0 && (
          <PlaylistManager
            playlists={playlists}
            currentPlaylistId={currentPlaylistId}
            onPlaylistLoad={handlePlaylistLoad}
            onPlaylistSelect={handlePlaylistSelect}
            onPlaylistDelete={handlePlaylistDelete}
            onPlaylistRefresh={handlePlaylistRefresh}
            onCreateCompilation={handleCreateCompilation}
            isLoading={isLoading}
            language={language}
          />
        )}

        {videos.length > 0 && (
          <div className="mt-8 space-y-6">
            <VideoPlayer
              video={videos[currentVideoIndex]}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onVideoEnd={handleVideoEnd}
              currentIndex={currentVideoIndex}
              totalVideos={videos.length}
              sortMode={sortMode}
              onSortModeChange={handleSortModeChange}
              playMode={playMode}
              onPlayModeChange={setPlayMode}
              settings={settings}
              onSettingsChange={setSettings}
              language={language}
              hasUserInteracted={hasUserInteracted}
              onUserInteraction={() => setHasUserInteracted(true)}
              onAddToCompilation={() => setShowAddToCompilationDialog(true)}
            />
            <VideoList
              videos={videos}
              currentIndex={currentVideoIndex}
              onVideoSelect={handleVideoSelect}
              language={language}
            />
          </div>
        )}

        {/* Add to Compilation Dialog */}
        {videos.length > 0 && (
          <AddToCompilationDialog
            open={showAddToCompilationDialog}
            onOpenChange={setShowAddToCompilationDialog}
            video={videos[currentVideoIndex]}
            playlists={playlists}
            onAddToCompilation={handleAddVideoToCompilations}
            onCreateCompilation={handleCreateCompilationWithVideo}
            language={language}
          />
        )}
      </div>
    </main>
  )
}
