import { Button, Card, ScreenHeader, TabScreen } from '../components/ui.tsx'

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
        <div className="safe-top px-2 pt-2">
          <Button variant="plain" className="px-2" onClick={onBack}>
            Volver
          </Button>
        </div>
      )}
      <ScreenHeader title={title} />
      <div className="px-4">
        <Card className="px-4 py-8 text-center">
          <p className="text-body font-semibold">{heading}</p>
          <p className="mt-1 text-secondary text-text-2">{message}</p>
        </Card>
      </div>
    </TabScreen>
  )
}
