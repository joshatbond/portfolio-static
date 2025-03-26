/**
 * @description Generates indices into a list of unique objects from a stream
 * of objects that may contain duplicates. This is useful for generating
 * compact indexed meshes from unindexed data.
 */
export class Indexer<T> {
  unique: T[]
  map: Record<string, number>

  constructor() {
    this.unique = []
    this.map = {}
  }

  public add(el: T) {
    const key = JSON.stringify(el)
    if (!(key in this.map)) {
      this.map[key] = this.unique.length
      this.unique.push(el)
    }

    return this.map[key]
  }
}
