import React from "react";
import TamweenReplacements from "./TamweenReplacements";

export default function TamweenHub({ onWithdrawNow, currentUser }: { onWithdrawNow?: (customer: any) => void; currentUser?: any }) {
  // المنظومة = صفحة الاستعاضات مباشرة (بدون تبويبات)
  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden" style={{ direction: "rtl" }}>
      <div className="flex-1 min-h-0 overflow-y-auto lux-scroll">
        <TamweenReplacements currentUser={currentUser} onWithdrawNow={onWithdrawNow} />
      </div>
    </div>
  );
}
