/**
 * Path pattern expansion
 *
 * The one place a path pattern — from configuration, from a spec, from a
 * caller — is expanded into the files and directories it names. Results are
 * `/`-separated, the form specs and configuration are written in.
 *
 * Syntax:
 * - `*` matches any characters within one path segment, `?` one character,
 *   `[abc]` / `[a-z]` / `[!a]` one character of a set.
 * - A `**` segment matches zero or more directories.
 * - `{a,b}` expands to each alternative (nesting allowed).
 * - A name beginning with `.` is matched by `*`, `?`, `[...]` and `**` only
 *   when the pattern segment itself begins with `.`; `.` and `..` are only
 *   ever matched literally.
 * - A trailing `/` matches directories only.
 *
 * Extended globs (`@(...)`, `!(...)` …), brace ranges (`{1..3}`) and `\`
 * escapes are not supported and are rejected rather than matched literally.
 *
 * Matching is case-insensitive on macOS and Windows, case-sensitive elsewhere.
 * A symbolic link is listed like any entry. A linked directory is entered by a
 * segment other than `**`, and by a `**` that does not begin the pattern, which
 * then ends at the link (as in Bash); a leading `**` does not enter links.
 */
import { lstatSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, posix, resolve } from 'node:path';

export interface GlobOptions {
  /** Directory relative patterns are expanded against (default: `process.cwd()`). */
  cwd?: string;
  /**
   * Patterns for paths to leave out. A relative pattern is matched against the
   * path relative to `cwd`, an absolute one against the absolute path; `.`
   * names are matched as ordinary names. A pattern ending in `/**` also leaves
   * out the directory it ends at, which is then not entered.
   */
  ignore?: string[];
  /** Return absolute paths instead of paths relative to `cwd`. */
  absolute?: boolean;
}

/** Expands `pattern` into the matching paths, sorted. */
export function globSync(pattern: string, options: GlobOptions = {}): string[] {
  const cwd = resolve(options.cwd ?? process.cwd());
  const ignore = (options.ignore ?? []).flatMap(expandBraces).map(compileIgnore);
  const found = new Set<string>();

  for (const expanded of expandBraces(pattern)) {
    const { root, segments, dirOnly } = splitPattern(expanded);
    if (segments.length === 0) continue;
    new Walker(segments, dirOnly, ignore, root !== '' || options.absolute === true, cwd, found)
      .start(root === '' ? cwd : root, root);
  }

  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Pattern parsing
// ---------------------------------------------------------------------------

const NOCASE = process.platform === 'darwin' || process.platform === 'win32';

function unsupported(pattern: string, what: string): never {
  throw new Error(`Unsupported glob syntax in "${pattern}": ${what}`);
}

/** `{a,b}` alternatives, expanded left to right; a brace with no top-level comma is literal. */
function expandBraces(pattern: string): string[] {
  if (pattern.includes('\\')) unsupported(pattern, '"\\" escapes');
  if (/[@!+?*]\(/.test(pattern)) unsupported(pattern, 'extended glob');

  for (let open = pattern.indexOf('{'); open !== -1; open = pattern.indexOf('{', open + 1)) {
    let depth = 0;
    const commas: number[] = [];
    let close = -1;
    for (let i = open; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) { close = i; break; }
      else if (c === ',' && depth === 1) commas.push(i);
    }
    if (close === -1) return [pattern];
    const body = pattern.slice(open + 1, close);
    if (commas.length === 0) {
      if (/^(-?\d+|[A-Za-z])\.\.(-?\d+|[A-Za-z])(\.\.-?\d+)?$/.test(body)) {
        unsupported(pattern, `brace range "{${body}}"`);
      }
      continue;
    }
    const head = pattern.slice(0, open);
    const tail = pattern.slice(close + 1);
    const bounds = [open, ...commas, close];
    const alternatives: string[] = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      alternatives.push(pattern.slice(bounds[k] + 1, bounds[k + 1]));
    }
    return alternatives.flatMap(alt => expandBraces(head + alt + tail));
  }
  return [pattern];
}

interface SplitPattern {
  /** '' for a relative pattern, otherwise the absolute root ('/' or a drive root) */
  root: string;
  segments: string[];
  dirOnly: boolean;
}

