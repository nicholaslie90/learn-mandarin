(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA_VERSION = 1;

  function buildExportBundle(s, exportedAt) {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: exportedAt || null,
      progress: s.progress || {},
      streak: s.streak || 0,
      lastStudyDate: s.lastStudyDate || null,
      points: s.points || 0,
      readEssayIds: s.readEssayIds || [],
      unlockedExtraIds: s.unlockedExtraIds || [],
      journey: s.journey || null,
    };
  }

  function validateImportBundle(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a valid file.' };
    if (obj.schemaVersion !== SCHEMA_VERSION) {
      return { ok: false, error: 'Unsupported file version (' + obj.schemaVersion + ').' };
    }
    if (!obj.progress || typeof obj.progress !== 'object') return { ok: false, error: 'Missing progress data.' };
    if (!obj.journey || typeof obj.journey !== 'object') return { ok: false, error: 'Missing journey data.' };
    return { ok: true, data: obj };
  }

  return {
    __name: 'Backup',
    SCHEMA_VERSION: SCHEMA_VERSION,
    buildExportBundle: buildExportBundle,
    validateImportBundle: validateImportBundle,
  };
});
