/**
 * Аппын entry — monorepo-д найдвартай (node_modules root-д hoist болдог тул
 * `expo/AppEntry.js` рүү шууд заах нь ажиллахгүй).
 */
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
