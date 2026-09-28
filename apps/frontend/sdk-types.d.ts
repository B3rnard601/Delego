import "@delegolabs/sdk";

declare module "@delegolabs/sdk" {
  interface DelegoClient {
    rejectOrder(
      id: string,
      reason?: string,
      reasonCode?: string
    ): Promise<import("@delegolabs/types").ApiResponse<import("@delegolabs/types").Order>>;
  }
}

export interface PurchaseProposal {
  proposalId: string;
  orderId: string;
  itemTitle: string;
  amountStroops: string;
  assetCode: string;
  merchantAddress: string;
  estimatedDeliveryDays: number;
  requiresApproval: boolean;
  spendingLimitRemainingStroops: string;
  expiresAt: string;
}

export interface PurchaseProposalCardProps {
  proposal: PurchaseProposal;
  onApprove: (proposalId: string) => Promise<void>;
  onDecline: (proposalId: string, reason?: string) => Promise<void>;
}
