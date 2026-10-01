function getCurrentCycleMonthYear(date, paydayDate) {
  const monthOffset = paydayDate > 15 ? -1 : 0;
  const checkMonth = (y, m) => {
    const start = new Date(y, m + monthOffset, paydayDate);
    const end = new Date(y, m + monthOffset + 1, paydayDate - 1);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  const y = date.getFullYear();
  const m = date.getMonth();

  if (checkMonth(y, m)) return { month: m, year: y };
  
  const prevDate = new Date(y, m - 1, 1);
  if (checkMonth(prevDate.getFullYear(), prevDate.getMonth())) {
    return { month: prevDate.getMonth(), year: prevDate.getFullYear() };
  }

  const nextDate = new Date(y, m + 1, 1);
  if (checkMonth(nextDate.getFullYear(), nextDate.getMonth())) {
    return { month: nextDate.getMonth(), year: nextDate.getFullYear() };
  }

  return { month: m, year: y }; 
}

const today = new Date("2026-10-01T08:17:20+07:00");
console.log("Payday 7:", getCurrentCycleMonthYear(today, 7)); // Should be September (8)
console.log("Payday 25:", getCurrentCycleMonthYear(today, 25)); // Should be October (9)
console.log("Payday 1:", getCurrentCycleMonthYear(today, 1)); // Should be October (9)
