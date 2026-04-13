"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import type { Playlist, Video } from "@/app/page"
import { useTranslation } from "@/lib/translations"

interface AddToCompilationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  video: Video
  playlists: Playlist[]
  onAddToCompilation: (compilationIds: string[]) => void
  onCreateCompilation: (name: string) => void
  language: string
}

export function AddToCompilationDialog({
  open,
  onOpenChange,
  video,
  playlists,
  onAddToCompilation,
  onCreateCompilation,
  language,
}: AddToCompilationDialogProps) {
  const [selectedCompilations, setSelectedCompilations] = useState<string[]>([])
  const [newCompilationName, setNewCompilationName] = useState("")
  const [showCreateNew, setShowCreateNew] = useState(false)
  
  const t = useTranslation(language)
  
  // Filter to only show compilations
  const compilations = playlists.filter(p => p.id.startsWith("compilation-"))
  const hasCompilations = compilations.length > 0

  const handleAddToExisting = () => {
    if (selectedCompilations.length > 0) {
      onAddToCompilation(selectedCompilations)
      setSelectedCompilations([])
      onOpenChange(false)
    }
  }

  const handleCreateNew = () => {
    if (newCompilationName.trim()) {
      onCreateCompilation(newCompilationName.trim())
      setNewCompilationName("")
      setShowCreateNew(false)
      onOpenChange(false)
    }
  }

  const resetState = () => {
    setSelectedCompilations([])
    setNewCompilationName("")
    setShowCreateNew(!hasCompilations)
  }

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (isOpen) {
          resetState()
        }
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.addToCompilation}</DialogTitle>
          <DialogDescription className="truncate">
            {video.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Show existing compilations if any */}
          {hasCompilations && !showCreateNew && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t.addToExisting}</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {compilations.map((compilation) => {
                    const alreadyInCompilation = compilation.videos.some(v => v.videoId === video.videoId)
                    return (
                      <div key={compilation.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`comp-${compilation.id}`}
                          checked={selectedCompilations.includes(compilation.id)}
                          disabled={alreadyInCompilation}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCompilations([...selectedCompilations, compilation.id])
                            } else {
                              setSelectedCompilations(selectedCompilations.filter((id) => id !== compilation.id))
                            }
                          }}
                        />
                        <Label 
                          htmlFor={`comp-${compilation.id}`} 
                          className={`flex-1 cursor-pointer text-sm ${alreadyInCompilation ? 'text-muted-foreground' : ''}`}
                        >
                          {compilation.name} ({compilation.videos.length} {t.videos})
                          {alreadyInCompilation && <span className="ml-1 text-xs">(已加入)</span>}
                        </Label>
                      </div>
                    )
                  })}
                </div>
                <Button
                  onClick={handleAddToExisting}
                  disabled={selectedCompilations.length === 0}
                  className="w-full"
                >
                  {t.add}
                </Button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">或</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => setShowCreateNew(true)}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.createNewCompilation}
              </Button>
            </>
          )}
          
          {/* Create new compilation form */}
          {(showCreateNew || !hasCompilations) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t.createNewCompilation}</Label>
              <Input
                placeholder={t.newCompilationName}
                value={newCompilationName}
                onChange={(e) => setNewCompilationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCompilationName.trim()) {
                    handleCreateNew()
                  }
                }}
              />
              <div className="flex gap-2">
                {hasCompilations && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateNew(false)}
                    className="flex-1"
                  >
                    {t.cancel}
                  </Button>
                )}
                <Button
                  onClick={handleCreateNew}
                  disabled={!newCompilationName.trim()}
                  className="flex-1"
                >
                  {t.addAndCreate}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
