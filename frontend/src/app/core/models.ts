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
  outcome: Exclude<BidStatus, 'active'>;
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
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
  state: WindowState;
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
