"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Loader2, Plus, Trash2, List, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Playlist } from "@/app/page"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/translations"

interface PlaylistManagerProps {
  playlists: Playlist[]
  currentPlaylistId: string | null
  onPlaylistLoad: (id: string, name?: string) => void
  onPlaylistSelect: (id: string) => void
  onPlaylistDelete: (id: string) => void
  onPlaylistRefresh: (id: string) => void
  onCreateCompilation: (selectedPlaylists: string[], name: string) => void
  isLoading: boolean
  language: string
}

export function PlaylistManager({
  playlists,
  currentPlaylistId,
  onPlaylistLoad,
  onPlaylistSelect,
  onPlaylistDelete,
  onPlaylistRefresh,
  onCreateCompilation,
  isLoading,
  language,
}: PlaylistManagerProps) {
  const [input, setInput] = useState("")
  const [playlistName, setPlaylistName] = useState("")
  const [showCompilationDialog, setShowCompilationDialog] = useState(false)
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([])
  const [compilationName, setCompilationName] = useState("")

  const t = useTranslation(language)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      console.log("[v0] Submitting playlist:", input.trim())
      onPlaylistLoad(input.trim(), playlistName.trim() || undefined)
      setInput("")
      setPlaylistName("")
    }
  }

  const handleCreateCompilation = () => {
    if (selectedPlaylists.length > 0 && compilationName.trim()) {
      onCreateCompilation(selectedPlaylists, compilationName)
      setShowCompilationDialog(false)
      setSelectedPlaylists([])
      setCompilationName("")
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/10">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            placeholder={t.playlistUrlPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full"
            disabled={isLoading}
          />
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder={t.playlistNamePlaceholder}
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.loading}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {t.addPlaylist}
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t.playlistUrlPlaceholder}</p>
        </form>
      </Card>

      {playlists.length > 0 && (
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <List className="h-5 w-5" />
              {t.myPlaylists} ({playlists.length})
            </h3>
            <Dialog open={showCompilationDialog} onOpenChange={setShowCompilationDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {t.createCompilation}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.createCompilation}</DialogTitle>
                  <DialogDescription>{t.selectPlaylists}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {playlists.map((playlist) => (
                      <div key={playlist.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={playlist.id}
                          checked={selectedPlaylists.includes(playlist.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlaylists([...selectedPlaylists, playlist.id])
                            } else {
                              setSelectedPlaylists(selectedPlaylists.filter((id) => id !== playlist.id))
                            }
                          }}
                        />
                        <Label htmlFor={playlist.id} className="flex-1 cursor-pointer">
                          {playlist.name} ({playlist.videos.length} {t.videos})
                        </Label>
                      </div>
                    ))}
                  </div>
                  <Input
                    placeholder={t.compilationName}
                    value={compilationName}
                    onChange={(e) => setCompilationName(e.target.value)}
                  />
                  <Button
                    onClick={handleCreateCompilation}
                    disabled={selectedPlaylists.length === 0 || !compilationName.trim()}
                    className="w-full"
                  >
                    {t.create}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50",
                  currentPlaylistId === playlist.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/50 hover:bg-accent/50",
                )}
                onClick={() => onPlaylistSelect(playlist.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{playlist.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {playlist.videos.length} {t.videos}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!playlist.id.startsWith("compilation-") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={t.refreshPlaylist}
                        disabled={isLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPlaylistRefresh(playlist.id)
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title={t.deletePlaylist}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPlaylistDelete(playlist.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
