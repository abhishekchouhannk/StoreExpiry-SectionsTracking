const sites           = require('./sites');
const sections        = require('./sections');
const dashboard       = require('./dashboard');
const cleaningLogs    = require('./cleaningLogs');
const planogramChecks = require('./planogramChecks');
const expiryLogs      = require('./expiryLogs');
const orderItems      = require('./orderItems');
const checklists      = require('./checklists');
const sandwichTracker = require('./sandwichTracker');
const testwash        = require('./testwash');
const reports         = require('./reports');
const employees       = require('./employees');
function mountRoutes(app) {
  app.use('/api/sites',            sites);
  app.use('/api/sections',         sections);
  app.use('/api/dashboard',        dashboard);
  app.use('/api/cleaning-logs',    cleaningLogs);
  app.use('/api/planogram-checks', planogramChecks);
  app.use('/api/expiry-logs',      expiryLogs);
  app.use('/api/order-items',      orderItems);
  app.use('/api',                  checklists);          // /api/checklist, /api/daily-checklist, /api/weekly-checklist
  app.use('/api/sandwich-tracker', sandwichTracker);
  app.use('/api/testwash',         testwash);
  app.use('/api',                  reports);             // /api/weekly-report, /api/section-activity
  app.use('/api/employees',        employees);
}
module.exports = mountRoutes;