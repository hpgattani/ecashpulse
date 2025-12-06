import { useEffect, useRef, useCallback } from 'react';
import { ChronikClient } from 'chronik-client';

const CHRONIK_URL = 'https://chronik.e.cash';
const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';

// Convert eCash address to script hash
const addressToScriptHash = (address: string): string => {
  // Remove prefix and get the hash part
  // ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a
  // For p2pkh, remove 'ecash:q' prefix
  const cleaned = address.replace('ecash:q', '');
  return cleaned;
};

interface PendingBet {
  id: string;
  amount: number;
  position: 'yes' | 'no';
  predictionId: string;
  userId: string;
  sessionToken: string;
  timestamp: number;
}

interface TransactionCallback {
  (txid: string, amount: number): void;
}

export const useEscrowMonitor = () => {
  const clientRef = useRef<ChronikClient | null>(null);
  const wsRef = useRef<any>(null);
  const callbacksRef = useRef<Set<TransactionCallback>>(new Set());
  const processedTxsRef = useRef<Set<string>>(new Set());

  // Initialize client
  useEffect(() => {
    const init = async () => {
      try {
        const client = new ChronikClient([CHRONIK_URL]);
        await client.blockchainInfo(); // Test connection
        clientRef.current = client;
        console.log('[EscrowMonitor] Connected to Chronik');
      } catch (error) {
        console.error('[EscrowMonitor] Failed to connect:', error);
      }
    };
    init();
  }, []);

  // Subscribe to escrow address transactions
  const startMonitoring = useCallback(async () => {
    if (!clientRef.current || wsRef.current) return;

    try {
      const scriptHash = addressToScriptHash(ESCROW_ADDRESS);
      console.log('[EscrowMonitor] Subscribing to:', ESCROW_ADDRESS, 'hash:', scriptHash);

      const ws = clientRef.current.ws({
        onMessage: (msg: any) => {
          console.log('[EscrowMonitor] WS message:', msg);
          if (msg.type === 'Tx') {
            handleNewTransaction(msg.txid);
          }
        },
        onReconnect: () => {
          console.log('[EscrowMonitor] WS reconnecting...');
        },
        onError: (e: any) => {
          console.error('[EscrowMonitor] WS error:', e);
        }
      });

      await ws.waitForOpen();
      ws.subscribeToScript('p2pkh', scriptHash);
      wsRef.current = ws;
      console.log('[EscrowMonitor] Subscribed to escrow address');
    } catch (error) {
      console.error('[EscrowMonitor] Failed to subscribe:', error);
    }
  }, []);

  // Handle new transaction
  const handleNewTransaction = async (txid: string) => {
    if (processedTxsRef.current.has(txid)) return;
    processedTxsRef.current.add(txid);

    console.log('[EscrowMonitor] New transaction detected:', txid);

    try {
      const tx = await clientRef.current?.tx(txid);
      if (!tx) return;

      // Find outputs to escrow address
      const escrowOutput = tx.outputs.find((output: any) => {
        const outputScript = output.outputScript;
        // Check if output is to our escrow address
        return outputScript?.includes(addressToScriptHash(ESCROW_ADDRESS));
      });

      if (escrowOutput) {
        const outputVal = (escrowOutput as any).value || (escrowOutput as any).sats || '0';
        const amountSats = typeof outputVal === 'string' ? parseInt(outputVal) : outputVal;
        const amountXec = amountSats / 100; // Convert satoshis to XEC
        console.log('[EscrowMonitor] Escrow received:', amountXec, 'XEC from tx:', txid);

        // Notify all callbacks
        callbacksRef.current.forEach(cb => cb(txid, amountXec));
      }
    } catch (error) {
      console.error('[EscrowMonitor] Error processing tx:', error);
    }
  };

  // Register a callback for transaction notifications
  const onTransaction = useCallback((callback: TransactionCallback) => {
    callbacksRef.current.add(callback);
    return () => {
      callbacksRef.current.delete(callback);
    };
  }, []);

  // Fetch recent transactions to escrow
  const getRecentTransactions = useCallback(async (limit = 10) => {
    if (!clientRef.current) return [];

    try {
      const scriptHash = addressToScriptHash(ESCROW_ADDRESS);
      const history = await clientRef.current.script('p2pkh', scriptHash).history(0, limit);
      return history.txs;
    } catch (error) {
      console.error('[EscrowMonitor] Failed to get history:', error);
      return [];
    }
  }, []);

  // Check if a specific tx exists
  const verifyTransaction = useCallback(async (txid: string): Promise<{ exists: boolean; amount?: number }> => {
    if (!clientRef.current) return { exists: false };

    try {
      const tx = await clientRef.current.tx(txid);
      if (!tx) return { exists: false };

      // Calculate total amount sent to escrow
      let totalToEscrow = 0;
      const scriptHash = addressToScriptHash(ESCROW_ADDRESS);
      
      tx.outputs.forEach((output: any) => {
        const outputValue = (output as any).value || (output as any).sats || 0;
        if (output.outputScript?.includes(scriptHash)) {
          totalToEscrow += typeof outputValue === 'string' ? parseInt(outputValue) : outputValue;
        }
      });

      return { exists: true, amount: totalToEscrow / 100 };
    } catch (error) {
      console.error('[EscrowMonitor] Failed to verify tx:', error);
      return { exists: false };
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    startMonitoring,
    onTransaction,
    getRecentTransactions,
    verifyTransaction,
    isConnected: !!clientRef.current
  };
};
