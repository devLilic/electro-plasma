/// <reference types="vite/client" />

import type { PlasmaApi } from '../shared/plasma-api'

declare global {
  interface Window {
    plasma: PlasmaApi
  }
}

export {}
