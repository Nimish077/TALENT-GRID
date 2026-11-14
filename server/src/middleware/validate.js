// Request validation with zod. Parsed values replace the raw inputs:
//   - body / params are reassigned
//   - query is stored on req.validatedQuery (Express 5 query is a getter)

export function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body ?? {});
      if (params) req.params = params.parse(req.params);
      if (query) req.validatedQuery = query.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}
