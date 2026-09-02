/** Domain types shared across the bidding UI. */

export type Role = 'admin' | 'student';

export type BidStatus = 'active' | 'won' | 'lost' | 'cancelled';

export type WindowState = 'pending' | 'open' | 'closed';

export interface Identity {
  id: string;
  name: string;
  email: string;
  role: Role;
  isRoot: boolean;
  pointBalance: number;
}

export interface ClassSeat {
  id: string;
  name: string;
  code: string;
  faculty: string;
  term: string;
  seatCap: number;
  seatsTaken: number | null;
  bidCount: number;
  /** Set only for the signed-in student's own bid — never another student's. */
  myBidId: string | null;
  myBidAmount: number | null;
  myBidStatus: BidStatus | null;
}

export interface Bid {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  amount: number;
  status: BidStatus;
  updatedAt: string;
}

export interface ResultRow {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  amount: number;
  outcome: Exclude<BidStatus, 'active'>;
  clearingPrice: number;
}

export interface ClassResultRow {
  id: string;
  studentName: string;
  studentEmail: string;
  amount: number;
  /** `active` only appears before the round has been resolved. */
  outcome: Exclude<BidStatus, 'cancelled'>;
  rank: number;
}

export interface StudentAccount {
  id: string;
  name: string;
  email: string;
  pointBalance: number;
  activeBids: number;
  tokenState: 'pending' | 'used' | 'expired';
  emailDelivered: boolean;
  createdAt: string;
}

export interface AdminAccount {
  id: string;
  username: string;
  email: string;
  isRoot: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BiddingWindow {
  /** Display strings — the templates render these directly. */
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
  state: WindowState;
  /** Raw ISO instants, for form fields and countdowns. */
  opensAtIso: string | null;
  closesAtIso: string | null;
  resolvedAtIso: string | null;
}

export interface SettingEntry {
  id: string;
  service: string;
  label: string;
  envKey: string;
  maskedValue: string | null;
  configured: boolean;
  description: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  seatCap: number;
  resolvedAt: string | null;
}
