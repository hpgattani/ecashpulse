// PayButton global type declaration
export interface PayButtonTransaction {
  hash: string;
  amount: string;
  paymentId: string;
  confirmed?: boolean;
  message: string;
  timestamp: number;
  address: string;
  rawMessage?: string;
  inputAddresses?: string[];
  txid?: string;
}

export interface PayButtonConfig {
  to: string;
  amount: number;
  currency: string;
  text?: string;
  hoverText?: string;
  successText?: string;
  animation?: string;
  hideToasts?: boolean;
  onSuccess?: (tx: PayButtonTransaction) => void;
  onTransaction?: (tx: PayButtonTransaction) => void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    PayButton?: {
      render: (element: HTMLElement, config: PayButtonConfig) => void;
    };
  }
}
