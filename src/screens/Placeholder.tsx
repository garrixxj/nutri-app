import { IconChevronLeft } from '../components/icons.tsx'
import { Card, CircleButton, ScreenHeader, TabScreen } from '../components/ui.tsx'

export function Placeholder({
  title,
  message,
  heading = 'Próximamente',
  onBack,
}: {
  title: string
  message: string
  heading?: string
  onBack?: () => void
}) {
  return (
    <TabScreen>
      {onBack && (
        <div className="safe-top px-4 pt-2">
          <CircleButton label="Volver" onClick={onBack}>
            <IconChevronLeft size={22} strokeWidth={2.2} />
          </CircleButton>
        </div>
      )}
      <ScreenHeader title={title} />
      <div className="px-4">
        <Card className="px-5 py-8 text-center">
          <p className="text-body font-semibold">{heading}</p>
          <p className="mt-1 text-secondary text-text-2">{message}</p>
        </Card>
      </div>
    </TabScreen>
  )
}
