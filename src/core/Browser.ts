
const userAgentLower = navigator.userAgent.toLowerCase();

/**
 * Are we running in the Chrome browser?
 */
export const chrome: boolean = userAgentLower.includes('chrome');

/**
 * Are we running in the Safari browser?
 */
export const safari: boolean = !chrome && userAgentLower.includes('safari');

/**
 * Are we running on a mobile device?
 */
export const mobile: boolean = typeof orientation !== 'undefined' || userAgentLower.includes('mobile');

/**
 * Does the browser we are running in support [pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)?
 */
export const pointer: boolean = !!window.PointerEvent;

/**
 * Does the browser we are running in support [touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)?
 * 
 * NOTE: this does not mean that the host computer has a touchscreen, just that the browser is capable of
 * understanding touch events.
 */
export const touchNative: boolean = 'ontouchstart' in window || !!window.TouchEvent;

/**
 * Does the browser we are running into support either [pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) or [touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events), or both?
 */
export const touch: boolean = touchNative || pointer;

/**
 * Are we running on a device with a high DPI "retina" screen, or is the browser's display zoom more
 * than 100%?
 * 
 * @deprecated Browser zoom can easily change during the lifetime of the page, so any code that relies
 * on that information need to listen for events.
 */
export const retina: boolean = (
	window.devicePixelRatio ||
	((window.screen as any).deviceXDPI / (window.screen as any).logicalXDPI)
) > 1;

/**
 * Are we running on a Mac computer (OS X)?
 */
export const mac: boolean = navigator.platform.startsWith('Mac');


/**
 * Are we running on Linux?
 */
export const linux = navigator.platform.startsWith('Linux');
