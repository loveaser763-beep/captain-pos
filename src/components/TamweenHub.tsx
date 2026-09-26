import React from "react";
import TamweenReplacements from "./TamweenReplacements";

export default function TamweenHub({ onWithdrawNow }: { onWithdrawNow?: (customer: any) => void }) {
  // المنظومة = صفحة الاستعاضات مباشرة (بدون تبويبات)
  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden" style={{ direction: "rtl" }}>
      <div className="flex-1 min-h-0 overflow-y-auto lux-scroll">
        <TamweenReplacements onWithdrawNow={onWithdrawNow} />
      </div>
    </div>
  );
}
