import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

export type AuditAction =
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.register'
  | 'user.password_changed'
  | 'user.deleted'
  | 'admin.user_created'
  | 'admin.user_updated'
  | 'admin.user_deleted'
  | 'admin.user_features_updated'
  | 'admin.user_admin_toggled'
  | 'admin.invite_created'
  | 'admin.invite_deleted'
  | 'admin.settings_updated';

export type AuditTargetType =
  | 'user'
  | 'invite_code'
  | 'settings'
  | 'session';

interface AuditLogParams {
  userId?: string | null;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details,
      ipAddress: params.ipAddress,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    console.error('Failed to create audit log:', error);
  }
}
