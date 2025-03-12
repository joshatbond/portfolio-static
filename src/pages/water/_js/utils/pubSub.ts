export function pubSubBuilder<EventType extends string, DataType>() {
  const subscribers = new Map<string, Array<(data: DataType) => void>>()

  return {
    /**
     *
     * @param event The event name
     * @param data The data to pass to subscribers when the event is triggered
     * @returns
     */
    publish(event: EventType, data: DataType) {
      if (!subscribers.has(event)) return

      for (const callback of subscribers.get(event)!) callback(data)
    },
    /**
     *
     * @param event The event name
     * @param callback A function to trigger when an event is fired
     * @returns A function to unsubscribe from future events
     */
    subscribe(event: EventType, callback: (data: DataType) => void) {
      if (!subscribers.has(event)) subscribers.set(event, [])

      const index = subscribers.get(event)!.push(callback) - 1

      /**
       * Call this function to unsubscribe from the event
       */
      function unsubscribe() {
        subscribers.get(event)!.splice(index, 1)
      }

      return unsubscribe
    },
  }
}
