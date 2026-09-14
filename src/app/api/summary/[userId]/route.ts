import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const url = new URL(request.url);
    const apiKey = url.searchParams.get('apiKey');
    
    if (process.env.API_SECRET_KEY && apiKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { userId } = await params;
    const adminDb = getAdminDb();

    // Fetch accounts
    const accountsSnap = await adminDb.collection('accounts').where('userId', '==', userId).get();
    const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch settings
    const settingsSnap = await adminDb.collection('settings').doc(userId).get();
    const settings = settingsSnap.exists ? settingsSnap.data() : { monthlyBudget: 0 };

    // Fetch transactions
    const txsSnap = await adminDb.collection('transactions').where('userId', '==', userId).get();
    const transactions = txsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate totals for overall balance
    const totalInitial = accounts.reduce((sum: number, acc: any) => sum + (acc.initialBalance || 0), 0);
    const allTimeIncome = transactions.filter((t: any) => t.type === 'income').reduce((sum, t: any) => sum + t.amount, 0);
    const allTimeExpense = transactions.filter((t: any) => t.type === 'expense').reduce((sum, t: any) => sum + t.amount, 0);
    const overallBalance = totalInitial + allTimeIncome - allTimeExpense;

    // Cycle and budget calculations (matching web)
    const paydayDate = settings?.paydayDate || 1;
    const now = new Date();
    const selectedYear = now.getFullYear();
    const selectedMonth = now.getMonth();
    const monthOffset = paydayDate > 15 ? -1 : 0;
    
    const cycleStartDate = new Date(selectedYear, selectedMonth + monthOffset, paydayDate);
    const cycleEndDate = new Date(selectedYear, selectedMonth + monthOffset + 1, paydayDate - 1);
    cycleEndDate.setHours(23, 59, 59, 999);
    
    const currentCycleTxs = transactions.filter((t: any) => {
      const d = new Date(t.date);
      return d >= cycleStartDate && d <= cycleEndDate;
    });

    const totalIncome = currentCycleTxs.filter((t: any) => t.type === 'income').reduce((sum, t: any) => sum + t.amount, 0);
    const totalExpense = currentCycleTxs.filter((t: any) => t.type === 'expense').reduce((sum, t: any) => sum + t.amount, 0);

    const budget = settings?.monthlyBudget || 0;
    const daysInMonth = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const isCurrentMonth = now >= cycleStartDate && now <= cycleEndDate;
    
    const spentToday = isCurrentMonth 
      ? currentCycleTxs
          .filter((t: any) => {
            if (t.type !== 'expense') return false;
            const d = new Date(t.date);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
          })
          .reduce((acc, t: any) => acc + t.amount, 0)
      : 0;

    let daysLeftIncludingToday = daysInMonth;
    if (isCurrentMonth) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      daysLeftIncludingToday = Math.round((cycleEndDate.getTime() - todayStart.getTime()) / 86400000);
    }

    const expenseBeforeToday = isCurrentMonth ? totalExpense - spentToday : totalExpense;
    
    const averageBudgetPerDay = isCurrentMonth 
      ? Math.max(0, (budget - expenseBeforeToday) / daysLeftIncludingToday)
      : budget / daysInMonth;

    const remainingDailyBudget = averageBudgetPerDay - spentToday;
    const remainingMonthlyBudget = budget - totalExpense;

    return NextResponse.json({
      success: true,
      data: {
        userId,
        overallBalance,
        budget,
        totalIncome,
        totalExpense,
        spentToday,
        averageBudgetPerDay,
        remainingDailyBudget,
        remainingMonthlyBudget,
        cycleStartDate: cycleStartDate.toISOString(),
        cycleEndDate: cycleEndDate.toISOString(),
        accountsCount: accounts.length,
        transactionsCount: transactions.length,
        recentTransactions: transactions
          .sort((a: any, b: any) => b.createdAt - a.createdAt)
          .slice(0, 5)
      }
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch data" }, { status: 500 });
  }
}
