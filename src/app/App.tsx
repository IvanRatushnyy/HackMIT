/* elute — routes, in the order of the flow. The data note text is composed once from the source and
 * travels with the exported document. The startup screen sits over the first page until its wordmark
 * has landed in the header. */

import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { source } from '../data/source'
import { StartupDone } from '../components/frame'
import { Splash } from '../components/Splash'
import { Entry } from '../screens/Entry'
import { Query } from '../screens/Query'
import { Detail } from '../screens/Detail'
import { Sources } from '../screens/Sources'
import { Export } from '../screens/Export'

const FALLBACK = 'Fixture mode. Not a clinical decision tool. Curated from dated public sources.'

export function App() {
  const [banner, setBanner] = useState(FALLBACK)
  const [started, setStarted] = useState(true) // PROTOTYPE: startup screen off for the landing vibe check (was prefersReducedMotion)
  const start = useCallback(() => setStarted(true), [])
  useEffect(() => {
    source
      .provenance()
      .then((p) => setBanner(p.summary))
      .catch(() => setBanner('Fixture data failed to load — reload the page.'))
  }, [])
  return (
    <StartupDone.Provider value={started}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Entry />} />
          <Route path="/q/:query" element={<Query />} />
          <Route path="/q/:query/sources" element={<Sources />} />
          <Route path="/q/:query/:candidate" element={<Detail />} />
          <Route path="/q/:query/:candidate/export" element={<Export banner={banner} />} />
          <Route path="/methods" element={<Navigate to="/q/parkinsons-disease/sources" replace />} />
          <Route path="*" element={<Query />} />
        </Routes>
        {!started && <Splash onDone={start} />}
      </BrowserRouter>
    </StartupDone.Provider>
  )
}
