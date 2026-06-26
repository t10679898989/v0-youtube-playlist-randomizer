"use client"

import { useRef, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SkipBack, SkipForward, Repeat1, Repeat, Plus } from "lucide-react"
import type { Video, SortMode, PlayerSettings, PlayMode } from "@/app/page"
import { SortSelector } from "@/components/sort-selector"
import { useTranslation } from "@/lib/translations"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface VideoPlayerProps {
  video: Video
  onNext: () => void
  onPrevious: () => void
  onVideoEnd: () => void
  currentIndex: number
  totalVideos: number
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  playMode: PlayMode
  onPlayModeChange: (mode: PlayMode) => void
  settings: PlayerSettings
  onSettingsChange: (settings: PlayerSettings) => void
  language: string
  hasUserInteracted: boolean
  onUserInteraction: () => void
  onAddToCompilation: () => void
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export function VideoPlayer({
  video,
  onNext,
  onPrevious,
  onVideoEnd,
  currentIndex,
  totalVideos,
  sortMode,
  onSortModeChange,
  playMode,
  onPlayModeChange,
  settings,
  onSettingsChange,
  language,
  hasUserInteracted,
  onUserInteraction,
  onAddToCompilation,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [mediaArt, setMediaArt] = useState(`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`)
  const [isPlaying, setIsPlaying] = useState(false)
  const watchdogRef = useRef<number | null>(null)
  const nextLockRef = useRef<number>(0)
  const stallCheckRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const t = useTranslation(language)

  // 用 ref 保存最新的回呼與狀態，讓 player 閉包永遠能讀到最新值
  const playModeRef = useRef(playMode)
  const onVideoEndRef = useRef(onVideoEnd)
  const onNextRef = useRef(onNext)
  const onPreviousRef = useRef(onPrevious)
  const hasUserInteractedRef = useRef(hasUserInteracted)
  const onUserInteractionRef = useRef(onUserInteraction)

  useEffect(() => { playModeRef.current = playMode }, [playMode])
  useEffect(() => { onVideoEndRef.current = onVideoEnd }, [onVideoEnd])
  useEffect(() => { onNextRef.current = onNext }, [onNext])
  useEffect(() => { onPreviousRef.current = onPrevious }, [onPrevious])
  useEffect(() => { hasUserInteractedRef.current = hasUserInteracted }, [hasUserInteracted])
  useEffect(() => { onUserInteractionRef.current = onUserInteraction }, [onUserInteraction])

  const safeNext = () => {
    const now = Date.now()
    if (now - nextLockRef.current < 1500) {
      console.log("[v0] safeNext blocked by debounce")
      return
    }
    nextLockRef.current = now
    console.log("[v0] safeNext triggered")
    onVideoEndRef.current()
  }

  const postToIframe = (func: "playVideo" | "pauseVideo") => {
    const iframe = containerRef.current?.querySelector("iframe") as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*")
    }
  }

  // 更新系統媒體通知的播放狀態與進度，讓切到背景後通知能持續存在
  const updateMediaSessionState = (state: "playing" | "paused") => {
    if (!("mediaSession" in navigator)) return
    try {
      navigator.mediaSession.playbackState = state
      const p = playerRef.current
      const duration = p?.getDuration?.() || 0
      const position = p?.getCurrentTime?.() || 0
      if (duration > 0 && position <= duration) {
        navigator.mediaSession.setPositionState?.({
          duration,
          position,
          playbackRate: 1,
        })
      }
    } catch (e) {
      console.log("[v0] updateMediaSessionState failed:", e)
    }
  }

  const togglePlayPause = () => {
    const YT = window.YT
    const state = playerRef.current?.getPlayerState?.()
    const playing = (YT && (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING)) || isPlaying
    if (playing) postToIframe("pauseVideo")
    else postToIframe("playVideo")
  }

  const watchdogRecoveryRef = useRef<number | null>(null)

  const clearWatchdog = () => {
    if (watchdogRef.current !== null) {
      window.clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
    if (watchdogRecoveryRef.current !== null) {
      window.clearTimeout(watchdogRecoveryRef.current)
      watchdogRecoveryRef.current = null
    }
  }

  const startWatchdog = () => {
    // 方案B：未互動前不啟動 Watchdog，避免預載時誤跳歌
    if (!hasUserInteractedRef.current) return
    clearWatchdog()
    const start = Date.now()
    watchdogRef.current = window.setInterval(() => {
      const p = playerRef.current
      const YT = window.YT
      if (!p || !YT) return
      const st = p.getPlayerState?.()
      if (st === YT.PlayerState.PLAYING || st === YT.PlayerState.BUFFERING) {
        clearWatchdog()
        return
      }
      // 5 秒後先嘗試 Stall Check 恢復，而不是直接跳歌
      if (Date.now() - start > 5000 && watchdogRecoveryRef.current === null) {
        console.log("[v0] Watchdog 5s timeout - attempting recovery via playVideo")
        postToIframe("playVideo")
        // 再等 2 秒，若仍未播放才跳歌
        watchdogRecoveryRef.current = window.setTimeout(() => {
          watchdogRecoveryRef.current = null
          const stAfter = playerRef.current?.getPlayerState?.()
          const YTNow = window.YT
          if (!YTNow) return
          if (stAfter === YTNow.PlayerState.PLAYING || stAfter === YTNow.PlayerState.BUFFERING) {
            console.log("[v0] Watchdog recovery succeeded")
            clearWatchdog()
          } else {
            console.log("[v0] Watchdog recovery failed - skipping to next")
            clearWatchdog()
            onNextRef.current()
          }
        }, 2000)
      }
    }, 500)
  }

  const clearStallCheck = () => {
    if (stallCheckRef.current !== null) {
      window.clearInterval(stallCheckRef.current)
      stallCheckRef.current = null
    }
  }

  const startStallCheck = () => {
    clearStallCheck()
    lastTimeRef.current = playerRef.current?.getCurrentTime?.() || 0
    stallCheckRef.current = window.setInterval(() => {
      const p = playerRef.current
      const YT = window.YT
      if (!p || !YT) return

      const st = p.getPlayerState?.()
      if (st !== YT.PlayerState.PLAYING) {
        // 不在播放狀態，重設
        lastTimeRef.current = p.getCurrentTime?.() || 0
        return
      }

      const currentTime = p.getCurrentTime?.() || 0
      // 如果播放狀態但時間沒有前進超過 5 秒，視為卡頓
      if (Math.abs(currentTime - lastTimeRef.current) < 0.5) {
        console.log("[v0] Stall detected - attempting recovery")
        // 嘗試恢復播放
        postToIframe("playVideo")
      }
      lastTimeRef.current = currentTime
    }, 5000)
  }

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      document.body.appendChild(tag)
    }

    const initPlayer = () => {
      if (window.YT && window.YT.Player && containerRef.current) {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: video.videoId,
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
              onReady: (event: any) => {
              setIsReady(true)
              const qualities = event.target.getAvailableQualityLevels?.() || []
              const best = ["hd1080", "hd720", "large"].find((q) => qualities.includes(q)) || qualities[0]
              if (best) event.target.setPlaybackQuality(best)
            },
            onStateChange: (event: any) => {
              const YT = window.YT
              if (!YT) return

              console.log("[v0] Player state changed:", event.data)

              if (event.data === YT.PlayerState.PLAYING) {
                setIsPlaying(true)
                onUserInteractionRef.current()
                clearWatchdog()
                startStallCheck()
                updateMediaSessionState("playing")
              } else if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false)
                clearStallCheck()
                // 強制向系統宣示主權：當 YouTube 在背景自動觸發暫停（甚至回報 none）時，
                // 把 playbackState 定格成 "playing"，不讓 Chrome 回收媒體控制卡片。
                if ("mediaSession" in navigator) {
                  try {
                    navigator.mediaSession.playbackState = "playing"
                  } catch (e) {
                    console.log("[v0] force playbackState failed:", e)
                  }
                }
              }

              if (event.data === YT.PlayerState.ENDED) {
                console.log("[v0] Video ended, playMode:", playModeRef.current)
                clearStallCheck()

                if (playModeRef.current === "single-loop") {
                  playerRef.current?.seekTo(0, true)
                  playerRef.current?.playVideo()
                  return
                }

                console.log("[v0] Calling safeNext from video end")
                safeNext()
              }
            },
            onError: (event: any) => {
              console.log("[v0] Player error:", event.data)
              clearWatchdog()
              clearStallCheck()
              onNextRef.current()
            },
          },
        })
      }
    }

    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      clearWatchdog()
      clearStallCheck()
      playerRef.current?.destroy?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isReady || !playerRef.current) return

    const art = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
    const img = new Image()
    img.src = art
    img.onload = () => setMediaArt(art)

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: video.title,
        artist: video.channelTitle || "YouTube",
        artwork: [{ src: art, sizes: "512x512", type: "image/jpeg" }],
      })
    }

    nextLockRef.current = 0

    if (hasUserInteractedRef.current) {
      playerRef.current.loadVideoById({ videoId: video.videoId, startSeconds: 0 })
      startWatchdog()
    } else {
      clearWatchdog()
      playerRef.current.cueVideoById({ videoId: video.videoId, startSeconds: 0 })
    }
  }, [isReady, video.videoId, video.title, video.channelTitle, hasUserInteracted])

  useEffect(() => {
    if (!("mediaSession" in navigator)) return

    navigator.mediaSession.setActionHandler("play", () => {
      postToIframe("playVideo")
      updateMediaSessionState("playing")
    })
    navigator.mediaSession.setActionHandler("pause", () => {
      postToIframe("pauseVideo")
      updateMediaSessionState("paused")
    })
    navigator.mediaSession.setActionHandler("previoustrack", () => onPreviousRef.current())
    navigator.mediaSession.setActionHandler("nexttrack", () => onNextRef.current())
  }, [])

  if (!video) return null

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-primary/20 shadow-xl">
      {/* Video container - balanced size for controls visibility */}
      <div
        className="w-full bg-black relative transition-all duration-700"
        style={{
          aspectRatio: "16/9",
          maxHeight: "52vh",
          backgroundImage: `url(${mediaArt})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* More compact control area */}
      <div className="p-3 sm:p-4 space-y-2">
        {/* Title and info row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold line-clamp-2 text-balance bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {video.title}
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
              {video.channelTitle && <span className="truncate">{video.channelTitle}</span>}
              <span className="shrink-0">({currentIndex + 1} / {totalVideos})</span>
            </div>
          </div>
        </div>

        {/* Controls row - all in one line */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Playback controls */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrevious}
              className="hover:bg-primary/10 bg-transparent h-8 w-8"
              title={t.previous}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onNext}
              className="hover:bg-primary/10 bg-transparent h-8 w-8"
              title={t.next}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onAddToCompilation}
                    className="hover:bg-primary/10 bg-transparent h-8 w-8"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t.addToCompilation}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Sort selector */}
          <div className="flex-1 min-w-[120px]">
            <SortSelector value={sortMode} onChange={onSortModeChange} language={language} />
          </div>

          {/* Play mode controls */}
          <div className="flex gap-1">
            <Button
              variant={playMode === "normal" ? "default" : "outline"}
              size="icon"
              onClick={() => onPlayModeChange("normal")}
              title={t.playNormal}
              className="h-8 w-8"
            >
              <Repeat className="h-4 w-4" />
            </Button>
            <Button
              variant={playMode === "single-loop" ? "default" : "outline"}
              size="icon"
              onClick={() => onPlayModeChange("single-loop")}
              title={t.playSingleLoop}
              className="h-8 w-8"
            >
              <Repeat1 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
