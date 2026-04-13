"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SortMode } from "@/app/page"
import { ArrowDownAZ, ArrowUpAZ, Shuffle, List, Calendar, CalendarClock } from "lucide-react"
import { useTranslation } from "@/lib/translations"

interface SortSelectorProps {
  value: SortMode
  onChange: (mode: SortMode) => void
  language: string
}

export function SortSelector({ value, onChange, language }: SortSelectorProps) {
  const t = useTranslation(language)

  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortMode)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="original">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span>{t.sortOriginal}</span>
          </div>
        </SelectItem>
        <SelectItem value="random">
          <div className="flex items-center gap-2">
            <Shuffle className="h-4 w-4" />
            <span>{t.sortRandom}</span>
          </div>
        </SelectItem>
        <SelectItem value="name-asc">
          <div className="flex items-center gap-2">
            <ArrowDownAZ className="h-4 w-4" />
            <span>{t.sortNameAsc}</span>
          </div>
        </SelectItem>
        <SelectItem value="name-desc">
          <div className="flex items-center gap-2">
            <ArrowUpAZ className="h-4 w-4" />
            <span>{t.sortNameDesc}</span>
          </div>
        </SelectItem>
        <SelectItem value="newest">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{t.sortNewest}</span>
          </div>
        </SelectItem>
        <SelectItem value="oldest">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            <span>{t.sortOldest}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
