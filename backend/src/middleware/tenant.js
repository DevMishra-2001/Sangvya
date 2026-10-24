// Multi-tenant safety net. After `authenticate` runs, req.user.companyId
// is trusted (it came from a signed JWT, not from the request body/query).
// This middleware just makes that companyId explicit and available as
// req.companyId, so controllers never have to trust a client-supplied
// company id — closing off the most common multi-tenant data leak.
function scopeToCompany(req, res, next) {
  if (!req.user || !req.user.companyId) {
    return res.status(401).json({ error: "Company context missing — please log in again" });
  }
  req.companyId = req.user.companyId;
  next();
}

module.exports = { scopeToCompany };
