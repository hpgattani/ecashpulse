// Minimal Chronik REST helpers (JSON via Accept header) with multi-endpoint failover.
// NOTE: Chronik returns output values in SATOSHIS (1 XEC = 100 sats).

export const CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://chronik.be.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
  'https://chronik.pay2stay.com/xec2',
  'https://chronik1.alitayin.com',
  'https://chronik2.alitayin.com',
];

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export function addressToHash160Hex(address: string): string | null {
  try {
    const addr = address.replace('ecash:', '');
    const data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const idx = CHARSET.indexOf(addr[i].toLowerCase());
      if (idx === -1) return null;
      data.push(idx);
    }
    const payload5 = data.slice(0, data.length - 8);
    let acc = 0;
    let bits = 0;
    const out: number[] = [];
    for (const v of payload5) {
      acc = (acc << 5) | v;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        out.push((acc >> bits) & 0xff);
      }
    }
    if (out.length < 21) return null;
    return out
      .slice(1, 21)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export function addressToOutputScript(address: string): string | null {
  const h = addressToHash160Hex(address);
  return h ? `76a914${h}88ac` : null;
}

export function outputSats(o: any): number {
  return Number(o?.sats ?? o?.value ?? 0);
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function chronikFetchTx(txid: string): Promise<any | null> {
  for (const base of CHRONIK_URLS) {
    const data = await fetchJson(`${base}/tx/${txid}`);
    if (data?.txid) return data;
  }
  return null;
}

export async function chronikFetchAddressHistory(address: string, pageSize = 50): Promise<any[]> {
  const hash = addressToHash160Hex(address);
  const paths: string[] = [];
  if (hash) paths.push(`/script/p2pkh/${hash}/history`);
  paths.push(`/address/${address.replace('ecash:', '')}/history`);
  for (const base of CHRONIK_URLS) {
    for (const path of paths) {
      const data = await fetchJson(`${base}${path}?page=0&page_size=${pageSize}&pageSize=${pageSize}`);
      if (Array.isArray(data?.txs)) return data.txs;
    }
  }
  return [];
}

// True if tx pays exactly `xecAmount` XEC to `outputScript` (chronik values are sats).
export function txPaysExactly(tx: any, outputScript: string, xecAmount: number): boolean {
  for (const o of tx?.outputs || []) {
    if (o.outputScript !== outputScript) continue;
    const sats = outputSats(o);
    if (sats === Math.round(xecAmount * 100) || sats === xecAmount) return true;
  }
  return false;
}
