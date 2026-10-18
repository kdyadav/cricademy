import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Keep the splash up until the first screen is resolved, and long enough not to flicker.
const SPLASH_MIN_MS = 900
router
  .isReady()
  .catch(() => {})
  .then(() => new Promise((resolve) => setTimeout(resolve, Math.max(0, SPLASH_MIN_MS - performance.now()))))
  .then(() => {
    const splash = document.getElementById('splash')
    if (!splash) return
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    splash.classList.add('splash-hide')
    setTimeout(() => splash.remove(), 600)
  })
