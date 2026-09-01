export type IssueType = "wrong_number" | "wrong_link" | "bad_decision" | "other";

export type Correction = {
  id: string;
  issueType: IssueType;
  targetLabel: string | null;
  comment: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
};

// A structured entry logged automatically whenever someone edits a value
// inline (as opposed to a free-text Correction, which is a manual report).
export type DataEdit = {
  id: string;
  targetLabel: string;
  oldValue: string;
  newValue: string;
  editedBy: string | null;
  createdAt: string;
};
