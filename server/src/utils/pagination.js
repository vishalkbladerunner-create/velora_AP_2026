// Offset pagination shared by the admin endpoints and the versioned API.
function readPagination(req, options) {
  const settings = options || {};
  const defaultLimit = settings.defaultLimit || 20;
  const maxLimit = settings.maxLimit || 100;
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? defaultLimit : Number(req.query.limit);

  if (!Number.isInteger(page) || page < 1) {
    return null;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    return null;
  }

  return { page: page, limit: limit, skip: (page - 1) * limit };
}

function buildPage(data, total, page, limit) {
  return {
    data: data,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  readPagination,
  buildPage,
};
