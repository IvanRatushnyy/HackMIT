/* elute — page frame: shard, wordmark, header, data note, kicker. */

import { Link } from 'react-router-dom'
import shardSvg from '../../design/shard/shard.svg?raw'
import { SearchField } from './SearchField'

// The mockup's SVG, cropped with `slice` so the composition fills its box.
const shardMarkup = shardSvg
  .replace(/preserveAspectRatio="none"/, 'preserveAspectRatio="xMidYMid slice"')
  .replace(/\swidth="1440"\sheight="744"/, '')
  .replace(/\sstyle="[^"]*"/, '')
  .replace(/\soverflow="visible"/, '')

export function Shard({ className, offsetY }: { className?: string; offsetY?: string }) {
  const markup = offsetY ? shardMarkup.replace('viewBox="0 0 1440 744"', `viewBox="0 ${offsetY} 1440 744"`) : shardMarkup
  return <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
}

export function Wordmark() {
  return (
    <Link to="/" className="wordmark" aria-label="elute, home">
      elute
    </Link>
  )
}

/** The curated-data statement: one quiet line at the foot of every page (PRD §9 Must). */
export function DataNote({ text }: { text: string }) {
  return (
    <footer className="datanote" role="contentinfo">
      {text}
    </footer>
  )
}

/** The same header on every page: wordmark, the field (not on Entry, where the field is the page), shard band. */
export function Header({ entry = false }: { entry?: boolean }) {
  return (
    <header className={`header${entry ? ' header--entry' : ''}`}>
      <div className="header__block">
        <Wordmark />
        {!entry && <SearchField compact />}
      </div>
      <Shard className="header__shard" offsetY="280" />
    </header>
  )
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="kicker">{children}</p>
}
