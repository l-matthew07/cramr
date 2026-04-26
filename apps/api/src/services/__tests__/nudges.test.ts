import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateNudgesForUser } from "../nudges";
import { prisma } from "@cramr/db";
import { sendEmail } from "../../lib/email";

vi.mock("@cramr/db", () => ({
  prisma: {
    streak: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    nudge: {
      create: vi.fn(),
    },
    groupMembership: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../../lib/email", () => ({
  sendEmail: vi.fn(),
}));

// Mock timer so "today" is predictable.
const MOCK_TODAY = new Date("2023-10-15T12:00:00Z");

describe("evaluateNudgesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
    
    // Default mocks
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      displayName: "Test",
    } as any);
    vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends streak at risk email if streak >= 3 and last active yesterday", async () => {
    vi.mocked(prisma.streak.findUnique).mockResolvedValue({
      currentLength: 4,
      lastActiveDate: new Date("2023-10-14T10:00:00Z"), // Yesterday
    } as any);

    await evaluateNudgesForUser("u1", "UTC");

    // Expect streak nudge created
    expect(prisma.nudge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          kind: "streak_at_risk",
        }),
      })
    );

    // Expect email sent
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Don't break your 4-day streak 🔥",
        to: "test@example.com",
      })
    );
  });

  it("does not send streak at risk if active today", async () => {
    vi.mocked(prisma.streak.findUnique).mockResolvedValue({
      currentLength: 4,
      lastActiveDate: new Date("2023-10-15T10:00:00Z"), // Today
    } as any);

    await evaluateNudgesForUser("u1", "UTC");
    expect(prisma.nudge.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "streak_at_risk" }) })
    );
  });

  it("sends inactive nudge if inactive for 2+ days", async () => {
    vi.mocked(prisma.streak.findUnique).mockResolvedValue({
      currentLength: 0,
      lastActiveDate: new Date("2023-10-13T10:00:00Z"), // 2 days ago
    } as any);

    await evaluateNudgesForUser("u1", "UTC");

    expect(prisma.nudge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          kind: "inactive_2d",
        }),
      })
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Haven't seen you in a while 👋",
      })
    );
  });

  it("handles missing streak record for inactive nudge", async () => {
    // Null logic triggers inactive because user has no activity
    vi.mocked(prisma.streak.findUnique).mockResolvedValue(null);

    await evaluateNudgesForUser("u1", "UTC");
    
    expect(prisma.nudge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "inactive_2d" })
      })
    );
  });
});
