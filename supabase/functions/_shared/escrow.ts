import * as secp from 'https://esm.sh/@noble/secp256k1@2.1.0';

import { cashAddrToHash160, fromHex, getPublicKey, hash160, toHex } from './crypto.ts';
import { hash160ToCashAddr, scriptHexToCashAddr } from './cashaddr.ts';

export interface EscrowMaterial {
  escrowAddress: string;
  privkeyHex: string;
  pubkeyHex: string;
  pubkeyHashHex: string;
  scriptHex: string;
}

export async function deriveEscrowMaterialFromPrivateKey(privkeyHex: string): Promise<EscrowMaterial> {
  const privateKeyBytes = fromHex(privkeyHex);
  const publicKeyBytes = await getPublicKey(privateKeyBytes, true);
  const pubkeyHash = await hash160(publicKeyBytes);
  const pubkeyHashHex = toHex(pubkeyHash);
  const scriptHex = `76a914${pubkeyHashHex}88ac`;
  const escrowAddress = hash160ToCashAddr(pubkeyHash);

  return {
    escrowAddress,
    privkeyHex,
    pubkeyHex: toHex(publicKeyBytes),
    pubkeyHashHex,
    scriptHex,
  };
}

export async function generateEscrowMaterial(): Promise<EscrowMaterial> {
  const privateKeyBytes = secp.utils.randomPrivateKey();
  return deriveEscrowMaterialFromPrivateKey(toHex(privateKeyBytes));
}

export function isEscrowMaterialConsistent(material: Pick<EscrowMaterial, 'escrowAddress' | 'scriptHex' | 'pubkeyHashHex'>): boolean {
  const addressHash = cashAddrToHash160(material.escrowAddress);
  const scriptAddress = scriptHexToCashAddr(material.scriptHex);

  return Boolean(
    addressHash &&
    toHex(addressHash) === material.pubkeyHashHex &&
    scriptAddress === material.escrowAddress,
  );
}