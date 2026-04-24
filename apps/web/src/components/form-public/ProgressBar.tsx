interface ProgressBarProps {
  current: number
  total: number
  brandColor?: string | null
}

export function ProgressBar({ current, total, brandColor }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round(((current + 1) / total) * 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Pergunta {current + 1} de {total}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out bg-primary"
          style={{
            width: `${percent}%`,
            ...(brandColor ? { backgroundColor: brandColor } : {}),
          }}
        />
      </div>
    </div>
  )
}
