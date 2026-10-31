export type Findable = { admissionNumber: string; firstName: string; lastName: string; fatherName: string | null; guardian: { name: string; phone: string } };

const digitsOf = (text: string) => text.replace(/\D/g, "").replace(/^(0092|92|0)/, "");

export function findsStudent(student: Findable, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [student.admissionNumber, `${student.firstName} ${student.lastName}`, student.fatherName ?? "", student.guardian.name].join("\n").toLowerCase();
  if (text.includes(q)) return true;
  const digits = digitsOf(q);
  return /^[\d\s+\-()]+$/.test(q) && digits.length >= 3 && (digitsOf(student.guardian.phone).includes(digits) || student.admissionNumber.replace(/\D/g, "").includes(digits));
}
