export const createMatchHistoryRequestBody = (userId: string): string => {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error('当前 Gaggle 账号缺少用户 ID');
  return JSON.stringify({ uid: normalizedUserId });
};
