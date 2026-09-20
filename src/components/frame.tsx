/* elute — page frame: shard, wordmark, entry band, inner header, data banner, sheet. */

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
  // offsetY shifts the viewBox so a header band shows the dense middle of the composition.
  const markup = offsetY ? shardMarkup.replace('viewBox="0 0 1440 744"', `viewBox="0 ${offsetY} 1440 744"`) : shardMarkup
  return <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
}

export function Wordmark({ variant }: { variant: 'entry' | 'inner' }) {
  return (
    <Link to="/" className={`wordmark wordmark--${variant}`} aria-label="elute, home">
      elute
    </Link>
  )
}

export function Banner({ text }: { text: string }) {
  return (
    <p className="banner" role="note">
      {text}
    </p>
  )
}

/** Inner-page header (Figma Desktop-2): wordmark and field on white, shard band beside. */
export function Header() {
  return (
    <header className="header">
      <div className="header__block">
        <Wordmark variant="inner" />
        <SearchField compact />
      </div>
      <Shard className="header__shard" offsetY="280" />
    </header>
  )
}

export function Sheet({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={`sheet${className ? ` ${className}` : ''}`}>{children}</section>
}
