// Rep assignment history: purely a display-layer record of which rep (if
// any) was responsible for an area during which months. Never feeds into
// engine.ts's math — an area's trend/systemic/root-cause analysis always
// treats it as one continuous unit, regardless of rep handoffs or vacant
// stretches recorded here.
export type RepAssignment = {
  id: string;
  area: string;
  rep: string | null;
  startMonth: number;
  endMonth: number;
};

export function repResponsibleInMonth(assignments: RepAssignment[], area: string, month: number): RepAssignment | null {
  return (
    assignments.find((a) => a.area === area && a.startMonth <= month && month <= a.endMonth) ?? null
  );
}
