/* elute — Entry: the ask box, with paste a paper behind its + button, centred in the space under the header.
 * Mounted under the startup screen, the box arrives after it, once the header band has composed. Later
 * visits fade in like any other page. */

import { useContext, useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header, SHARD, StartupDone } from '../components/frame'
import { Ask } from '../components/Ask'
import { PastePaper } from '../components/PastePaper'
import { GROUND_PLANES } from '../lib/shard'

/* wait: under the startup screen · go: arriving after it · settled: an ordinary page reveal */
type Arrival = 'wait' | 'go' | 'settled'

function useArrival(): Arrival {
  const done = useContext(StartupDone)
  const [underSplash] = useState(() => !done)
  return !underSplash ? 'settled' : done ? 'go' : 'wait'
}

/* The band's cascade, for the stylesheet to wait out before the box arrives */
const BAND = { '--shard-n': SHARD.planes.length, '--shard-ground': GROUND_PLANES } as React.CSSProperties

export function Entry() {
  const [params] = useSearchParams()
  const [paste, setPaste] = useState(params.get('paste') === '1')
  const pasteId = useId()
  const arrival = useArrival()

  return (
    <main className="page">
      <Header entry />
      <div className={`col col--narrow entry entry--${arrival}`} style={BAND}>
        <div className="entry__block">
          <Ask pasteOpen={paste} pasteId={pasteId} onPaste={() => setPaste((p) => !p)} />
          {paste && <PastePaper id={pasteId} onClose={() => setPaste(false)} />}
        </div>
      </div>
    </main>
  )
}
