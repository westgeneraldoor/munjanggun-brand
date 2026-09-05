export function parseStrictArgs(argv, { valueFlags, booleanFlags = [], multipleFlags = [] }) {
  const values = new Set(valueFlags); const booleans = new Set(booleanFlags); const multiples = new Set(multipleFlags);
  const known = new Set([...values, ...booleans]); const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!known.has(token)) throw new Error(`Unknown argument ${token}`);
    if (booleans.has(token)) { if (parsed.has(token)) throw new Error(`Duplicate argument ${token}`); parsed.set(token, [true]); continue; }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (!multiples.has(token) && parsed.has(token)) throw new Error(`Duplicate argument ${token}`);
    parsed.set(token, [...(parsed.get(token) ?? []), value]); index += 1;
  }
  return parsed;
}
export function one(args, name) { return args.get(name)?.[0]; }
export function many(args, name) { return args.get(name) ?? []; }
export function flag(args, name) { return args.get(name)?.[0] === true; }
export function required(args, name) { const value = one(args, name); if (!value) throw new Error(`Missing required argument ${name}`); return value; }
