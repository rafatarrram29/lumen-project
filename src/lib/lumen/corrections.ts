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
