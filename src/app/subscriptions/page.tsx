"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy, updateDoc } from "firebase/firestore";
import type { Subscription, Account } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, ArrowLeft, MoreVertical, Edit2, Trash2, Calendar, CreditCard, MonitorPlay, Music, Wifi, Dumbbell, Shield, Zap, Sparkles } from "lucide-react";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { ModeToggle } from "@/components/ModeToggle";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONS = {
  MonitorPlay,
  Music,
  Wifi,
  Dumbbell,
  CreditCard,
  Shield,
  Zap,
  Sparkles,
} as Record<string, any>;

export default function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subToEdit, setSubToEdit] = useState<Subscription | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    const qSubs = query(collection(db, "subscriptions"), where("userId", "==", user.uid));
    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      const subs: Subscription[] = [];
      snapshot.forEach((doc) => subs.push({ id: doc.id, ...doc.data() } as Subscription));
      setSubscriptions(subs.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime()));
    });

    const qAccs = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("createdAt", "asc"));
    const unsubAccs = onSnapshot(qAccs, (snapshot) => {
      const accs: Account[] = [];
      snapshot.forEach((doc) => accs.push({ id: doc.id, ...doc.data() } as Account));
      setAccounts(accs);
      setLoadingData(false);
    });

    return () => {
      unsubSubs();
      unsubAccs();
    };
  }, [user]);

  const handleDelete = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
      try {
        await deleteDoc(doc(db, "subscriptions", id));
        toast.success("ลบรายการสำเร็จ");
      } catch (error) {
        toast.error("ไม่สามารถลบรายการได้");
      }
    }
  };

  const handleToggleActive = async (sub: Subscription) => {
    try {
      await updateDoc(doc(db, "subscriptions", sub.id), {
        isActive: !sub.isActive
      });
      toast.success(sub.isActive ? "ปิดใช้งานสำเร็จ" : "เปิดใช้งานสำเร็จ");
    } catch (error) {
      toast.error("ไม่สามารถเปลี่ยนสถานะได้");
    }
  };

  const openEdit = (sub: Subscription) => {
    setSubToEdit(sub);
    setIsModalOpen(true);
  };

  const monthlyTotal = subscriptions
    .filter(s => s.isActive)
    .reduce((acc, s) => acc + (s.cycle === 'monthly' ? s.amount : s.amount / 12), 0);

  const yearlyTotal = subscriptions
    .filter(s => s.isActive)
    .reduce((acc, s) => acc + (s.cycle === 'yearly' ? s.amount : s.amount * 12), 0);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8 font-sans pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-40 py-4 -mx-4 px-4 md:mx-0 md:px-0 md:relative md:bg-transparent md:backdrop-blur-none border-b md:border-none">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">รายจ่ายประจำ (Subscriptions)</h1>
          </div>
          <div className="flex gap-2 items-center">
            <ModeToggle />
            <Button onClick={() => { setSubToEdit(undefined); setIsModalOpen(true); }} className="rounded-full shadow-md gap-2">
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มรายการ</span>
            </Button>
          </div>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-2xl shadow-sm border-muted/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">ยอดรายจ่ายเฉลี่ยต่อเดือน</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? <Skeleton className="h-8 w-1/2" /> : (
                <div className="text-3xl font-bold">฿{monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              )}
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl shadow-sm border-muted/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-500">ยอดรายจ่ายรวมต่อปี</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData ? <Skeleton className="h-8 w-1/2" /> : (
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">฿{yearlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions List */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">รายการทั้งหมด</h2>
          
          {loadingData ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map(sub => {
                const Icon = sub.icon && ICONS[sub.icon] ? ICONS[sub.icon] : CreditCard;
                const acc = accounts.find(a => a.id === sub.accountId);
                
                // Calculate days left
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const nextDate = new Date(sub.nextBillingDate);
                const diffTime = nextDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return (
                  <Card key={sub.id} className={`rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-md ${!sub.isActive ? 'opacity-60 grayscale-[50%]' : ''}`}>
                    <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: sub.color }} />
                    <CardContent className="p-5 pl-6 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 overflow-hidden">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: `${sub.color}20` }}>
                          <Icon className="w-6 h-6" style={{ color: sub.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">{sub.name}</h3>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 truncate">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sub.cycle === 'monthly' ? 'รายเดือน' : 'รายปี'} • บัญชี: {acc?.name || 'ไม่ระบุ'}</span>
                          </div>
                          {sub.isActive ? (
                            <div className={`text-xs font-medium mt-1 ${diffDays <= 3 ? 'text-destructive' : 'text-emerald-500'}`}>
                              {diffDays === 0 ? 'ตัดบิลวันนี้' : diffDays < 0 ? 'เลยกำหนด (รอหักอัตโนมัติ)' : `ตัดบิลในอีก ${diffDays} วัน`}
                            </div>
                          ) : (
                            <div className="text-xs font-medium mt-1 text-muted-foreground">ไม่ได้เปิดใช้งาน</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="font-bold text-lg">
                          ฿{sub.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => openEdit(sub)} className="cursor-pointer rounded-lg">
                              <Edit2 className="w-4 h-4 mr-2" /> แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(sub)} className="cursor-pointer rounded-lg">
                              <Zap className="w-4 h-4 mr-2" /> {sub.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(sub.id)} className="cursor-pointer rounded-lg text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> ลบรายการ
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none bg-transparent rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center p-8 md:p-12 text-muted-foreground text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MonitorPlay className="w-8 h-8 opacity-50" />
                </div>
                <h3 className="font-semibold text-lg mb-1 text-foreground">ยังไม่มีรายการรายจ่ายประจำ</h3>
                <p className="text-sm max-w-md mx-auto mb-4">
                  เพิ่มรายการที่คุณต้องจ่ายเป็นประจำทุกเดือนหรือทุกปี เช่น ค่าเน็ต ค่าสตรีมมิ่ง หรือค่าสมาชิกฟิตเนส เพื่อให้ระบบช่วยจดจำและหักเงินให้อัตโนมัติ
                </p>
                <Button onClick={() => { setSubToEdit(undefined); setIsModalOpen(true); }} className="rounded-full">
                  <PlusCircle className="w-4 h-4 mr-2" /> เริ่มเพิ่มรายการแรก
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

      </div>

      <SubscriptionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        existingSubscription={subToEdit}
        accounts={accounts}
      />
    </div>
  );
}
