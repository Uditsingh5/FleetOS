import * as auditService from './audit.service.js';
import { sendPaginated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, entityType, entityId, actorId, action } = req.query;
  const result = await auditService.getAuditLogs({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    entityType,
    entityId,
    actorId,
    action,
  });
  sendPaginated(res, result.logs, result.pagination);
});
