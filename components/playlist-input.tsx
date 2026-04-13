"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface PlaylistInputProps {
  onSubmit: (playlistId: string) => void
  isLoading: boolean
}

export function PlaylistInput({ onSubmit, isLoading }: PlaylistInputProps) {
  const [input, setInput] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input.trim())
    }
  }

  return (
    <Card className="p-6 bg-card">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="text"
          placeholder="輸入 YouTube 播放清單 ID 或網址"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              載入中
            </>
          ) : (
            "載入播放清單"
          )}
        </Button>
      </form>
    </Card>
  )
}