function splitPattern(pattern: string): SplitPattern {
  const absolute = isAbsolute(pattern);
  const parts = pattern.split('/');
  let root = '';
  if (absolute) {
    root = parts[0] === '' ? '/' : `${parts[0]}/`;
    parts.shift();
  }
  while (parts.length > 1 && parts[0] === '.') parts.shift();
  const dirOnly = parts.length > 1 && parts[parts.length - 1] === '';
  const segments = parts.filter((p, i) => p !== '' || i === 0).filter(p => p !== '');
  // Consecutive `**` segments are one `**`.
  const collapsed = segments.filter((s, i) => !(s === '**' && segments[i - 1] === '**'));
  return { root, segments: collapsed, dirOnly };
}

const MAGIC = /[*?[]/;

const segmentCache = new Map<string, RegExp>();

/** Whether `name` matches the single pattern segment `segment` (not `**`). */
function matchSegment(name: string, segment: string, dot: boolean): boolean {
  if (!MAGIC.test(segment)) return NOCASE ? name.toLowerCase() === segment.toLowerCase() : name === segment;
  if (name === '.' || name === '..') return false;
  if (!dot && name.startsWith('.') && !segment.startsWith('.')) return false;
  let re = segmentCache.get(segment);
  if (!re) {
    re = new RegExp(`^${segmentSource(segment)}$`, NOCASE ? 'i' : '');
    segmentCache.set(segment, re);
  }
  return re.test(name);
}

function segmentSource(segment: string): string {
  let out = '';
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (c === '[') {
      const end = segment.indexOf(']', i + 2);
      if (end === -1) {
        out += '\\[';
        continue;
      }
      let set = segment.slice(i + 1, end);
      const negate = set.startsWith('!') || set.startsWith('^');
      if (negate) set = set.slice(1);
      out += `[${negate ? '^' : ''}${set.replace(/[\]\\^]/g, m => `\\${m}`)}]`;
      i = end;
    } else {
      out += c.replace(/[.+^${}()|\]\\]/g, m => `\\${m}`);
    }
  }
  return out;
}

