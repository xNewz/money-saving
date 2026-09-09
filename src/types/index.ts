export type TransactionType = "income" | "expense" | "transfer";

export interface Account {
  id: string;
  userId: string;
  name: string;
  bankSymbol?: string;
  initialBalance: number;
  color: string;
  createdAt: number;
}

export interface Debt {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate?: number;
  dueDate?: number; // 1-31 for day of month
  color: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // YYYY-MM-DD
  color: string;
  icon?: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId?: string;
  toAccountId?: string;
  debtId?: string;
  goalId?: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string format
  note?: string;
  createdAt: number;
}

export const EXPENSE_CATEGORY_GROUPS = {
  "รายจ่ายคงที่": ["สาธารณูปโภค", "ค่าเช่า/ผ่อนบ้าน", "ค่าเน็ต/โทรศัพท์"],
  "รายจ่ายผันแปร": ["อาหาร", "เดินทาง", "บันเทิง", "ช้อปปิ้ง", "สุขภาพ", "อื่นๆ"],
  "เงินออม/เงินลงทุน": ["เงินออม", "การลงทุน"],
  "เงินผ่อนหนี้": ["บัตรเครดิต", "สินเชื่อ/ผ่อนชำระ"]
};

export const EXPENSE_CATEGORIES = Object.values(EXPENSE_CATEGORY_GROUPS).flat();

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

import { bankLists } from "thai-banks-logo";

export const EXTENDED_BANK_LISTS: Record<string, any> = {
  ...bankLists,
  CUSTOM_WALLET_1: {
    name: "เป๋าตัง",
    fullname: "กระเป๋าเงินอิเล็กทรอนิกส์",
    nameEN: "E-Wallet",
    symbol: "CUSTOM_WALLET_1",
    icon: "https://play-lh.googleusercontent.com/P55R06USyrtExssiU1Arb88uToqB8LUYMCl-7XqohLp2norQTRdDdppliIE3n5iwQmM20J6iOWGQGzxMdTuG=w240-h480",
    color: "#4f46e5"
  }
};
