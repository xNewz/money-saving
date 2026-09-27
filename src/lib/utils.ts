import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { th } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatThaiDate(date: Date | string | number, formatStr: string = "d MMM yyyy"): string {
  const d = new Date(date);
  let result = format(d, formatStr, { locale: th });
  
  if (formatStr.includes("yyyy")) {
    const year = d.getFullYear();
    const thaiYear = year + 543;
    result = result.replace(year.toString(), thaiYear.toString());
  }
  
  return result;
}
