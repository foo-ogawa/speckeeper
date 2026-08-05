/**
 * Path normalisation
 *
 * Paths enter this system from the file system — glob results, relative() output
 * — where the separator is whatever the platform uses. Everything downstream
 * compares them against paths declared in specs and configuration, which are
 * written with forward slashes, and reports them to callers who do the same. The
 * separator is therefore normalised at the boundary where a path enters, not at
 * each of the places that later reads it.
 */

/** Converts a file-system path to the forward-slash form the specs are written in. */
export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/** Converts every path in a file-system result set. */
export function toPosixPaths(filePaths: string[]): string[] {
  return filePaths.map(toPosixPath);
}
