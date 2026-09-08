export type TransactionType = "income" | "expense" | "transfer";

export interface Account {
  id: string;
  userId: string;
  name: string;
  initialBalance: number;
  color: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId?: string;
  toAccountId?: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string format
  note?: string;
  createdAt: number;
}

export const EXPENSE_CATEGORIES = [
  "อาหาร",
  "เดินทาง",
  "สาธารณูปโภค",
  "บันเทิง",
  "ช้อปปิ้ง",
  "สุขภาพ",
  "อื่นๆ",
];

export const INCOME_CATEGORIES = [
  "เงินเดือน",
  "ธุรกิจ",
  "การลงทุน",
  "ของขวัญ",
  "อื่นๆ",
];

export interface UserSettings {
  id: string;
  monthlyBudget: number;
}
