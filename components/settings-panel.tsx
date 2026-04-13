"use client"

import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { PlayerSettings } from "@/app/page"
import { useTranslation } from "@/lib/translations"

interface SettingsPanelProps {
  settings: PlayerSettings
  onSettingsChange: (settings: PlayerSettings) => void
  onClose: () => void
  language: string
}

export function SettingsPanel({ settings, onSettingsChange, onClose, language }: SettingsPanelProps) {
  const t = useTranslation(language)

  return (
    <Card className="p-6 mb-6 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">{t.settings || "進階設定"}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">{t.playSettings || "播放設定"}</h4>
          <div className="flex items-center justify-between">
            <Label htmlFor="autoplay" className="cursor-pointer">
              {t.autoplayNext || "自動播放下一首"}
            </Label>
            <Switch
              id="autoplay"
              checked={settings.autoplay ?? true}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, autoplay: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="background" className="cursor-pointer">
              {t.backgroundPlay || "背景播放"}
            </Label>
            <Switch
              id="background"
              checked={settings.backgroundPlay ?? false}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, backgroundPlay: checked })}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
