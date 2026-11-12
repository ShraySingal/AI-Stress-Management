import MindEaseApp from './MindEaseApp'
import { loadBetaData } from './actions'

export default async function HomePage() {
  const initialData = await loadBetaData()
  return <MindEaseApp initialData={initialData} />
}
