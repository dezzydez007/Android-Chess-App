import { KeepAwake } from '@capacitor-community/keep-awake'

const IDLE_TIMER_DELAY = 15 * 60 * 1000
const SLEEP_DELAY = 45 * 60 * 1000

let sleepAgainTimeoutId: number
let cancelTimer: (() => void) | undefined

export function keepAwake(): void {
  KeepAwake.keepAwake()
  if (cancelTimer !== undefined) {
    cancelTimer()
  }
  cancelTimer = idleTimer(
    IDLE_TIMER_DELAY,
    () => {
      sleepAgainTimeoutId = setTimeout(() => {
        KeepAwake.allowSleep()
      }, SLEEP_DELAY)
    },
    () => {
      clearTimeout(sleepAgainTimeoutId)
    }
  )
}

export function allowSleepAgain(): void {
  if (cancelTimer !== undefined) {
    cancelTimer()
    cancelTimer = undefined
  }
  KeepAwake.allowSleep()
}

function idleTimer(delay: number, onIdle: () => void, onWakeUp: () => void): () => void {
  const events = ['touchstart']
  let listening = false
  let active = true
  let lastSeenActive = performance.now()
  let intervalID: number | undefined = undefined
  const onActivity = () => {
    if (!active) {
      // console.log('Wake up')
      onWakeUp()
    }
    active = true
    lastSeenActive = performance.now()
    stopListening()
  }
  const startListening = () => {
    if (!listening) {
      events.forEach((e) => {
        document.addEventListener(e, onActivity)
      })
      listening = true
    }
  }
  const stopListening = () => {
    if (listening) {
      events.forEach((e) => {
        document.removeEventListener(e, onActivity)
      })
      listening = false
    }
  }
  const cancel = () => {
    clearInterval(intervalID)
    stopListening()
  }
  intervalID = setInterval(() => {
    if (active && performance.now() - lastSeenActive > delay) {
      // console.log('Idle mode')
      onIdle()
      active = false
    }
    startListening()
  }, 30 * 1000)

  return cancel
}
