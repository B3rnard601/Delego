/**
 * @delegolabs/types
 *
 * Shared TypeScript types for the Delego platform.
 * Re-exports from API generated types with domain-specific adaptations.
 */

// Re-export all API types
export * from "@delegolabs/api-generated";

// Import types needed for domain types
import type { OrderStatus, RejectionReasonCode } from "@delegolabs/api-generated";

// Domain-specific types (using native Date/bigint instead of string serialization)
export interface LineItem {
  productId: string;
  quantity: number;
  unitPriceStroops: bigint;
}

export interface Order {
  id: string;
  userId: string;
  delegationId: string;
  merchantId: string;
  merchantName?: string;
  status: OrderStatus;
  totalStroops: bigint;
  amount?: bigint;
  lineItems: LineItem[];
  escrowContractId: string | null;
  rejectionReason?: RejectionReasonCode | null | undefined;
  rejectionNote?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// Additional domain types that are used throughout the application
export interface Delegation {
  id: string;
  name: string;
  label?: string;
  ownerId: string;
  userId: string;
  delegateId: string;
  agentId: string;
  walletId?: string;
  permissionLevel: DelegationPermissionLevel;
  spendLimitStroops: bigint;
  usedSpendStroops: bigint;
  status: DelegationStatus;
  policy?: DelegationPolicy;
  colorTag?: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DelegationStatus = "active" | "inactive" | "expired" | "revoked";

export type DelegationPermissionLevel = "read" | "approve" | "admin" | "VIEW_ONLY" | "AUTO_APPROVE" | "SIGNER" | "ADMIN";

export interface DelegationPolicy {
  maxSpendAmount?: bigint;
  allowedMerchants?: string[];
  requiresApproval?: boolean;
  autoApproveThreshold?: bigint;
}

export interface CreateDelegationInput {
  name: string;
  delegateId: string;
  agentId?: string;
  permissionLevel: DelegationPermissionLevel;
  spendLimitStroops: bigint;
  policy?: DelegationPolicy;
  expiresAt?: Date | null;
}

export interface UpdateDelegationInput {
  name?: string;
  permissionLevel?: DelegationPermissionLevel;
  spendLimitStroops?: bigint;
  status?: DelegationStatus;
  policy?: DelegationPolicy;
  expiresAt?: Date | null;
}

export interface Escrow {
  id: string;
  escrowId: string;
  orderId: string;
  contractId: string;
  status: EscrowStatus;
  totalStroops: bigint;
  amount?: bigint;
  buyer?: string;
  buyerId?: string;
  seller?: string;
  arbiter?: string;
  timeoutLedger?: number;
  currentLedger?: number;
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EscrowStatus = "pending" | "active" | "released" | "disputed" | "cancelled" | "funded" | "Funded" | "Released";

export interface CancellationGrace {
  orderId: string;
  graceEndTime: Date;
  graceExpiresAt?: Date;
  isActive: boolean;
  requestedAt?: Date;
}

export interface ErasureRequest {
  userId: string;
  requestedAt: Date;
  reason?: string;
}

export interface DualControlState {
  required: boolean;
  approvals: ApprovalSignature[];
  threshold: number;
}

export interface ApprovalSignature {
  userId: string;
  signedAt: Date;
  signature: string;
}

// Re-export OrderStatus and RejectionReasonCode for convenience
export type { OrderStatus, RejectionReasonCode } from "@delegolabs/api-generated";

// Schema validation types (referenced in tests)
export interface DelegationSchema {
  parse(input: unknown): Delegation;
}

export interface OrderSchema {
  parse(input: unknown): Order;
}

export interface EscrowSchema {
  parse(input: unknown): Escrow;
}

// Additional missing types
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  language?: string;
  timezone?: string;
  notifications?: boolean;
}

export interface Dispute {
  id: string;
  escrowId: string;
  status: DisputeStatus;
  reason: DisputeReason;
  createdAt: Date;
  updatedAt: Date;
}

export type DisputeStatus = "pending" | "investigating" | "resolved" | "dismissed";

export type DisputeReason = "item_not_received" | "item_not_as_described" | "unauthorized_transaction" | "other";

export interface CreateDisputeInput {
  escrowId: string;
  reason: DisputeReason;
  description?: string;
}

// Constants that are used in components
export const ESCROW_STATUS_META = {
  pending: { label: "Pending", color: "amber" },
  active: { label: "Active", color: "blue" },
  released: { label: "Released", color: "green" },
  disputed: { label: "Disputed", color: "red" },
  cancelled: { label: "Cancelled", color: "gray" },
  funded: { label: "Funded", color: "blue" },
  Funded: { label: "Funded", color: "blue" },
  Released: { label: "Released", color: "green" },
} as const;