"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2, List, RefreshCw, Menu, X } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/lib/translations"

// 獨立的新增表單，state 自我管理，避免每次打字觸發整個側邊欄（Sheet）重新渲染
// 進而導致手機鍵盤失去焦點、無法連續輸入
function AddPlaylistForm({
  onSubmit,
  isLoading,
  urlPlaceholder,
  namePlaceholder,
  loadingLabel,
  addLabel,
}: {
  onSubmit: (id: string, name?: string) => void
  isLoading: boolean
  urlPlaceholder: string
  namePlaceholder: string
  loadingLabel: string
  addLabel: string
}) {
  const [input, setInput] = useState("")
  const [playlistName, setPlaylistName] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input.trim(), playlistName.trim() || undefined)
      setInput("")
      setPlaylistName("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="text"
        placeholder={urlPlaceholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full text-sm"
        disabled={isLoading}
      />
      <Input
        type="text"
        placeholder={namePlaceholder}
        value={playlistName}
        onChange={(e) => setPlaylistName(e.target.value)}
        className="w-full text-sm"
        disabled={isLoading}
      />
      <Button type="submit" disabled={isLoading || !input.trim()} className="w-full" size="sm">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </>
        )}
      </Button>
    </form>
  )
}

interface PlaylistSidebarProps {
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

export function PlaylistSidebar({
  playlists,
  currentPlaylistId,
  onPlaylistLoad,
  onPlaylistSelect,
  onPlaylistDelete,
  onPlaylistRefresh,
  onCreateCompilation,
  isLoading,
  language,
}: PlaylistSidebarProps) {
  const [showCompilationDialog, setShowCompilationDialog] = useState(false)
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([])
  const [compilationName, setCompilationName] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const t = useTranslation(language)

  const handleCreateCompilation = () => {
    if (selectedPlaylists.length > 0 && compilationName.trim()) {
      onCreateCompilation(selectedPlaylists, compilationName)
      setShowCompilationDialog(false)
      setSelectedPlaylists([])
      setCompilationName("")
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Add Playlist Form */}
      <div className="p-4 border-b border-border/50">
        <AddPlaylistForm
          onSubmit={onPlaylistLoad}
          isLoading={isLoading}
          urlPlaceholder={t.playlistUrlPlaceholder}
          namePlaceholder={t.playlistNamePlaceholder}
          loadingLabel={t.loading}
          addLabel={t.addPlaylist}
        />
      </div>

      {/* Playlists List */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <List className="h-4 w-4" />
            {t.myPlaylists} ({playlists.length})
          </h3>
          {playlists.length > 1 && (
            <Dialog open={showCompilationDialog} onOpenChange={setShowCompilationDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  {t.createCompilation}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.createCompilation}</DialogTitle>
                  <DialogDescription>{t.selectPlaylists}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {playlists.map((playlist) => (
                      <div key={playlist.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sidebar-${playlist.id}`}
                          checked={selectedPlaylists.includes(playlist.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlaylists([...selectedPlaylists, playlist.id])
                            } else {
                              setSelectedPlaylists(selectedPlaylists.filter((id) => id !== playlist.id))
                            }
                          }}
                        />
                        <Label htmlFor={`sidebar-${playlist.id}`} className="flex-1 cursor-pointer text-sm">
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
          )}
        </div>
        
        <ScrollArea className="h-[calc(100%-3rem)] px-4 pb-4">
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={cn(
                  "p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                  currentPlaylistId === playlist.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/50 hover:bg-accent/50",
                )}
                onClick={() => {
                  onPlaylistSelect(playlist.id)
                  setIsOpen(false)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{playlist.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {playlist.videos.length} {t.videos}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!playlist.id.startsWith("compilation-") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={t.refreshPlaylist}
                        disabled={isLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPlaylistRefresh(playlist.id)
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title={t.deletePlaylist}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPlaylistDelete(playlist.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 bg-background/80 backdrop-blur-sm"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-4 w-4" />
        <span className="hidden sm:inline">{t.managePlaylist}</span>
      </Button>

      {/* 自製抽屜：不使用 Radix Sheet 的焦點鎖定與捲動鎖定，
          避免手機鍵盤每打一字就被收起 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-label={t.myPlaylists}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85%] flex-col bg-background shadow-lg transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <List className="h-5 w-5" />
            {t.myPlaylists}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        {sidebarContent}
      </div>
    </>
  )
}
