import { Card, ScreenHeader, TabScreen } from '../components/ui.tsx'

export function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <TabScreen>
      <ScreenHeader title={title} />
      <div className="px-4">
        <Card className="px-4 py-8 text-center">
          <p className="text-body font-semibold">Próximamente</p>
          <p className="mt-1 text-secondary text-text-2">{message}</p>
        </Card>
      </div>
    </TabScreen>
  )
}
