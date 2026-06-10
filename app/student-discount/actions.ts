"use server";

import { isUniversityEmail, STUDENT_CODE, STUDENT_PERCENT } from "@/lib/promo";

// Reveal the (shared) student code to anyone with a university email address.
// Deliberately simple: same code for everyone, validated again at checkout.
export async function revealStudentCode(
  email: string,
): Promise<{ ok: boolean; code?: string; percent?: number; message: string }> {
  if (!isUniversityEmail(email)) {
    return {
      ok: false,
      message:
        "That doesn't look like a university email. Use your .ac.uk or .edu address — or email us proof of enrolment instead.",
    };
  }
  return { ok: true, code: STUDENT_CODE, percent: STUDENT_PERCENT, message: "You're in." };
}
