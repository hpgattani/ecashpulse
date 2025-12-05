import { useEffect, useState, useCallback, useRef } from 'react';
import { ChronikClient, ScriptEndpoint, WsEndpoint, WsMsgClient } from 'chronik-client';

const CHRONIK_URLS = [
  'https://chronik.e.cash',
  'https://chronik.fabien.cash',
];

export interface ChronikTx {
  txid: string;
  version: number;
  inputs: any[];
  outputs: any[];
  lockTime: number;
  timeFirstSeen: number;
  size: number;
  isCoinbase: boolean;
  block?: {
    height: number;
    hash: string;
    timestamp: number;
  };
}

export const useChronik = () => {
  const [client, setClient] = useState<ChronikClient | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WsEndpoint | null>(null);

  useEffect(() => {
    const initChronik = async () => {
      try {
        // Connect to the first available chronik server
        for (const url of CHRONIK_URLS) {
          try {
            const chronik = new ChronikClient([url]);
            // Test connection
            await chronik.blockchainInfo();
            setClient(chronik);
            setConnected(true);
            console.log('Connected to Chronik:', url);
            break;
          } catch (e) {
            console.warn(`Failed to connect to ${url}:`, e);
          }
        }
      } catch (error) {
        console.error('Failed to initialize Chronik client:', error);
      }
    };

    initChronik();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const subscribeToAddress = useCallback(
    async (address: string, onTx: (tx: WsMsgClient) => void) => {
      if (!client) return null;

      try {
        // Convert eCash address to script type and hash
        const ws = client.ws({
          onMessage: (msg) => {
            if (msg.type === 'Tx') {
              onTx(msg);
            }
          },
          onReconnect: (e) => {
            console.log('Chronik WS reconnecting:', e);
          },
        });

        await ws.waitForOpen();
        
        // Subscribe to the address script
        // For p2pkh addresses (ecash:q...), we need to extract the hash
        const addressHash = address.replace('ecash:', '').replace('q', '');
        ws.subscribeToScript('p2pkh', addressHash);
        
        wsRef.current = ws;
        return ws;
      } catch (error) {
        console.error('Failed to subscribe to address:', error);
        return null;
      }
    },
    [client]
  );

  const getAddressHistory = useCallback(
    async (address: string, page = 0, pageSize = 25): Promise<ChronikTx[]> => {
      if (!client) return [];

      try {
        const addressHash = address.replace('ecash:', '').replace('q', '');
        const history = await client.script('p2pkh', addressHash).history(page, pageSize);
        return history.txs as ChronikTx[];
      } catch (error) {
        console.error('Failed to get address history:', error);
        return [];
      }
    },
    [client]
  );

  const getUtxos = useCallback(
    async (address: string) => {
      if (!client) return [];

      try {
        const addressHash = address.replace('ecash:', '').replace('q', '');
        const utxos = await client.script('p2pkh', addressHash).utxos();
        return utxos;
      } catch (error) {
        console.error('Failed to get UTXOs:', error);
        return [];
      }
    },
    [client]
  );

  const getTx = useCallback(
    async (txid: string): Promise<ChronikTx | null> => {
      if (!client) return null;

      try {
        const tx = await client.tx(txid);
        return tx as ChronikTx;
      } catch (error) {
        console.error('Failed to get tx:', error);
        return null;
      }
    },
    [client]
  );

  return {
    client,
    connected,
    subscribeToAddress,
    getAddressHistory,
    getUtxos,
    getTx,
  };
};
