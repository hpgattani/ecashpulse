// Chronik helpers using the official chronik-client (protobuf) with multi-endpoint failover.
// NOTE: Chronik returns output values in SATOSHIS (1 XEC = 100 sats).
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';

export const CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://chronik.be.cash',
  'https://xec.paybutton.org',
  'https://chronik.pay2stay.com/xec',
  'https://chronik.pay2stay.com/xec2',
  'https://chronik1.alitayin.com',
  'https://chronik2.alitayin.com',
];

const chronik = new ChronikClient(CHRONIK_URLS);

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

export async function chronikFetchTx(txid: string): Promise<any | null> {
  try {
    return await chronik.tx(txid);
  } catch (e) {
    console.log(`chronikFetchTx failed for ${txid}:`, (e as Error)?.message);
    return null;
  }
}

export async function chronikFetchAddressHistory(address: string, pageSize = 50): Promise<any[]> {
  // Try address endpoint, then script endpoint as fallback.
  try {
    const res = await chronik.address(address).history(0, pageSize);
    if (Array.isArray(res?.txs)) return res.txs;
  } catch (e) {
    console.log('chronik address history failed:', (e as Error)?.message);
  }
  try {
    const hash = addressToHash160Hex(address);
    if (hash) {
      const res = await chronik.script('p2pkh', hash).history(0, pageSize);
      if (Array.isArray(res?.txs)) return res.txs;
    }
  } catch (e) {
    console.log('chronik script history failed:', (e as Error)?.message);
  }
  return [];
}

// True if tx pays exactly `xecAmount` XEC to `outputScript`.
// Chronik values are ALWAYS satoshis (1 XEC = 100 sats) — match strictly.
export function txPaysExactly(tx: any, outputScript: string, xecAmount: number): boolean {
  const expectedSats = Math.round(xecAmount * 100);
  for (const o of tx?.outputs || []) {
    if (o.outputScript !== outputScript) continue;
    if (outputSats(o) === expectedSats) return true;
  }
  return false;
}
