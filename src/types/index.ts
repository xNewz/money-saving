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
  isForgiven?: boolean;
  forgivenAt?: number;
  repayDueDate?: string | null; // YYYY-MM-DD, วันนัดคืน (เฉพาะรายการ "ให้ยืม")
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  accountId: string;
  category: string;
  cycle: "monthly" | "yearly";
  nextBillingDate: string; // YYYY-MM-DD
  isActive: boolean;
  color: string;
  icon?: string;
  createdAt: number;
}

export const EXPENSE_CATEGORY_GROUPS = {
  "รายจ่ายคงที่": ["สาธารณูปโภค", "ค่าเช่า/ผ่อนบ้าน", "ค่าเน็ต/โทรศัพท์"],
  "รายจ่ายผันแปร": ["อาหาร", "เดินทาง", "บันเทิง", "ช้อปปิ้ง", "สุขภาพ", "ทำบุญ", "ให้ยืม", "อื่นๆ"],
  "เงินออม/เงินลงทุน": ["เงินออม", "การลงทุน"],
  "เงินผ่อนหนี้": ["บัตรเครดิต", "สินเชื่อ/ผ่อนชำระ"]
};

export const EXPENSE_CATEGORIES = Object.values(EXPENSE_CATEGORY_GROUPS).flat();

export const INCOME_CATEGORIES = [
  "เงินเดือน",
  "โบนัส",
  "ฟรีแลนซ์/งานเสริม",
  "ธุรกิจ",
  "การลงทุน",
  "เงินปันผล/ดอกเบี้ย",
  "ค่าเช่า",
  "ของขวัญ",
  "รางวัล/เสี่ยงโชค",
  "ได้รับคืน",
  "อื่นๆ",
];

export interface UserSettings {
  id: string;
  monthlyBudget: number;
  paydayDate?: number; // 1-31
  lendReminderDays?: number; // เตือนทวงเมื่อค้างเกินกี่วัน (กรณีไม่ได้ตั้งวันนัดคืน)
}

import { bankLists } from "thai-banks-logo";

export const EXTENDED_BANK_LISTS: Record<string, any> = {
  ...bankLists,
  CUSTOM_WALLET_1: {
    name: "เป๋าตัง",
    fullname: "กระเป๋าเงินอิเล็กทรอนิกส์",
    nameEN: "E-Wallet",
    symbol: "CUSTOM_WALLET_1",
    icon: "https://play-lh.googleusercontent.com/P55R06USyrtExssiU1Arb88uToqB8LUYMCl-7XqohLp2norQTRdDdppliIE3n5iwQmM20J6iOWGQGzxMdTuG",
    color: "#4f46e5"
  }
};

export const isLendingExpense = (tx: { type: string; category?: string; isForgiven?: boolean }) => 
  tx.type === "expense" && tx.category === "ให้ยืม" && !tx.isForgiven;

export const isForgivenLending = (tx: { type: string; category?: string; isForgiven?: boolean }) => 
  tx.type === "expense" && tx.category === "ให้ยืม" && !!tx.isForgiven;

export const isRawLendingExpense = (tx: { type: string; category?: string }) => 
  tx.type === "expense" && tx.category === "ให้ยืม";

export const isLendingIncome = (tx: { type: string; category?: string }) => 
  tx.type === "income" && tx.category === "ได้รับคืน";

export const isLendingTransaction = (tx: { type: string; category?: string; isForgiven?: boolean }) =>
  isLendingExpense(tx) || isLendingIncome(tx);

export const isRawLendingTransaction = (tx: { type: string; category?: string }) =>
  isRawLendingExpense(tx) || isLendingIncome(tx);
