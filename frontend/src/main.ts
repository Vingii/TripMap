import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { useAuthStore } from './stores/auth'
import { CALLBACK_PATH, getUserManager, initOidc } from './auth/oidc'

async function bootstrap(): Promise<void> {
  // Silent-renew runs the callback route inside a hidden iframe. There we only
  // finish the token exchange and stop — mounting the full app would recurse.
  if (
    window.self !== window.top &&
    window.location.pathname === CALLBACK_PATH
  ) {
    if (await initOidc()) {
      try {
        await getUserManager().signinSilentCallback()
      } catch {
        // Surfaced to the top window via the silent-renew error event.
      }
    }
    return
  }

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  // Restore the session (silent sign-in) before mounting so the router guard
  // sees the resolved auth state on the very first navigation.
  await useAuthStore().initialize()
  app.mount('#app')
}

void bootstrap()
