import { useEffect, useRef, useState } from 'react'

const srcs = [
  '/gallery/angel-1.avif',
  '/gallery/angel-2.avif',
  '/gallery/angel-3.avif',
  '/gallery/ashie-1.avif',
  '/gallery/ivy-1.avif',
  '/gallery/ivy-2.avif',
  '/gallery/ivy-3.avif',
  '/gallery/ivy-4.jpg',
  '/gallery/nikki-1.jpeg',
]
const images = [...srcs, ...srcs]
export function Gallery() {
  const [activeImageIndex, activeImageIndexAssign] = useState(0)
  const handleClick = (type: 'next' | 'prev') => () => {
    if (type === 'next') {
      activeImageIndexAssign(p => (p + 1 < images.length ? p + 1 : 0))
    } else {
      activeImageIndexAssign(p => (p - 1 >= 0 ? p - 1 : images.length - 1))
    }
  }

  return (
    <div className="border-background-modifier-border hover:border-background-modifier-hover active:border-background-modifier-active-hover flex min-h-[--gallery-height] w-[--gallery-width] flex-col gap-4 rounded border p-2">
      <div
        className="grid flex-grow justify-center bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${images[activeImageIndex]})` }}
      />

      <div className="flex flex-shrink-0 gap-2">
        <button
          onClick={handleClick('prev')}
          className="flex-shrink-0 rounded-md bg-black/20 hover:bg-black/40"
        >
          <ChevronLeft cn="size-8" />
        </button>
        <div
          className="grid flex-grow touch-pan-x snap-x snap-mandatory grid-flow-col gap-[1ch] overflow-x-auto overscroll-contain"
          style={{ scrollbarGutter: 'stable' }}
        >
          {images.map((src, index) => (
            <Thumbnail
              key={`${src}-${index}`}
              src={src}
              active={index === activeImageIndex}
              update={() => activeImageIndexAssign(index)}
            />
          ))}
        </div>
        <button
          onClick={handleClick('next')}
          className="flex-shrink-0 rounded-md bg-black/20 hover:bg-black/40"
        >
          <ChevronRight cn="size-8" />
        </button>
      </div>
    </div>
  )
}

function Thumbnail(props: {
  src: string
  active: boolean
  update: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!props.active || !ref.current) return

    const container = ref.current.parentElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const activeRect = ref.current.getBoundingClientRect()
    const isOutOfViewLeft = activeRect.left < containerRect.left
    const isOutOfViewRight = activeRect.right > containerRect.right
    if (!isOutOfViewLeft && !isOutOfViewRight) return

    const distance = isOutOfViewLeft
      ? activeRect.left - containerRect.left
      : activeRect.right - containerRect.right

    container.scrollTo({
      left: container.scrollLeft + distance,
      behavior:
        Math.abs(distance) > activeRect.width * 1.5 ? 'instant' : 'smooth',
    })
  }, [props.active])

  return (
    <div
      ref={ref}
      onClick={() => props.update()}
      className="group relative grid aspect-[3/4] h-32 cursor-pointer touch-manipulation select-none snap-start snap-always"
    >
      <img
        src={props.src}
        alt="image"
        className="mx-auto h-full min-h-0 object-cover object-center"
      />
      <div
        data-active={props.active}
        className="absolute inset-0 bg-black/40 transition-opacity group-hover:opacity-0 data-[active=true]:opacity-0"
      />
    </div>
  )
}
function ChevronLeft(props: { cn?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={props.cn ?? 'size-6'}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5 8.25 12l7.5-7.5"
      />
    </svg>
  )
}
function ChevronRight(props: { cn?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={props.cn ?? 'size-6'}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  )
}
