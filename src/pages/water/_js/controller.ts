import { pubSubBuilder } from './utils/pubSub'

export function controller(keyConfig: { onDown?: string[]; onUp?: string[] }) {
  const keyBroker = pubSubBuilder<string, { key: string }>()
  const mouseBroker = pubSubBuilder<
    'mouseUp' | 'mouseDown' | 'mousePress',
    MouseEvent
  >()

  if (keyConfig.onDown) {
    document.addEventListener('keydown', keyHandler('onDown'))
  }
  if (keyConfig.onUp) {
    document.addEventListener('keyup', keyHandler('onUp'))
  }

  return {
    subscribe: {
      keyboard: keyBroker.subscribe,
      mouse: mouseBroker.subscribe,
    },
  }

  function keyHandler(type: keyof typeof keyConfig) {
    return function handler(event: KeyboardEvent) {
      if (!keyConfig[type]) return

      for (const key of keyConfig[type]) {
        if (event.key === key) keyBroker.publish(type, { key })
      }
    }
  }
}
