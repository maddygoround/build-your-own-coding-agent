export type Result<T> = Promise<[Error, undefined] | [undefined, T]>;

/**
 * Wraps a promise to return a tuple of [error, value].
 * This allows for error handling without try/catch blocks.
 * 
 * @param p The promise to wrap
 * @returns A Result tuple of [error, value]
 */
export async function wrapErr<T>(p: Promise<T>): Result<T> {
    try {
        const val = await p;
        return [undefined, val];
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return [error, undefined];
    }
}
