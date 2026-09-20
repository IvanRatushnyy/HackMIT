/* elute — routes, in the order of the flow. The data note text is composed once from the source. */

import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { source } from '../data/source'
import { Entry } from '../screens/Entry'
import { Query } from '../screens/Query'
import { Detail } from '../screens/Detail'
import { Sources } from '../screens/Sources'
import { Export } from '../screens/Export'

const FALLBACK = 'Fixture mode · not a clinical decision tool · curated from dated public sources.'

export function App() {
  const [banner, setBanner] = useState(FALLBACK)
  useEffect(() => {
    source
      .provenance()
      .then((p) => setBanner(p.summary))
      .catch(() => setBanner('Fixture data failed to load — reload the page.'))
  }, [])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Entry banner={banner} />} />
        <Route path="/q/:query" element={<Query banner={banner} />} />
        <Route path="/q/:query/sources" element={<Sources banner={banner} />} />
        <Route path="/q/:query/:candidate" element={<Detail banner={banner} />} />
        <Route path="/q/:query/:candidate/export" element={<Export banner={banner} />} />
        <Route path="/methods" element={<Navigate to="/q/parkinsons-disease/sources" replace />} />
        <Route path="*" element={<Query banner={banner} />} />
      </Routes>
    </BrowserRouter>
  )
}
