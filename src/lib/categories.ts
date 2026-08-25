export type CategoryId = "sales" | "doctors" | "call_rate" | "ims_market";

export type FieldType = "text" | "number";

export type CategoryField = {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
};

export type CategoryDef = {
  id: CategoryId;
  label: string;
  table: string;
  /** Columns that together must be unique -- re-importing updates matching
   * rows instead of duplicating them, so a new upload for one rep/month
   * never wipes out anyone else's data. */
  uniqueKey: string[];
  fields: CategoryField[];
};

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  sales: {
    id: "sales",
    label: "Sales",
    table: "sales_records",
    uniqueKey: ["rep", "area", "item", "customer", "period"],
    fields: [
      { key: "rep", label: "Rep / Salesperson", required: false, type: "text" },
      { key: "area", label: "Area / Territory", required: true, type: "text" },
      { key: "item", label: "Item / Product", required: true, type: "text" },
      { key: "customer", label: "Customer", required: true, type: "text" },
      { key: "period", label: "Month / Period", required: true, type: "text" },
      { key: "sales_value", label: "Sales Value", required: true, type: "number" },
      { key: "sales_qty", label: "Sales Qty", required: true, type: "number" },
    ],
  },
  doctors: {
    id: "doctors",
    label: "Doctors",
    table: "doctor_activity",
    uniqueKey: ["rep", "doctor_name", "area", "period", "activity_type"],
    fields: [
      { key: "rep", label: "Rep", required: false, type: "text" },
      { key: "doctor_name", label: "Doctor Name", required: true, type: "text" },
      { key: "area", label: "Area / Territory", required: true, type: "text" },
      { key: "period", label: "Month / Period", required: true, type: "text" },
      { key: "activity_type", label: "Activity Type (call, visit, expense…)", required: false, type: "text" },
      { key: "value", label: "Value (amount or count)", required: false, type: "number" },
      { key: "notes", label: "Notes", required: false, type: "text" },
    ],
  },
  call_rate: {
    id: "call_rate",
    label: "Call Rate",
    table: "call_rate",
    uniqueKey: ["rep", "area", "period"],
    fields: [
      { key: "rep", label: "Rep", required: true, type: "text" },
      { key: "area", label: "Area / Territory", required: true, type: "text" },
      { key: "period", label: "Month / Period", required: true, type: "text" },
      { key: "calls_planned", label: "Calls Planned", required: false, type: "number" },
      { key: "calls_made", label: "Calls Made", required: false, type: "number" },
      { key: "coverage_pct", label: "Coverage %", required: false, type: "number" },
    ],
  },
  ims_market: {
    id: "ims_market",
    label: "IMS Market",
    table: "ims_market",
    uniqueKey: ["area", "item", "period"],
    fields: [
      { key: "area", label: "Area / Region", required: true, type: "text" },
      { key: "item", label: "Item / Product", required: true, type: "text" },
      { key: "period", label: "Month / Period", required: true, type: "text" },
      { key: "company_sales", label: "Company Sales", required: false, type: "number" },
      { key: "market_total", label: "Total Market", required: false, type: "number" },
      { key: "market_share_pct", label: "Market Share %", required: false, type: "number" },
    ],
  },
};

export const CATEGORY_IDS: CategoryId[] = ["sales", "doctors", "call_rate", "ims_market"];

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value);
}

export function requiredFields(category: CategoryId): CategoryField[] {
  return CATEGORIES[category].fields.filter((f) => f.required);
}
