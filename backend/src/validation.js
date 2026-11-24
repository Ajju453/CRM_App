'use strict';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDateRange(query) {
  const from = query.from === undefined || query.from === '' ? null : query.from;
  const to = query.to === undefined || query.to === '' ? null : query.to;
  if ((from !== null && !isValidDate(from)) || (to !== null && !isValidDate(to))) {
    throw new HttpError(400, 'Dates must use the YYYY-MM-DD format');
  }
  if (from !== null && to !== null && from > to) {
    throw new HttpError(400, '"from" must be on or before "to"');
  }
  return { from, to };
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id');
  }
  return id;
}

module.exports = { HttpError, isValidDate, parseDateRange, parseId };
