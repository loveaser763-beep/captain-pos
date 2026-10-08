// تاريخ اليوم/الشهر بالتوقيت المحلي للجهاز (مش UTC)
// السبب: toISOString() بيرجع تاريخ UTC → بعد منتصف الليل بيتكتب تاريخ امبارح في الفواتير والتقارير
export const localDateStr = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const localMonthStr = (d: Date = new Date()): string => localDateStr(d).slice(0, 7);
