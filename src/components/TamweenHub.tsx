import React, { useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import TamweenCustomers from "./TamweenCustomers";
import TamweenReplacements from "./TamweenReplacements";

const tabs = [
  { id: "customers", label: "عملاء التموين", icon: CreditCard },
  { id: "replacements", label: "الاستعاضات", icon: RefreshCw },
];

export default function TamweenHub() {
  const [activeTab, setActiveTab] = useState("customers");

  const renderContent = () => {
    switch (activeTab) {
      case "customers":
        return <TamweenCustomers />;
      case "replacements":
        return <TamweenReplacements />;
      default:
        return <TamweenCustomers />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden" style={{ direction: "rtl" }}>
      {/* Tabs Header */}
      <div className="bg-[#b8bcb2] border-b border-[#888888] shrink-0 no-print">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "bg-[#222222] text-[#c3c6bb] border-[#000000]"
                    : "bg-transparent text-[#555555] border-transparent hover:bg-[#c3c6bb]"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

