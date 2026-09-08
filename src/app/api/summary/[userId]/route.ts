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

    // Calculate totals
    const totalInitial = accounts.reduce((sum: number, acc: any) => sum + (acc.initialBalance || 0), 0);
    const allTimeIncome = transactions.filter((t: any) => t.type === 'income').reduce((sum, t: any) => sum + t.amount, 0);
    const allTimeExpense = transactions.filter((t: any) => t.type === 'expense').reduce((sum, t: any) => sum + t.amount, 0);
    
    const overallBalance = totalInitial + allTimeIncome - allTimeExpense;

    const budget = settings?.monthlyBudget || 0;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyBudgetLimit = budget > 0 ? Math.round(budget / daysInMonth) : 0;

    return NextResponse.json({
      success: true,
      data: {
        userId,
        overallBalance,
        budget,
        dailyBudgetLimit,
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
