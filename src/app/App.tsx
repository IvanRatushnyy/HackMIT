/* elute — routes and the data banner text, composed once from the data source. */

import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { source } from '../data/source'
import { Entry } from '../screens/Entry'
import { Query } from '../screens/Query'
import { Detail } from '../screens/Detail'
import { Methods } from '../screens/Methods'

const FALLBACK = 'Fixture mode · curated from dated public sources. Not a clinical decision tool.'

export function App() {
  const [banner, setBanner] = useState(FALLBACK)
  useEffect(() => {
    source
      .provenance()
      .then((p) => setBanner(p.summary))
      .catch(() => setBanner('Fixture data failed to load — reload the page.'))
  }, [])
  const replayBanner = banner.replace(/^Fixture mode ·/, 'Fixture mode · scripted sequence, not a live run ·')
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Entry banner={banner} />} />
        <Route path="/q/:query" element={<Query banner={banner} replayBanner={replayBanner} />} />
        <Route path="/q/:query/:candidate" element={<Detail banner={banner} />} />
        <Route path="/methods" element={<Methods banner={banner} />} />
        <Route path="*" element={<Query banner={banner} replayBanner={replayBanner} />} />
      </Routes>
    </BrowserRouter>
  )
}
