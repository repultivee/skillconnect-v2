export const SUPPORT_CHAT_PREFIX = "support_";
export const SUPPORT_TITLE = "Поддержка SkillConnect";
export const SUPPORT_ADMIN_UID = "S8G0CBosGVcPIqvOaz3HVGc0PSx2";

export const getSupportChatId = (userUid) => `${SUPPORT_CHAT_PREFIX}${userUid}`;