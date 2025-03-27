import { pubSubBuilder } from './utils/pubSub'

/**
 *
 * @param keyConfig An object defining the keys that should be observed
 * @param options An optional object to specify how the controller should behave
 * @returns
 */
export function controller(
  keyConfig: { onDown: string[]; onUp?: string[] },
  options: { caseSensitive: boolean } = { caseSensitive: true }
) {
  const keyBroker = pubSubBuilder<string, string>()

  if (keyConfig.onDown) {
    document.addEventListener('keydown', keyHandler('onDown'))
  }
  if (keyConfig.onUp) {
    document.addEventListener('keyup', keyHandler('onUp'))
  }

  return {
    subscribe: keyBroker.subscribe,
  }

  function keyHandler(type: keyof typeof keyConfig) {
    return function handler(event: KeyboardEvent) {
      const config = keyConfig[type] ?? keyConfig.onDown
      for (const key of config) {
        if ((options.caseSensitive ? key : key.toLowerCase()) === event.key)
          keyBroker.publish(type, key.toLowerCase())
      }
    }
  }
}
