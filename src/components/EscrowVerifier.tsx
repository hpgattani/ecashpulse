import { ExternalLink, Shield, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface EscrowVerifierProps {
  escrowAddress: string;
  scriptHex?: string | null;
  className?: string;
}

const EscrowVerifier = ({ escrowAddress, scriptHex, className = "" }: EscrowVerifierProps) => {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  const explorerUrl = `https://explorer.e.cash/address/${escrowAddress}`;
  const shortAddress = escrowAddress.replace('ecash:', '').slice(0, 8) + '...' + escrowAddress.slice(-6);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(escrowAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Shield className="w-3.5 h-3.5 text-primary" />
        <span>Per-Market Escrow</span>
      </div>

      <div className="flex items-center gap-2">
        <code className="text-xs font-mono text-foreground bg-background/50 px-2 py-1 rounded flex-1 truncate">
          {shortAddress}
        </code>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Copy address"
        >
          {copied ? (
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors p-1"
          title="View on explorer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {scriptHex && (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Script verification
          </summary>
          <code className="block mt-1 text-[10px] font-mono text-muted-foreground bg-background/50 p-2 rounded break-all">
            {scriptHex}
          </code>
        </details>
      )}
    </div>
  );
};

export default EscrowVerifier;
