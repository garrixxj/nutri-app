export default function App() {
  return (
    <main className="safe-top mx-auto max-w-md px-4 pb-8">
      <h1 className="pt-4 text-display font-bold tracking-tight">Nutri</h1>
      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <p className="text-body">La base de la app está lista.</p>
        <p className="mt-1 text-secondary text-text-2">Pronto vas a poder registrar tus comidas.</p>
        <div className="mt-4 flex gap-2 text-label font-medium">
          <span className="rounded-full bg-protein/15 px-3 py-1 text-protein">Proteína</span>
          <span className="rounded-full bg-carbs/15 px-3 py-1 text-carbs">Carbos</span>
          <span className="rounded-full bg-fat/15 px-3 py-1 text-fat">Grasa</span>
        </div>
      </section>
    </main>
  )
}
