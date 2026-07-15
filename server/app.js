const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(morgan('dev'));
app.use(bodyParser.json());

let todoItems = [
  {
    todoItemId: 0,
    name: 'an item',
    priority: 3,
    completed: false
  },
  {
    todoItemId: 1,
    name: 'another item',
    priority: 2,
    completed: false
  },
  {
    todoItemId: 2,
    name: 'a done item',
    priority: 1,
    completed: true
  }
];

// ---- error logging ----

const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

function logError(err, req) {
  fs.mkdir(LOG_DIR, { recursive: true }, (mkdirErr) => {
    if (mkdirErr) {
      console.error('Failed to create log directory:', mkdirErr);
      return;
    }
    const entry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${err.stack || err}\n`;
    fs.appendFile(ERROR_LOG_FILE, entry, (appendErr) => {
      if (appendErr) console.error('Failed to write error log:', appendErr);
    });
  });
}

// ---- validation / sanitization ----

const HTML_TAG_PATTERN = /<[^>]*>/g;
const SQL_PATTERN = /('|--|;|\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER|CREATE)\b)/gi;

function sanitizeString(value) {
  return value.replace(HTML_TAG_PATTERN, '').replace(SQL_PATTERN, '').trim();
}

function nextId() {
  return todoItems.reduce((max, item) => Math.max(max, item.todoItemId), -1) + 1;
}

// Validates/sanitizes name, priority, completed. requireAll=true means every
// field must be present (POST/PUT); otherwise only present fields are checked (PATCH).
function validateItemFields(rawBody, { requireAll }) {
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {};
  const errors = [];
  const result = {};

  const checkers = {
    name: (v) => typeof v === 'string' && v.trim().length > 0,
    priority: (v) => typeof v === 'number' && Number.isFinite(v),
    completed: (v) => typeof v === 'boolean'
  };

  for (const field of Object.keys(checkers)) {
    const present = Object.prototype.hasOwnProperty.call(body, field);
    if (!present) {
      if (requireAll) errors.push(`${field} is required`);
      continue;
    }
    if (!checkers[field](body[field])) {
      errors.push(`${field} must be a valid ${field === 'priority' ? 'number' : field === 'completed' ? 'boolean' : 'non-empty string'}`);
      continue;
    }
    if (field === 'name') {
      const clean = sanitizeString(body.name);
      if (clean.length === 0) {
        errors.push('name must contain valid characters');
      } else {
        result.name = clean;
      }
    } else {
      result[field] = body[field];
    }
  }

  return { errors, result };
}

// ---- routes ----

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

// Filter routes must come before the /:id route so "complete"/"incomplete"
// aren't swallowed as an id param.
app.get('/api/TodoItems/complete', (req, res) => {
  res.status(200).json(todoItems.filter((item) => item.completed === true));
});

app.get('/api/TodoItems/incomplete', (req, res) => {
  res.status(200).json(todoItems.filter((item) => item.completed === false));
});

app.get('/api/TodoItems', (req, res) => {
  res.status(200).json(todoItems);
});

app.get('/api/TodoItems/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  const item = todoItems.find((i) => i.todoItemId === id);
  if (!item) {
    return res.status(404).json({ error: `No todo item found with id ${id}` });
  }
  res.status(200).json(item);
});

app.post('/api/TodoItems', (req, res, next) => {
  try {
    const { errors, result } = validateItemFields(req.body, { requireAll: true });

    let todoItemId;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (Object.prototype.hasOwnProperty.call(body, 'todoItemId')) {
      if (typeof body.todoItemId !== 'number' || !Number.isFinite(body.todoItemId)) {
        errors.push('todoItemId must be a number');
      } else {
        todoItemId = body.todoItemId;
      }
    } else {
      todoItemId = nextId();
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const newItem = { todoItemId, ...result };
    todoItems.push(newItem);
    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

app.put('/api/TodoItems/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const index = todoItems.findIndex((i) => i.todoItemId === id);
    if (index === -1) {
      return res.status(404).json({ error: `No todo item found with id ${id}` });
    }

    const { errors, result } = validateItemFields(req.body, { requireAll: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const updated = { todoItemId: id, ...result };
    todoItems[index] = updated;
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/TodoItems/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const index = todoItems.findIndex((i) => i.todoItemId === id);
    if (index === -1) {
      return res.status(404).json({ error: `No todo item found with id ${id}` });
    }

    const { errors, result } = validateItemFields(req.body, { requireAll: false });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    if (Object.keys(result).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    const updated = { ...todoItems[index], ...result };
    todoItems[index] = updated;
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/TodoItems/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const index = todoItems.findIndex((i) => i.todoItemId === id);
    if (index === -1) {
      return res.status(404).json({ error: `No todo item found with id ${id}` });
    }
    const [deleted] = todoItems.splice(index, 1);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// central error handler - logs to file, responds without leaking internals
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  logError(err, req);
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
