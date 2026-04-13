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
  const hasUserInteractedRef = useRef(hasUserInteracted)
  const onUserInteractionRef = useRef(onUserInteraction)

  useEffect(() => { playModeRef.current = playMode }, [playMode])
  useEffect(() => { onVideoEndRef.current = onVideoEnd }, [onVideoEnd])
  useEffect(() => { onNextRef.current = onNext }, [onNext])
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
              } else if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false)
                clearStallCheck()
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

    navigator.mediaSession.setActionHandler("play", () => postToIframe("playVideo"))
    navigator.mediaSession.setActionHandler("pause", () => postToIframe("pauseVideo"))
    navigator.mediaSession.setActionHandler("previoustrack", () => onNextRef.current())
    navigator.mediaSession.setActionHandler("nexttrack", () => onNextRef.current())
  }, [])

  if (!video) return null

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-primary/20 shadow-xl">
      <div
        className="aspect-video bg-black relative transition-all duration-700"
        style={{
          backgroundImage: `url(${mediaArt})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-2 text-balance bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {video.title}
          </h2>
          {video.channelTitle && <p className="text-sm text-muted-foreground">{video.channelTitle}</p>}
          <p className="text-sm text-muted-foreground mt-2">
            {currentIndex + 1} / {totalVideos}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onPrevious}
                className="hover:bg-primary/10 bg-transparent"
                title={t.previous}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onNext}
                className="hover:bg-primary/10 bg-transparent"
                title={t.next}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onAddToCompilation}
                      className="hover:bg-primary/10 bg-transparent"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t.addToCompilation}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex-1">
              <SortSelector value={sortMode} onChange={onSortModeChange} language={language} />
            </div>

            <div className="flex gap-2">
              <Button
                variant={playMode === "normal" ? "default" : "outline"}
                size="icon"
                onClick={() => onPlayModeChange("normal")}
                title={t.playNormal}
              >
                <Repeat className="h-5 w-5" />
              </Button>
              <Button
                variant={playMode === "single-loop" ? "default" : "outline"}
                size="icon"
                onClick={() => onPlayModeChange("single-loop")}
                title={t.playSingleLoop}
              >
                <Repeat1 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
