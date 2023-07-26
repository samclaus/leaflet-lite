import { defineConfig } from 'vite'
import circularDependency from 'vite-plugin-circular-dependency';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        // NOTE: this plugin will only detect circular dependencies when
        // building for production via 'vite build', not in dev mode
        circularDependency({}),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/Leaflet.ts'),
            name: 'L',
            fileName: 'leaflet-lite',
        },
        rollupOptions: {
            output: {
                assetFileNames: assetInfo => {
                    // From https://stackoverflow.com/questions/68992086/how-can-i-assign-a-custom-css-file-name-when-building-a-vite-application
                    if (assetInfo.name === 'style.css') {
                        return 'leaflet-lite.css';
                    }
                    return assetInfo.name;
                },
            },
        },
    },
});
