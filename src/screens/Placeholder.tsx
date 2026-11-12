import { Card, FlowHeader, ScreenHeader, TabScreen } from '../components/ui.tsx'

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
      {onBack ? <FlowHeader title={title} onBack={onBack} /> : <ScreenHeader title={title} />}
      <div className="px-4">
        <Card className="px-5 py-8 text-center">
          <p className="text-body font-semibold">{heading}</p>
          <p className="mt-1 text-secondary text-text-2">{message}</p>
        </Card>
      </div>
    </TabScreen>
  )
}
