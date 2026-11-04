import type { AccountSummary } from "./fees.ts";
import { GRADES, STAGES, stageOf, type Year } from "./school.ts";

export type OverviewStudent = {
  studentId: string;
  gender: string;
  bFormNumber: string | null;
  leftOn: string | null;
  enrollments: { academicYearId: string; grade: string }[];
};

export function overview<S extends OverviewStudent>(students: S[], year: Year, accounts: AccountSummary[]) {
  const active = students.filter((s) => !s.leftOn);
  const gradeOf = (s: S) => s.enrollments.find((e) => e.academicYearId === year.academicYearId)?.grade;
  const accountOf = new Map(accounts.filter((a) => a.academicYearId === year.academicYearId).map((a) => [a.studentId, a]));
  const inClass = active.filter(gradeOf);
  const charged = active.flatMap((s) => {
    const account = accountOf.get(s.studentId);
    return account && account.charged.amount > 0 ? [account] : [];
  });
  const classes = GRADES.flatMap(([grade]) => {
    const classId = year.classes.find((c) => c.grade === grade)?.classId;
    return classId ? [{ grade, classId, stage: stageOf(grade)!, students: inClass.filter((s) => gradeOf(s) === grade).length }] : [];
  });
  return {
    active,
    inClass: inClass.length,
    noClass: active.length - inClass.length,
    missingBForm: active.filter((s) => !s.bFormNumber).length,
    girls: active.filter((s) => s.gender === "female").length,
    boys: active.filter((s) => s.gender === "male").length,
    classes,
    stages: STAGES.map(([stage]) => ({ stage, students: classes.filter((c) => c.stage === stage).reduce((sum, c) => sum + c.students, 0) })),
    billed: charged.length,
    paidUp: charged.filter((a) => a.balance.amount <= 0).length,
    late: active
      .flatMap((student) => {
        const amount = accountOf.get(student.studentId)?.overdue?.amount ?? 0;
        return amount > 0 ? [{ student, amount, grade: gradeOf(student) }] : [];
      })
      .sort((a, b) => b.amount - a.amount),
  };
}

export function feeParts({ charged, remaining, overdue }: { charged: number; remaining: number; overdue: number }) {
  return { settled: charged - remaining, notDue: remaining - overdue, late: overdue };
}

export function feesByStage(byGrade: { grade: string; charged: number; collected: number; overdue: number }[]) {
  return STAGES.map(([stage]) => {
    const rows = byGrade.filter((g) => stageOf(g.grade) === stage);
    const sum = (key: "charged" | "collected" | "overdue") => rows.reduce((total, g) => total + g[key], 0);
    return { stage, charged: sum("charged"), collected: sum("collected"), overdue: sum("overdue") };
  }).filter((s) => s.charged > 0);
}

export function roundUp(value: number) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((m) => m * step).find((n) => n >= value)!;
}

export function wavyRing(share: number, { center = 50, radius = 40, amplitude = 1.3, waves = 18 } = {}) {
  const end = Math.min(Math.max(share, 0), 1) * 2 * Math.PI;
  const steps = Math.max(Math.round(end * 40), 1);
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * end;
    const r = radius + amplitude * Math.sin(angle * waves);
    return `${(center + r * Math.sin(angle)).toFixed(2)} ${(center - r * Math.cos(angle)).toFixed(2)}`;
  });
  return `M${points.join("L")}`;
}

export function smoothLine(points: [number, number][]) {
  return points.reduce((path, [x, y], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py] = points[i - 1];
    const mid = (px + x) / 2;
    return `${path}C${mid} ${py} ${mid} ${y} ${x} ${y}`;
  }, "");
}
