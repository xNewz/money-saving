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
