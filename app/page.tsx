"use client"

import { useState, useEffect, useCallback } from "react"
import { PlaylistManager } from "@/components/playlist-manager"
import { VideoPlayer } from "@/components/video-player"
import { VideoList } from "@/components/video-list"
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
  const { toast } = useToast()

  const t = useTranslation(language)

  useEffect(() => {
    const savedPlaylists = localStorage.getItem("youtube-playlists")
    const savedCurrentPlaylist = localStorage.getItem("youtube-current-playlist")
    const savedVideoId = localStorage.getItem("youtube-current-video-id")
    const savedVideoIndex = localStorage.getItem("youtube-video-index")
    const savedSettings = localStorage.getItem("youtube-settings")
    const savedPlayMode = localStorage.getItem("youtube-play-mode")
    const savedTheme = localStorage.getItem("youtube-theme")
    const savedLanguage = localStorage.getItem("youtube-language")
    const savedSortMode = localStorage.getItem("youtube-sort-mode")
    const savedSortedVideos = localStorage.getItem("youtube-sorted-videos")
    // 注意：hasUserInteracted 故意不從 localStorage 讀回
    // 每次開啟網頁都從 false 開始，避免 Watchdog 誤判已互動而在預載時跳歌

    if (savedPlaylists) {
      const parsedPlaylists = JSON.parse(savedPlaylists)
      setPlaylists(parsedPlaylists)

      if (savedCurrentPlaylist) {
        const playlist = parsedPlaylists.find((p: Playlist) => p.id === savedCurrentPlaylist)
        if (playlist) {
          setCurrentPlaylistId(playlist.id)
          setOriginalVideos(playlist.videos)

          let restoredVideos: Video[] = playlist.videos
          let restoredIndex = 0

          if (savedSortedVideos) {
            try {
              const parsedSortedVideos = JSON.parse(savedSortedVideos)
              if (parsedSortedVideos.length === playlist.videos.length) {
                restoredVideos = parsedSortedVideos
              }
            } catch (e) {
              console.warn("[v0] Failed to parse sorted videos, using original order")
            }
          }

          if (savedVideoId) {
            const foundIndex = restoredVideos.findIndex((v: Video) => v.videoId === savedVideoId)
            if (foundIndex !== -1) {
              restoredIndex = foundIndex
            } else if (savedVideoIndex) {
              restoredIndex = Math.min(Number.parseInt(savedVideoIndex), restoredVideos.length - 1)
            }
          } else if (savedVideoIndex) {
            restoredIndex = Math.min(Number.parseInt(savedVideoIndex), restoredVideos.length - 1)
          }

          setVideos(restoredVideos)
          setCurrentVideoIndex(restoredIndex)
        }
      }
    }

    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }

    if (savedPlayMode) {
      setPlayMode(savedPlayMode as PlayMode)
    }

    if (savedTheme) {
      setTheme(savedTheme as ThemeMode)
    }

    if (savedLanguage) {
      setLanguage(savedLanguage as string)
    }

    if (savedSortMode) {
      setSortMode(savedSortMode as SortMode)
    }
  }, [])

  useEffect(() => {
    if (playlists.length > 0) {
      localStorage.setItem("youtube-playlists", JSON.stringify(playlists))
    } else {
      localStorage.removeItem("youtube-playlists")
      localStorage.removeItem("youtube-current-playlist")
      localStorage.removeItem("youtube-sorted-videos")
      localStorage.removeItem("youtube-current-video-id")
    }
  }, [playlists])

  useEffect(() => {
    if (currentPlaylistId) {
      localStorage.setItem("youtube-current-playlist", currentPlaylistId)
    }
  }, [currentPlaylistId])

  useEffect(() => {
    localStorage.setItem("youtube-video-index", currentVideoIndex.toString())
  }, [currentVideoIndex])

  useEffect(() => {
    if (videos.length > 0 && videos[currentVideoIndex]) {
      localStorage.setItem("youtube-current-video-id", videos[currentVideoIndex].videoId)
    }
  }, [currentVideoIndex, videos])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark", "thumbnail")
    root.classList.add(theme)
    localStorage.setItem("youtube-theme", theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem("youtube-language", language)
  }, [language])

  useEffect(() => {
    if (videos.length > 0) {
      localStorage.setItem("youtube-sorted-videos", JSON.stringify(videos))
    }
  }, [videos])

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
    if (playlist) {
      setCurrentPlaylistId(playlist.id)
      setOriginalVideos(playlist.videos)
      setVideos(playlist.videos)
      setCurrentVideoIndex(0)
      setSortMode("original")
      setHasUserInteracted(false)
    }
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

    if (currentPlaylistId === playlistId) {
      setCurrentPlaylistId(null)
      setVideos([])
      setOriginalVideos([])
      setCurrentVideoIndex(0)
      setSortMode("original")
      setHasUserInteracted(false)
      localStorage.removeItem("youtube-current-playlist")
      localStorage.removeItem("youtube-sorted-videos")
      localStorage.removeItem("youtube-video-index")
      localStorage.removeItem("youtube-sort-mode")
      localStorage.removeItem("youtube-current-video-id")
    }

    if (updatedPlaylists.length > 0) {
      localStorage.setItem("youtube-playlists", JSON.stringify(updatedPlaylists))
    } else {
      localStorage.removeItem("youtube-playlists")
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
    if (sorted.length > 0) {
      localStorage.setItem("youtube-current-video-id", sorted[0].videoId)
    }
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
            <Button variant="outline" size="sm" className="gap-2 bg-background/80 backdrop-blur-sm" asChild>
              <a href="https://ytplaylistcoffee.vercel.app/" target="_blank" rel="noopener noreferrer">
                <Coffee className="h-4 w-4" />
                {t.buyMeCoffee}
              </a>
            </Button>

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
            />
            <VideoList
              videos={videos}
              currentIndex={currentVideoIndex}
              onVideoSelect={handleVideoSelect}
              language={language}
            />
          </div>
        )}
      </div>
    </main>
  )
}