/** Whether the `/`-separated `path` segments match the pattern `segments` (with `**`). */
function matchPath(segments: string[], path: string[], dot: boolean): boolean {
  const memo = new Map<string, boolean>();
  const go = (s: number, p: number): boolean => {
    const key = `${s}:${p}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let result: boolean;
    if (s === segments.length) {
      result = p === path.length;
    } else if (segments[s] === '**') {
      result = go(s + 1, p) ||
        (p < path.length && path[p] !== '.' && path[p] !== '..' &&
          (dot || !path[p].startsWith('.')) && go(s, p + 1));
    } else {
      result = p < path.length && matchSegment(path[p], segments[s], dot) && go(s + 1, p + 1);
    }
    memo.set(key, result);
    return result;
  };
  return go(0, 0);
}

// ---------------------------------------------------------------------------
// Ignore
// ---------------------------------------------------------------------------

interface CompiledIgnore {
  absolute: boolean;
  segments: string[];
  /** Ends in `/**`: what it matches is not entered either. */
  children: boolean;
}

function compileIgnore(pattern: string): CompiledIgnore {
  const { root, segments } = splitPattern(pattern);
  const rootSegments = root === '' || root === '/' ? [] : [root.replace(/\/$/, '')];
  return {
    absolute: root !== '',
    segments: [...rootSegments, ...segments],
    children: segments[segments.length - 1] === '**',
  };
}

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function joinPath(prefix: string, name: string): string {
  if (prefix === '') return name;
  return prefix.endsWith('/') ? prefix + name : `${prefix}/${name}`;
}

interface Entry {
  name: string;
  isDir: boolean;
  isLink: boolean;
}

class Walker {
  private readonly cwdPosix: string;
  /** Number of leading literal segments: the part of the pattern that names a fixed path. */
  private readonly prefixLength: number;

  constructor(
    private readonly segments: string[],
    private readonly dirOnly: boolean,
    private readonly ignore: CompiledIgnore[],
    private readonly absoluteResults: boolean,
    cwd: string,
    private readonly found: Set<string>,
  ) {
    this.cwdPosix = toPosix(cwd);
    const firstMagic = segments.findIndex(s => s === '**' || MAGIC.test(s));
    this.prefixLength = firstMagic === -1 ? segments.length : firstMagic;
  }

  /** Positions `**` lets the path also stand at: a `**` may match no directory. */
  private close(positions: Iterable<number>): number[] {
    const closed = new Set<number>();
    for (let i of positions) {
      closed.add(i);
      while (this.segments[i] === '**') closed.add(++i);
    }
    return [...closed];
  }

  /** Expands the pattern from its root (`output` is '' for a relative pattern). */
  start(root: string, output: string): void {
    if (this.close([0]).includes(this.segments.length)) {
      this.add(output === '' ? '.' : output);
    }
    this.walk(root, output, [0]);
  }

  private add(output: string): void {
    const absolute = posix.resolve(this.cwdPosix, output);
    this.found.add(this.absoluteResults ? absolute : posix.relative(this.cwdPosix, absolute) || '.');
  }

  /**
   * `dir` is the directory on disk, `output` the path it is reported as, and
   * `positions` the pattern segments that path stands before.
   */
  private walk(dir: string, output: string, positions: number[]): void {
    const end = this.segments.length;
    const pending = this.close(positions).filter(p => p < end);
    if (pending.length === 0) return;

    const literalOnly = pending.every(p => !MAGIC.test(this.segments[p]) && this.segments[p] !== '**');
    const entries = literalOnly ? this.literalEntries(dir, pending) : this.listEntries(dir);

    for (const entry of entries) {
      const viaSegment: number[] = [];
      const viaGlobstar: number[] = [];
      for (const p of pending) {
        const segment = this.segments[p];
        if (segment === '**') {
          if (!entry.name.startsWith('.')) viaGlobstar.push(p);
        } else if (matchSegment(entry.name, segment, false)) {
          viaSegment.push(p);
        }
      }
      if (viaSegment.length === 0 && viaGlobstar.length === 0) continue;

      const childDir = joinPath(dir, entry.name);
      const childOutput = joinPath(output, entry.name);
      const absolute = posix.resolve(this.cwdPosix, childOutput);
      // The directory itself is `.`, which `**` does not match.
      const rel = (posix.relative(this.cwdPosix, absolute) || '.').split('/');
      const abs = absolute.split('/').filter(Boolean);
      const hits = this.ignore.filter(ig => matchPath(ig.segments, ig.absolute ? abs : rel, true));
      // A directory the pattern names on the way to its last literal segment is
      // part of the path the pattern starts from, not a match: ignore does not apply.
      const onTheWay = viaGlobstar.length === 0 && viaSegment.every(p => p < this.prefixLength - 1);

      // The entry is a result when it completes the pattern: by the last segment,
      // inside a trailing `**`, or just before one — the last only for a directory
      // (or a link, which may be one) or for a path the pattern names literally
      // (`file/**` names `file`). A trailing `/` asks for a directory: an entry
      // matched by name qualifies when it is, or links to, one; one taken by `**`
      // only when it is a real directory.
      const byName = !this.dirOnly || entry.isDir || entry.isLink;
      const completes =
        viaSegment.some(p => p + 1 === end && byName) ||
        viaSegment.some(p => p + 1 < end && this.close([p + 1]).includes(end) && byName &&
          (entry.isDir || entry.isLink || p < this.prefixLength)) ||
        viaGlobstar.some(p => this.close([p]).includes(end) && (!this.dirOnly || (entry.isDir && !entry.isLink)));
      if (completes && hits.length === 0) this.add(childOutput);

      if (!entry.isDir || (!onTheWay && hits.some(ig => ig.children))) continue;
      // A linked directory is entered by a segment other than `**`, and by a
      // `**` that does not begin the pattern — which then ends at the link.
      const descend = entry.isLink
        ? [...viaSegment.map(p => p + 1), ...viaGlobstar.filter(p => p > 0).map(p => p + 1)]
        : [...viaSegment.map(p => p + 1), ...viaGlobstar];
      if (descend.length > 0) this.walk(childDir, childOutput, descend);
    }
  }

  private listEntries(dir: string): Entry[] {
    let dirents;
    try {
      dirents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    return dirents.map(d => ({
      name: d.name,
      isLink: d.isSymbolicLink(),
      isDir: d.isSymbolicLink() ? isDirectory(joinPath(dir, d.name)) : d.isDirectory(),
    }));
  }

  private literalEntries(dir: string, pending: number[]): Entry[] {
    const entries: Entry[] = [];
    for (const name of new Set(pending.map(p => this.segments[p]))) {
      const path = joinPath(dir, name);
      let link;
      try {
        link = lstatSync(path);
      } catch {
        continue;
      }
      entries.push({
        name,
        isLink: link.isSymbolicLink(),
        isDir: link.isSymbolicLink() ? isDirectory(path) : link.isDirectory(),
      });
    }
    return entries;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
