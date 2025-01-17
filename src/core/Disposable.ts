
/**
 * A DisposeFn is a function that can be called to clean up resources that
 * some code has acquired, such as event listeners and timers.
 * 
 * It is safe to call a DisposeFn more than once, but it will not have any
 * effect after being called the first time.
 */
export interface DisposeFn {
    (): void;
}

/**
 * Disposable is an interface implemented by objects that add event
 * handlers, make requests on the network, etc. and need to be cleaned
 * up.
 * 
 * They implement a single `dispose()` method which is safe to call
 * more than once but will have no effect after the first call.
 * 
 * Generally, objects that implement this interface should be considered
 * invalid after `dispose()` has been called and new instances should be
 * instantiated if necessary.
 */
export interface Disposable {
    /**
     * Dispose cleans up any resources (DOM event handlers, timers, etc.)
     * associated with this object. This object should probably not be
     * reused once disposed.
     */
    dispose(): void;
}
