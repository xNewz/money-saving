import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import QuickChart from 'quickchart-js';
import { isLendingTransaction } from '@/types';

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
    
    // Parse query params for month/year if provided
    const now = new Date();
    const month = parseInt(url.searchParams.get('month') || now.getMonth().toString());
    const year = parseInt(url.searchParams.get('year') || now.getFullYear().toString());

    // Fetch transactions
    const txsSnap = await adminDb.collection('transactions').where('userId', '==', userId).get();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    const incomeData = new Array(daysInMonth).fill(0);
    const expenseData = new Array(daysInMonth).fill(0);

    txsSnap.docs.forEach(doc => {
      const tx = doc.data();
      if (tx.type === 'transfer' || isLendingTransaction(tx as any)) return;
      
      const d = new Date(tx.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const dayIdx = d.getDate() - 1;
        if (tx.type === 'income') {
          incomeData[dayIdx] += tx.amount;
        } else {
          expenseData[dayIdx] += tx.amount;
        }
      }
    });

    const chart = new QuickChart();
    chart.setWidth(600)
    chart.setHeight(300)
    chart.setBackgroundColor('#ffffff');
    chart.setConfig({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'รายรับ (Income)',
            data: incomeData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'รายจ่าย (Expense)',
            data: expenseData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        title: {
          display: true,
          text: `รายงานการเงิน เดือน ${month + 1}/${year}`
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    });

    const imageUrl = chart.getUrl();
    
    // Fetch the image from QuickChart and return it directly as an image buffer
    // This prevents redirects which break LINE flex messages
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    
  } catch (error: any) {
    console.error("Chart API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
