import { useLiveQuery } from 'dexie-react-hooks'
import { goBack } from '../app/router.ts'
import { db } from '../db/db.ts'
import { Placeholder } from './Placeholder.tsx'
import { Review } from './Review.tsx'

/** Edits a saved entry with the same screen used to review AI results. */
export function EditEntry({ id }: { id: string | null }) {
  const entry = useLiveQuery(async () => (id ? ((await db.entries.get(id)) ?? null) : null), [id])

  if (entry === undefined) return null
  if (entry === null) return <Placeholder title="Editar comida" message="Puede que la hayas eliminado." heading="No encontré esta comida" onBack={() => goBack('/')} />

  return (
    <Review
      key={entry.id}
      title="Editar comida"
      initialItems={entry.items.map((item) => ({ item, warning: null }))}
      initialMeal={entry.meal}
      thumb={entry.photoThumb}
      onCancel={() => goBack('/')}
      onSave={async (meal, items) => {
        await db.entries.update(entry.id, { meal, items })
        goBack('/')
      }}
    />
  )
}
