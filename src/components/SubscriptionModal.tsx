import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Subscription, type Account, EXPENSE_CATEGORIES } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MonitorPlay, Music, Wifi, Dumbbell, CreditCard, Shield, Zap, Sparkles } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingSubscription?: Subscription;
  accounts: Account[];
}

const COLORS = ["#e50914", "#1db954", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
const ICONS = [
  { name: "MonitorPlay", icon: MonitorPlay },
  { name: "Music", icon: Music },
  { name: "Wifi", icon: Wifi },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "CreditCard", icon: CreditCard },
  { name: "Shield", icon: Shield },
  { name: "Zap", icon: Zap },
  { name: "Sparkles", icon: Sparkles },
];

export const SubscriptionModal: React.FC<Props> = ({ isOpen, onClose, existingSubscription, accounts }) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("อื่นๆ");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [iconName, setIconName] = useState("MonitorPlay");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingSubscription) {
      setName(existingSubscription.name);
      setAmount(existingSubscription.amount.toString());
      setAccountId(existingSubscription.accountId);
      setCategory(existingSubscription.category);
      setCycle(existingSubscription.cycle);
      setNextBillingDate(existingSubscription.nextBillingDate);
      setColor(existingSubscription.color);
      setIconName(existingSubscription.icon || "MonitorPlay");
      setIsActive(existingSubscription.isActive !== false);
    } else {
      setName("");
      setAmount("");
      setAccountId(accounts.length > 0 ? accounts[0].id : "");
      setCategory("อื่นๆ");
      setCycle("monthly");
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNextBillingDate(tomorrow.toISOString().split("T")[0]);
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setIconName("MonitorPlay");
      setIsActive(true);
    }
  }, [existingSubscription, isOpen, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!accountId) {
      toast.error("กรุณาเลือกบัญชีสำหรับหักเงิน");
      return;
    }

    setLoading(true);
    try {
      const data = {
        userId: user.uid,
        name,
        amount: parseFloat(amount),
        accountId,
        category,
        cycle,
        nextBillingDate,
        color,
        icon: iconName,
        isActive,
      };

      if (existingSubscription) {
        await updateDoc(doc(db, "subscriptions", existingSubscription.id), data);
        toast.success("อัปเดตรายจ่ายประจำสำเร็จ");
      } else {
        await addDoc(collection(db, "subscriptions"), {
          ...data,
          createdAt: Date.now(),
        });
        toast.success("เพิ่มรายจ่ายประจำสำเร็จ");
      }
      onClose();
    } catch (error) {
      console.error("Error saving subscription: ", error);
      toast.error("ไม่สามารถบันทึกได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingSubscription ? "แก้ไขรายจ่ายประจำ" : "เพิ่มรายจ่ายประจำ"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>ชื่อบริการ (เช่น Netflix, ค่าเน็ตบ้าน)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Netflix"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>จำนวนเงิน</Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>รอบบิล</Label>
              <Select value={cycle} onValueChange={(val: any) => setCycle(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกรอบบิล" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">รายเดือน</SelectItem>
                  <SelectItem value="yearly">รายปี</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ตัดเงินจากบัญชี</Label>
              <Select value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบัญชี" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>วันที่ตัดบิลรอบถัดไป</Label>
            <Input
              type="date"
              value={nextBillingDate}
              onChange={(e) => setNextBillingDate(e.target.value)}
              required
            />
          </div>
          
          {existingSubscription && (
            <div className="flex items-center gap-2 pt-2 pb-2">
              <Label className="flex-1 cursor-pointer" htmlFor="isActive">สถานะเปิดใช้งาน (หักอัตโนมัติ)</Label>
              <input 
                id="isActive" 
                type="checkbox" 
                checked={isActive} 
                onChange={(e) => setIsActive(e.target.checked)} 
                className="w-5 h-5 rounded accent-primary" 
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>ไอคอน</Label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((IconObj) => {
                const Icon = IconObj.icon;
                return (
                  <button
                    key={IconObj.name}
                    type="button"
                    onClick={() => setIconName(IconObj.name)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      iconName === IconObj.name ? "ring-2 ring-primary ring-offset-2 bg-primary/10" : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <Icon className="w-5 h-5 text-foreground" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>สี</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? "scale-110 ring-2 ring-primary ring-offset-2" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={loading || !name || !amount || !nextBillingDate}>
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
