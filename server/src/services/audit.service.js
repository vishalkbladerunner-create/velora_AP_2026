const { EventEmitter } = require('events');
const prisma = require('../db/prisma');

// Domain events are emitted synchronously and persisted by a listener, so the
// request path is not blocked by an audit write.
const events = new EventEmitter();

events.on('audit', (entry) => {
  prisma.auditLog.create({ data: entry }).catch((error) => {
    console.error('Audit write failed:', error.message);
  });
});

function record(action, options) {
  const details = options || {};

  events.emit('audit', {
    action: action,
    entity: details.entity || 'system',
    entityId: details.entityId === undefined || details.entityId === null ? null : String(details.entityId),
    actorId: details.actorId || null,
    metadata: details.metadata ? JSON.stringify(details.metadata) : null,
  });
}

module.exports = {
  events: events,
  record: record,
};
