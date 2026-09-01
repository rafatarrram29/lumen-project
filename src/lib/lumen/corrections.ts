// A structured entry logged automatically whenever someone edits a value
// inline — who changed it, when, and from what value to what value.
export type DataEdit = {
  id: string;
  targetLabel: string;
  oldValue: string;
  newValue: string;
  editedBy: string | null;
  createdAt: string;
  isUndo: boolean;
};
