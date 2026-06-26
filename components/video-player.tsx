"use client"

import { useRef, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SkipBack, SkipForward, Repeat1, Repeat, Plus, Play, Pause } from "lucide-react"
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
  // 無聲音訊錨點：在父頁面持續播放無聲音訊，讓瀏覽器認定頁面一直有媒體在播放，
  // 避免切到背景、YouTube iframe 自動暫停時，系統把媒體控制卡片回收。
  const silentAudioRef = useRef<HTMLAudioElement | null>(null)
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

  // 統一的播放控制：播放器 UI 按鈕與媒體卡片按鈕都呼叫同一組函式，確保兩者同步
  const playYouTube = () => {
    const p = playerRef.current
    console.log("[v0] playYouTube called, state before:", p?.getPlayerState?.())
    // 先在使用者手勢的第一時間命令 YouTube 播放，避免手勢被其他呼叫用掉
    try {
      p?.unMute?.()
      p?.playVideo?.()
    } catch (e) {
      console.log("[v0] playVideo via API failed:", e)
    }
    postToIframe("playVideo")
    // 背景時錨點已由 visibilitychange 啟動；前景不啟動錨點以免與 YouTube 搶焦點
    if (document.hidden) silentAudioRef.current?.play().catch(() => {})
    setIsPlaying(true)
    updateMediaSessionState("playing")
    console.log("[v0] playYouTube done, state after:", p?.getPlayerState?.())
  }

  const pauseYouTube = () => {
    try {
      playerRef.current?.pauseVideo?.()
    } catch (e) {
      console.log("[v0] pauseVideo via API failed:", e)
    }
    postToIframe("pauseVideo")
    setIsPlaying(false)
    updateMediaSessionState("paused")
  }

  const togglePlayPause = () => {
    const YT = window.YT
    const state = playerRef.current?.getPlayerState?.()
    const playing = (YT && (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING)) || isPlaying
    if (playing) pauseYouTube()
    else playYouTube()
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
                // 僅背景時維持錨點；前景交給 YouTube，避免搶音訊焦點
                if (document.hidden) silentAudioRef.current?.play().catch(() => {})
              } else if (event.data === YT.PlayerState.PAUSED) {
                setIsPlaying(false)
                clearStallCheck()
                // 無聲音訊錨點保持播放（卡片不被回收），但把 playbackState 設為 "paused"，
                // 讓卡片顯示「播放鈕」，反映 YouTube 的真實狀態。按下播放鈕即可恢復 YouTube。
                if ("mediaSession" in navigator) {
                  try {
                    navigator.mediaSession.playbackState = "paused"
                  } catch (e) {
                    console.log("[v0] set playbackState paused failed:", e)
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

    // 媒體卡片的播放/暫停按鈕，與播放器 UI 按鈕走同一組統一函式
    navigator.mediaSession.setActionHandler("play", () => playYouTube())
    navigator.mediaSession.setActionHandler("pause", () => pauseYouTube())
    navigator.mediaSession.setActionHandler("previoustrack", () => onPreviousRef.current())
    navigator.mediaSession.setActionHandler("nexttrack", () => onNextRef.current())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 建立無聲音訊錨點，並在使用者第一次與父頁面互動時開始循環播放
  useEffect(() => {
    // 用程式產生一段 30 秒的無聲 WAV（mono / 8kHz）。
    // 長度需足夠長，部分瀏覽器會忽略過短的音訊而不建立媒體工作階段。
    const createSilentWavUrl = () => {
      const sampleRate = 8000
      const numSamples = sampleRate * 30
      const buffer = new ArrayBuffer(44 + numSamples * 2)
      const view = new DataView(buffer)
      const writeStr = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
      }
      writeStr(0, "RIFF")
      view.setUint32(4, 36 + numSamples * 2, true)
      writeStr(8, "WAVE")
      writeStr(12, "fmt ")
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true) // PCM
      view.setUint16(22, 1, true) // mono
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      writeStr(36, "data")
      view.setUint32(40, numSamples * 2, true)
      // 樣本預設為 0（無聲）
      const blob = new Blob([buffer], { type: "audio/wav" })
      return URL.createObjectURL(blob)
    }

    const audio = document.createElement("audio")
    const url = createSilentWavUrl()
    audio.src = url
    audio.loop = true
    // 內容本身是全零（聽不到聲音），但 volume 必須維持非 0，
    // 否則 Chrome / Android 不會為它請求音訊焦點，媒體卡片就不會出現。
    audio.volume = 1
    audio.setAttribute("playsinline", "")
    silentAudioRef.current = audio

    let primed = false

    // 第一次互動時 prime：取得音訊播放授權。
    // 前景不需要錨點（交給 YouTube 播放，避免搶音訊焦點導致無法恢復），
    // 僅在背景時才讓錨點播放以維持媒體卡片。
    const prime = () => {
      audio
        .play()
        .then(() => {
          primed = true
          console.log("[v0] silent audio anchor primed")
          // 前景時立即暫停錨點，避免與 YouTube 搶焦點
          if (!document.hidden) audio.pause()
          document.removeEventListener("pointerdown", prime)
          document.removeEventListener("click", prime)
          document.removeEventListener("touchstart", prime)
          document.removeEventListener("keydown", prime)
        })
        .catch(() => {
          // 尚未取得手勢，保留監聽器等待下次互動
        })
    }

    // 切到背景：啟動錨點維持卡片；回到前景：暫停錨點，把音訊焦點還給 YouTube
    const handleVisibility = () => {
      if (!primed) return
      if (document.hidden) {
        audio.play().catch(() => {})
        console.log("[v0] background - silent anchor playing")
      } else {
        audio.pause()
        console.log("[v0] foreground - silent anchor paused")
      }
    }

    document.addEventListener("pointerdown", prime)
    document.addEventListener("click", prime)
    document.addEventListener("touchstart", prime)
    document.addEventListener("keydown", prime)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("pointerdown", prime)
      document.removeEventListener("click", prime)
      document.removeEventListener("touchstart", prime)
      document.removeEventListener("keydown", prime)
      document.removeEventListener("visibilitychange", handleVisibility)
      audio.pause()
      audio.src = ""
      URL.revokeObjectURL(url)
      silentAudioRef.current = null
    }
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
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className="h-8 w-8"
              title={isPlaying ? t.playSingleLoop : t.playNormal}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
