export function to<A extends {}>(a: () => A) {
  return builder(a())
}

function builder<T extends {}>(state: T) {
  return {
    /**
     * Concatenates the result of several function calls. Optionally passes
     * the result of previous calls to subsequent calls.
     * @param fn
     */
    apply: <U extends {}>(fn: ((prev: T) => U) | (() => U)) => {
      const result = fn.length
        ? (fn as (prev: T) => U)(state)
        : (fn as () => U)()
      return builder(Object.assign({}, state, result) as Flatten<Sort<T & U>>)
    },
    /**
     *
     * @returns The final evaluated object
     */
    get: () => state as Flatten<Sort<T>>,
  }
}

type Flatten<T> = {
  [K in keyof T]: T[K]
} & {}

type Sort<T> = {
  [K in NonFunctionKeys<T>]: T[K]
} & {
  [K in FunctionKeys<T>]: T[K]
}
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K
}[keyof T]

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T]
