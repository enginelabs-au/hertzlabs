import fs from 'fs';

/** Parse .env with multiline PEM / JSON support. Never log return values. */
export function parseEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    out[key] = buf.join('\n').trim().replace(/^["']|["']$/g, '');
    key = null;
    buf = [];
  };
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!key && (!t || t.startsWith('#'))) continue;
    if (!key) {
      const i = line.indexOf('=');
      if (i < 0) continue;
      key = line.slice(0, i).trim();
      buf = [line.slice(i + 1)];
      if (buf[0].includes('-----END') || buf[0].startsWith('{')) flush();
      else if (!buf[0].includes('-----BEGIN')) flush();
      continue;
    }
    buf.push(line);
    if (line.includes('-----END') || (buf[0].startsWith('{') && line.trimEnd().endsWith('}'))) flush();
  }
  flush();
  return out;
}

/** Upsert a single key in .env without touching other lines/secrets. */
export function upsertEnv(filePath, key, value) {
  const line = `${key}=${value}`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${line}\n`, 'utf8');
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(raw)) {
    fs.writeFileSync(filePath, raw.replace(re, line), 'utf8');
  } else {
    fs.writeFileSync(filePath, raw.replace(/\s*$/, `\n${line}\n`), 'utf8');
  }
}
