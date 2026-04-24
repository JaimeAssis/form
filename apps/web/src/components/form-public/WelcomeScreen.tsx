import { Button } from '@/components/ui/button'

interface WelcomeScreenProps {
  title: string
  welcomeTitle: string | null
  welcomeMessage: string | null
  logoUrl: string | null
  userAvatarUrl: string | null
  userName: string
  brandColor: string | null
  onStart: () => void
}

export function WelcomeScreen({
  title,
  welcomeTitle,
  welcomeMessage,
  logoUrl,
  userAvatarUrl,
  userName,
  brandColor,
  onStart,
}: WelcomeScreenProps) {
  const displayLogo = logoUrl || userAvatarUrl
  const displayTitle = welcomeTitle || title

  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-12">
      {displayLogo ? (
        <img
          src={displayLogo}
          alt={userName}
          className="w-16 h-16 rounded-full object-cover mb-6"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground mb-6">
          {userName.charAt(0).toUpperCase()}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-3">{displayTitle}</h1>

      {welcomeMessage ? (
        <p className="text-muted-foreground mb-8 leading-relaxed">{welcomeMessage}</p>
      ) : (
        <div className="mb-8" />
      )}

      <Button
        size="lg"
        className="w-full max-w-xs text-base"
        style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
        onClick={onStart}
      >
        Começar →
      </Button>
    </div>
  )
}
