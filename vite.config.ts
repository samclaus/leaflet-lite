import { defineConfig } from 'vite'
import circularDependency from 'vite-plugin-circular-dependency';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        // NOTE: this plugin will only detect circular dependencies when
        // building for production via 'vite build', not in dev mode
        circularDependency({}),
    ],
});
