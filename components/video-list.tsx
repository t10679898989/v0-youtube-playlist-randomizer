"use client"

import { useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Play } from "lucide-react"
import type { Video } from "@/app/page"
import { useTranslation } from "@/lib/translations"

interface VideoListProps {
  videos: Video[]
  currentIndex: number
  onVideoSelect: (index: number) => void
  language: string
}

export function VideoList({ videos, currentIndex, onVideoSelect, language }: VideoListProps) {
  const t = useTranslation(language)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const viewportRef = useRef<HTMLDivElement | null>(null)

  // 取得 ScrollArea 內部的 viewport 元素
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!scrollAreaRef.current) return
    // ScrollArea 的 viewport 是第一個帶有 overflow 的子元素
    const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null
    viewportRef.current = viewport
  }, [])

  // 當 currentIndex 改變時，把該項目捲到清單頂端
  useEffect(() => {
    const item = itemRefs.current[currentIndex]
    const viewport = viewportRef.current
    if (!item || !viewport) return

    // 計算項目相對於 viewport 的 offsetTop
    const itemOffsetTop = item.offsetTop
    viewport.scrollTo({ top: itemOffsetTop, behavior: "smooth" })
  }, [currentIndex])

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-primary/20">
      <h3 className="font-semibold mb-4 text-lg">
        {t.currentPlaying} ({videos.length})
      </h3>
      <div ref={scrollAreaRef}>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-2">
            {videos.map((video, index) => (
              <button
                key={`${video.videoId}-${index}`}
                ref={(el) => { itemRefs.current[index] = el }}
                onClick={() => onVideoSelect(index)}
                className={cn(
                  "w-full flex gap-4 p-3 rounded-lg transition-all text-left group relative overflow-hidden",
                  currentIndex === index
                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg scale-[1.02]"
                    : "hover:bg-accent/50 hover:scale-[1.01]",
                )}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={video.thumbnail || "/placeholder.svg"}
                    alt={video.title}
                    className="w-32 h-20 object-cover rounded"
                  />
                  {currentIndex === index && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium line-clamp-2 mb-1", currentIndex === index && "font-bold")}>
                    {video.title}
                  </p>
                  {video.channelTitle && (
                    <p
                      className={cn(
                        "text-xs mt-1",
                        currentIndex === index ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {video.channelTitle}
                    </p>
                  )}
                  <p
                    className={cn(
                      "text-xs mt-1",
                      currentIndex === index ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    #{index + 1}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  )
}
