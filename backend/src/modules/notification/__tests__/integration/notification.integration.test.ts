import { NotificationRepository } from '@/modules/notification/repositories/notification.repository.js';
import {
  resetNotificationSchema,
  getTestConnection,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("NotificationRepository (integration)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await resetNotificationSchema();
  });

  test("create/find/count/mark read lifecycle", async () => {
    const conn = await getTestConnection();
    try {
      await conn.execute(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["900", "hash", "PTS_OFFICER", 1],
      );
    } finally {
      await conn.end();
    }

    const userIds = await NotificationRepository.findUserIdsByRole(
      "PTS_OFFICER",
    );
    expect(userIds.length).toBe(1);
    const userId = userIds[0];

    const notificationId = await NotificationRepository.create(
      userId,
      "Title",
      "Message",
      "/",
    );
    const unread = await NotificationRepository.countUnread(userId);
    expect(unread).toBe(1);

    const item = await NotificationRepository.findById(notificationId);
    expect(item?.title).toBe("Title");

    const marked = await NotificationRepository.markAsRead(
      notificationId,
      userId,
    );
    expect(marked).toBe(true);

    const unreadAfter = await NotificationRepository.countUnread(userId);
    expect(unreadAfter).toBe(0);
  });

  test("upsert settings creates and updates rows", async () => {
    const conn = await getTestConnection();
    let userId: number;
    try {
      const [result] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["901", "hash", "USER", 1],
      );
      userId = Number(result.insertId);
    } finally {
      await conn.end();
    }

    await NotificationRepository.upsertSettings(userId, {
      in_app: true,
      sms: false,
      email: true,
    });
    const settings = await NotificationRepository.getSettingsByUserId(userId);
    expect(settings?.in_app).toBe(true);
    expect(settings?.sms).toBe(false);
    expect(settings?.email).toBe(true);

    await NotificationRepository.upsertSettings(userId, {
      in_app: false,
      sms: true,
      email: false,
    });
    const settingsUpdated =
      await NotificationRepository.getSettingsByUserId(userId);
    expect(settingsUpdated?.in_app).toBe(false);
    expect(settingsUpdated?.sms).toBe(true);
    expect(settingsUpdated?.email).toBe(false);
  });

  test("createBulk skips duplicate unread and allows re-create after read", async () => {
    const conn = await getTestConnection();
    let userId: number;
    try {
      const [result] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["902", "hash", "USER", 1],
      );
      userId = Number(result.insertId);
    } finally {
      await conn.end();
    }

    const payload = [
      {
        userId,
        title: "มีคำขอใหม่รออนุมัติ",
        message: "มีคำขอเลขที่ REQ-69-TEST รอการตรวจสอบจากท่าน",
        link: "/head-scope/requests/REQ-69-TEST",
        type: "GENERAL" as const,
      },
    ];

    const firstInsert = await NotificationRepository.createBulk(payload);
    expect(firstInsert).toBe(1);

    const duplicateInsert = await NotificationRepository.createBulk(payload);
    expect(duplicateInsert).toBe(0);

    const unread = await NotificationRepository.countUnread(userId);
    expect(unread).toBe(1);

    const items = await NotificationRepository.findByUserId(userId, 5);
    expect(items.length).toBeGreaterThanOrEqual(1);
    await NotificationRepository.markAsRead(items[0].id, userId);

    const insertAfterRead = await NotificationRepository.createBulk(payload);
    expect(insertAfterRead).toBe(1);
  });

  test("findUserIdsByRoleForInApp excludes users with in_app disabled", async () => {
    const conn = await getTestConnection();
    let userEnabledId: number;
    let userDisabledId: number;
    try {
      const [enabledResult] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["903", "hash", "PTS_OFFICER", 1],
      );
      userEnabledId = Number(enabledResult.insertId);
      const [disabledResult] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["904", "hash", "PTS_OFFICER", 1],
      );
      userDisabledId = Number(disabledResult.insertId);
    } finally {
      await conn.end();
    }

    await NotificationRepository.upsertSettings(userDisabledId, {
      in_app: false,
      sms: false,
      email: false,
    });

    expect(await NotificationRepository.isInAppEnabled(userEnabledId)).toBe(true);
    expect(await NotificationRepository.isInAppEnabled(userDisabledId)).toBe(false);

    const recipients = await NotificationRepository.findUserIdsByRoleForInApp("PTS_OFFICER");
    expect(recipients).toContain(userEnabledId);
    expect(recipients).not.toContain(userDisabledId);
  });
});
