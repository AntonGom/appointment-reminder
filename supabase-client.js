const isDemo = Boolean(window.__APPOINTMENT_REMINDER_DEMO__) || new URLSearchParams(window.location.search).get("demo") === "1";
const authListeners = [];
let realSdk = null;

if (!isDemo) {
  realSdk = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readDemoState() {
  return window.AppointmentReminderDemo?.readState?.() || { user: null, tables: {} };
}

function writeDemoState(state) {
  window.AppointmentReminderDemo?.writeState?.(state);
}

function emitAuthEvent(event) {
  const state = readDemoState();
  const session = state.user ? { user: clone(state.user), access_token: "demo-access-token" } : null;
  authListeners.forEach(listener => listener(event, session));
}

function applyFilters(rows, filters) {
  return rows.filter(row => filters.every(filter => {
    if (filter.type === "eq") return String(row?.[filter.column] ?? "") === String(filter.value ?? "");
    if (filter.type === "in") return filter.values.includes(String(row?.[filter.column] ?? ""));
    return true;
  }));
}

function selectColumns(rows, columns) {
  if (!columns || columns === "*" || String(columns).includes("*")) return clone(rows);
  const names = String(columns).split(",").map(name => name.trim()).filter(Boolean);
  return clone(rows.map(row => Object.fromEntries(names.map(name => [name, row?.[name]]))));
}

function createDemoQueryBuilder(table) {
  const query = {
    action: "select",
    columns: "*",
    filters: [],
    orderBy: [],
    limitCount: null,
    payload: null,
    single: false,
    returnRows: false
  };

  const builder = {
    select(columns = "*") {
      query.columns = columns;
      if (query.action !== "select") query.returnRows = true;
      return builder;
    },
    eq(column, value) {
      query.filters.push({ type: "eq", column, value });
      return builder;
    },
    in(column, values) {
      query.filters.push({ type: "in", column, values: (values || []).map(String) });
      return builder;
    },
    order(column, options = {}) {
      query.orderBy.push({ column, ascending: options.ascending !== false });
      return builder;
    },
    limit(count) {
      query.limitCount = Number(count);
      return builder;
    },
    insert(payload) {
      query.action = "insert";
      query.payload = Array.isArray(payload) ? clone(payload) : [clone(payload)];
      return builder;
    },
    update(payload) {
      query.action = "update";
      query.payload = clone(payload || {});
      return builder;
    },
    upsert(payload) {
      query.action = "upsert";
      query.payload = Array.isArray(payload) ? clone(payload) : [clone(payload)];
      return builder;
    },
    delete() {
      query.action = "delete";
      return builder;
    },
    single() {
      query.single = true;
      return builder;
    },
    maybeSingle() {
      query.single = true;
      return builder;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    }
  };

  async function execute() {
    const state = readDemoState();
    const tableRows = Array.isArray(state.tables?.[table]) ? state.tables[table] : [];
    const matching = applyFilters(tableRows, query.filters);

    if (query.action === "select") {
      let rows = [...matching];
      query.orderBy.forEach(rule => rows.sort((left, right) => {
        const comparison = String(left?.[rule.column] ?? "").localeCompare(String(right?.[rule.column] ?? ""));
        return rule.ascending ? comparison : -comparison;
      }));
      if (Number.isFinite(query.limitCount)) rows = rows.slice(0, query.limitCount);
      const selected = selectColumns(rows, query.columns);
      return { data: query.single ? selected[0] || null : selected, error: null };
    }

    if (query.action === "insert") {
      const inserted = query.payload.map((row, index) => ({
        id: row.id || `demo_${table}_${Date.now()}_${index}`,
        ...row
      }));
      state.tables[table] = [...inserted, ...tableRows];
      writeDemoState(state);
      return { data: query.returnRows ? selectColumns(inserted, query.columns) : inserted, error: null };
    }

    if (query.action === "update") {
      const updated = [];
      state.tables[table] = tableRows.map(row => {
        if (!applyFilters([row], query.filters).length) return row;
        const next = { ...row, ...query.payload };
        updated.push(next);
        return next;
      });
      writeDemoState(state);
      return { data: query.returnRows ? selectColumns(updated, query.columns) : updated, error: null };
    }

    if (query.action === "upsert") {
      const nextRows = [...tableRows];
      const upserted = query.payload.map((row, index) => {
        const id = row.id || `demo_${table}_${Date.now()}_${index}`;
        const existingIndex = nextRows.findIndex(entry => entry.id === id);
        const next = { ...(existingIndex >= 0 ? nextRows[existingIndex] : {}), id, ...row };
        if (existingIndex >= 0) nextRows.splice(existingIndex, 1, next);
        else nextRows.unshift(next);
        return next;
      });
      state.tables[table] = nextRows;
      writeDemoState(state);
      return { data: query.returnRows ? selectColumns(upserted, query.columns) : upserted, error: null };
    }

    if (query.action === "delete") {
      const deletedIds = new Set(matching.map(row => row.id));
      state.tables[table] = tableRows.filter(row => !deletedIds.has(row.id));
      writeDemoState(state);
      return { data: matching, error: null };
    }

    return { data: null, error: null };
  }

  return builder;
}

function createDemoClient() {
  return {
    auth: {
      async getSession() {
        const user = clone(readDemoState().user);
        return { data: { session: user ? { user, access_token: "demo-access-token" } : null }, error: null };
      },
      async getUser() {
        return { data: { user: clone(readDemoState().user) }, error: null };
      },
      async updateUser({ data }) {
        const state = readDemoState();
        state.user.user_metadata = { ...(state.user.user_metadata || {}), ...(data || {}) };
        writeDemoState(state);
        emitAuthEvent("USER_UPDATED");
        return { data: { user: clone(state.user) }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      onAuthStateChange(callback) {
        authListeners.push(callback);
        window.setTimeout(() => {
          const user = clone(readDemoState().user);
          callback("INITIAL_SESSION", user ? { user, access_token: "demo-access-token" } : null);
        }, 0);
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from(table) {
      return createDemoQueryBuilder(table);
    }
  };
}

export function createClient(...args) {
  return isDemo ? createDemoClient() : realSdk.createClient(...args);
}
