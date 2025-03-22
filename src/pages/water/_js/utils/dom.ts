export function getElementById<T extends HTMLElement>(id: string) {
  const el = document.getElementById(id)
  if (!el) throw new Error(`No element with id ${id}`)
  return el as T
}
