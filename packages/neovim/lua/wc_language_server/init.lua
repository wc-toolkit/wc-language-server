---@diagnostic disable: undefined-global
local api = vim.api
local fn = vim.fn
local uv = vim.loop

local script_path = debug.getinfo(1, "S").source:sub(2)
local plugin_root = fn.fnamemodify(script_path, ":p:h:h:h")
local packaged_server = fn.fnamemodify(plugin_root .. "/server/bin/wc-language-server", ":p")
local bundled_server = fn.fnamemodify(plugin_root .. "/../language-server/bin/wc-language-server", ":p")

local defaults = {
  autostart = true,
  name = "wc-language-server",
  filetypes = {
    "html",
    "handlebars",
    "htmldjango",
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue",
    "svelte",
    "astro",
    "twig",
    "css",
    "scss",
    "less",
    "markdown",
    "mdx",
  },
  root_dir_patterns = { "wc.config.js", "package.json", ".git" },
  watch_patterns = {
    "custom%-elements%.json$",
    "wc%.config%.[jt]s$",
    "wc%.config%.mjs$",
    "wc%.config%.cjs$",
    "package%.json$",
    "node_modules",
  },
  watch_files = {
    "wc.config.js",
    "wc.config.ts",
    "wc.config.mjs",
    "wc.config.cjs",
    "custom-elements.json",
    "package.json",
  },
  debounce_ms = 350,
  log_level = vim.log.levels.WARN,
  settings = {},
  capabilities = nil,
  on_attach = nil,
  root_dir = nil,
  tsdk = nil,
  tsdk_search_paths = {},
  cmd = nil,
  diagnostics = {
    virtual_text = false,
    underline = true,
    signs = true,
    severity_sort = true,
    float = {
      source = "if_many",
    },
  },
  hover = {
    keymap = "K",
    include_diagnostics = true,
    markdown_highlighting = true,
  },
  completion = {
    set_omnifunc = true,
  },
}

local config = vim.deepcopy(defaults)

local severity_labels = {
  [vim.diagnostic.severity.ERROR] = "Error",
  [vim.diagnostic.severity.WARN] = "Warning",
  [vim.diagnostic.severity.INFO] = "Info",
  [vim.diagnostic.severity.HINT] = "Hint",
}

local function get_offset_encoding(bufnr)
  local clients = vim.lsp.get_clients({ bufnr = bufnr })
  if not clients or #clients == 0 then
    return "utf-16"
  end
  local capabilities = clients[1].server_capabilities or {}
  return clients[1].offset_encoding or capabilities.positionEncoding or "utf-16"
end

local state = {
  clients = {},
  bufs_for_root = {},
  watchers = {},
  restart_timers = {},
  autocmd_group = nil,
  exit_autocmd = nil,
  commands_registered = false,
}

local function trim_empty_lines(lines)
  local first, last = 1, #lines
  while first <= last and lines[first]:match("^%s*$") do
    first = first + 1
  end
  while last >= first and lines[last]:match("^%s*$") do
    last = last - 1
  end
  if first > last then
    return {}
  end
  local trimmed = {}
  for i = first, last do
    trimmed[#trimmed + 1] = lines[i]
  end
  return trimmed
end

local log = function(level, msg)
  if not config.log_level then
    return
  end
  if level < config.log_level then
    return
  end
  vim.schedule(function()
    vim.notify(msg, level, { title = "Web Components LS" })
  end)
end

local function apply_markdown_highlighting(bufnr)
  if not bufnr or not api.nvim_buf_is_valid(bufnr) then
    return
  end
  if config.hover and config.hover.markdown_highlighting == false then
    return
  end

  pcall(vim.api.nvim_buf_set_option, bufnr, "filetype", "markdown")

  local ts = vim.treesitter
  if ts and ts.start then
    pcall(ts.start, bufnr, "markdown")
    pcall(ts.start, bufnr, "markdown_inline")
  end
end

local function render_markdown_float(lines, float_opts)
  local bufnr, win = vim.lsp.util.open_floating_preview(lines, "markdown", float_opts)
  if not bufnr then
    return
  end

  local should_highlight = not (config.hover and config.hover.markdown_highlighting == false)
  if not should_highlight then
    return bufnr, win
  end

  local stylize = vim.lsp.util.stylize_markdown
  if type(stylize) == "function" then
    local prev = vim.bo[bufnr].modifiable
    vim.bo[bufnr].modifiable = true
    local ok, err = pcall(stylize, bufnr, lines, float_opts)
    vim.bo[bufnr].modifiable = prev
    if not ok then
      log(vim.log.levels.WARN, "Failed to stylize markdown hover: " .. tostring(err))
      apply_markdown_highlighting(bufnr)
    else
      -- stylize_markdown re-writes the buffer, so reapply filetype to trigger treesitter highlight
      apply_markdown_highlighting(bufnr)
    end
  else
    apply_markdown_highlighting(bufnr)
  end

  return bufnr, win
end

local function build_hover_with_diagnostics(bufnr)
  bufnr = bufnr or api.nvim_get_current_buf()
  local win = vim.fn.bufwinid(bufnr)
  if not win or win == -1 then
    win = 0
  end
  local offset_encoding = get_offset_encoding(bufnr)
  local params = vim.lsp.util.make_position_params(win, offset_encoding)
  params.positionEncoding = params.positionEncoding or offset_encoding
  vim.lsp.buf_request(bufnr, "textDocument/hover", params, function(err, result)
    if err then
      log(vim.log.levels.ERROR, string.format("Hover request failed: %s", err.message or err))
      return
    end

    local hover_lines = {}
    local syntax = "markdown"
    if result and result.contents then
      hover_lines = vim.lsp.util.convert_input_to_markdown_lines(result.contents)
      hover_lines = trim_empty_lines(hover_lines)
    end

    local diag_lines = {}
    local should_include_diag = not (config.hover and config.hover.include_diagnostics == false)
    if should_include_diag then
      local diags = vim.diagnostic.get(bufnr, { lnum = params.position.line })
      for _, diagnostic in ipairs(diags) do
        local severity = severity_labels[diagnostic.severity] or "Info"
        table.insert(diag_lines, string.format("**%s:** %s", severity, diagnostic.message or ""))
        if diagnostic.code then
          table.insert(diag_lines, string.format("  `code: %s`", diagnostic.code))
        end
      end
    end

    local lines = {}
    if hover_lines and #hover_lines > 0 then
      vim.list_extend(lines, hover_lines)
    end
    if #diag_lines > 0 then
      if #lines > 0 then
        table.insert(lines, "---")
      end
      table.insert(lines, "**Diagnostics**")
      vim.list_extend(lines, diag_lines)
    end

    if #lines == 0 then
      if #diag_lines == 0 then
        vim.diagnostic.open_float(bufnr, {
          border = config.hover and config.hover.border or "rounded",
          focusable = false,
        })
      end
      return
    end

    local float_opts = {
      border = config.hover and config.hover.border or "rounded",
      focusable = false,
    }
    if config.hover and config.hover.float_opts then
      float_opts = vim.tbl_deep_extend("force", float_opts, config.hover.float_opts)
    end

    render_markdown_float(lines, float_opts)
  end)
end

local function file_exists(path)
  if not path or path == "" then
    return false
  end
  local stat = uv.fs_stat(path)
  return stat ~= nil
end

local function close_handle(handle)
  if not handle then
    return
  end
  pcall(handle.stop, handle)
  pcall(handle.close, handle)
end

local function resolve_node_binary()
  local node = fn.exepath("node")
  if node == nil or node == "" then
    node = "node"
  end
  return node
end

local function build_cmd(root_dir)
  if type(config.cmd) == "function" then
    local custom_cmd = config.cmd(root_dir, config)
    if custom_cmd then
      return custom_cmd
    end
  elseif type(config.cmd) == "table" then
    return config.cmd
  end

  if file_exists(packaged_server) then
    return { resolve_node_binary(), packaged_server, "--stdio" }
  end

  if file_exists(bundled_server) then
    return { resolve_node_binary(), bundled_server, "--stdio" }
  end

  local bin = fn.exepath("wc-language-server")
  if bin ~= nil and bin ~= "" then
    return { bin, "--stdio" }
  end

  return nil
end

local function resolve_tsdk(root_dir)
  if config.tsdk and config.tsdk ~= "" then
    return config.tsdk
  end

  local env_tsdk = vim.env.WC_LS_TSDK
  if env_tsdk and env_tsdk ~= "" then
    return env_tsdk
  end

  local search = {}
  if root_dir then
    table.insert(search, root_dir .. "/node_modules/typescript/lib")
  end
  table.insert(search, uv.cwd() .. "/node_modules/typescript/lib")
  if type(config.tsdk_search_paths) == "table" then
    for _, candidate in ipairs(config.tsdk_search_paths) do
      table.insert(search, candidate)
    end
  end

  for _, candidate in ipairs(search) do
    local stat = uv.fs_stat(candidate)
    if stat and stat.type == "directory" then
      return candidate
    end
  end

  return nil
end

local function should_attach(bufnr)
  if not api.nvim_buf_is_valid(bufnr) or not api.nvim_buf_is_loaded(bufnr) then
    return false
  end
  local ft = vim.bo[bufnr].filetype
  return vim.tbl_contains(config.filetypes, ft)
end

local function resolve_root(bufnr)
  if type(config.root_dir) == "string" then
    return config.root_dir
  elseif type(config.root_dir) == "function" then
    return config.root_dir(bufnr)
  end

  local name = api.nvim_buf_get_name(bufnr)
  if name == "" then
    return uv.cwd()
  end
  local dir = vim.fs.dirname(name) or uv.cwd()
  local found = vim.fs.find(config.root_dir_patterns, { path = dir, upward = true, stop = uv.os_homedir() })
  if #found > 0 then
    local path = found[1]
    local stat = uv.fs_stat(path)
    if stat and stat.type == "directory" then
      return path
    end
    return vim.fs.dirname(path)
  end
  return dir
end

local should_restart
should_restart = function(filename)
  if not filename then
    return false
  end
  local lower_name = filename:lower()
  for _, pattern in ipairs(config.watch_patterns or {}) do
    if lower_name:match(pattern) then
      return true
    end
  end
  return false
end

local attach_watchers
local restart_client
local start_client
local make_on_attach

local function clear_timer(root_dir)
  local timer = state.restart_timers[root_dir]
  if timer then
    timer:stop()
    timer:close()
    state.restart_timers[root_dir] = nil
  end
end

local function schedule_restart(root_dir, reason)
  if not state.clients[root_dir] then
    return
  end
  clear_timer(root_dir)
  local timer = uv.new_timer()
  timer:start(config.debounce_ms, 0, function()
    timer:stop()
    timer:close()
    state.restart_timers[root_dir] = nil
    vim.schedule(function()
      log(vim.log.levels.INFO, string.format("Restarting %s (%s)", root_dir, reason))
      restart_client(root_dir, reason)
    end)
  end)
  state.restart_timers[root_dir] = timer
end

attach_watchers = function(root_dir)
  if state.watchers[root_dir] then
    return
  end

  local handles = {}
  local recursive_handle = uv.new_fs_event()
  local ok = recursive_handle:start(root_dir, { recursive = true }, function(err, filename)
    if err then
      return
    end
    if should_restart(filename or "") then
      schedule_restart(root_dir, filename or "filesystem change")
    end
  end)

  if ok then
    table.insert(handles, recursive_handle)
    state.watchers[root_dir] = handles
    return
  else
    close_handle(recursive_handle)
  end

  for _, relative in ipairs(config.watch_files or {}) do
    local target = root_dir .. "/" .. relative
    if file_exists(target) then
      local handle = uv.new_fs_event()
      local started = handle:start(target, {}, function(err)
        if not err then
          schedule_restart(root_dir, relative .. " changed")
        end
      end)
      if started then
        table.insert(handles, handle)
      else
        close_handle(handle)
      end
    end
  end

  if #handles > 0 then
    state.watchers[root_dir] = handles
  end
end

local function launch_client(lsp_config, bufnr)
  if vim.lsp.start then
    return vim.lsp.start(lsp_config, { bufnr = bufnr })
  end
  local client_id = vim.lsp.start_client(lsp_config)
  if client_id and bufnr then
    vim.lsp.buf_attach_client(bufnr, client_id)
  end
  return client_id
end

make_on_attach = function()
  local user_on_attach = config.on_attach
  return function(client, bufnr)
    if config.hover ~= false then
      local hover_cfg = config.hover or {}
      if hover_cfg.keymap ~= false then
        local key = hover_cfg.keymap or "K"
        vim.keymap.set("n", key, function()
          build_hover_with_diagnostics(bufnr)
        end, { buffer = bufnr, desc = "Web Components hover" })
      end
    end

    local should_set_omnifunc = true
    if config.completion and config.completion.set_omnifunc == false then
      should_set_omnifunc = false
    end
    if should_set_omnifunc then
      pcall(vim.api.nvim_buf_set_option, bufnr, "omnifunc", "v:lua.vim.lsp.omnifunc")
    end

    if type(user_on_attach) == "function" then
      local ok, err = pcall(user_on_attach, client, bufnr)
      if not ok then
        log(vim.log.levels.ERROR, string.format("on_attach error: %s", err))
      end
    end
  end
end

start_client = function(bufnr)
  bufnr = bufnr or api.nvim_get_current_buf()
  if not should_attach(bufnr) then
    return nil
  end

  local root_dir = resolve_root(bufnr)
  if not root_dir then
    return nil
  end

  state.bufs_for_root[root_dir] = bufnr

  local existing_id = state.clients[root_dir]
  if existing_id then
    local existing_client = vim.lsp.get_client_by_id(existing_id)
    if existing_client and not (existing_client.is_stopped and existing_client:is_stopped()) then
      vim.lsp.buf_attach_client(bufnr, existing_id)
      return existing_id
    end
  end

  local cmd = build_cmd(root_dir)
  if not cmd then
    log(vim.log.levels.ERROR, "Unable to locate wc-language-server binary. Set `cmd` in setup().")
    return nil
  end

  local tsdk = resolve_tsdk(root_dir)
  local on_attach = make_on_attach()
  local client_id = launch_client({
    name = config.name,
    cmd = cmd,
    root_dir = root_dir,
    filetypes = config.filetypes,
    settings = config.settings,
    capabilities = config.capabilities,
    on_attach = on_attach,
    single_file_support = false,
    init_options = {
      typescript = {
        tsdk = tsdk,
      },
    },
  }, bufnr)

  if client_id then
    state.clients[root_dir] = client_id
    attach_watchers(root_dir)
    log(vim.log.levels.INFO, string.format("Web Components LS attached to %s", root_dir))
  end

  return client_id
end

restart_client = function(root_dir, reason)
  root_dir = root_dir or resolve_root(api.nvim_get_current_buf())
  if not root_dir then
    return
  end

  local client_id = state.clients[root_dir]
  if not client_id then
    start_client(state.bufs_for_root[root_dir] or api.nvim_get_current_buf())
    return
  end

  local client = vim.lsp.get_client_by_id(client_id)
  if not client then
    state.clients[root_dir] = nil
    start_client(state.bufs_for_root[root_dir] or api.nvim_get_current_buf())
    return
  end

  client.stop(true)
  state.clients[root_dir] = nil
  vim.defer_fn(function()
    start_client(state.bufs_for_root[root_dir] or api.nvim_get_current_buf())
  end, 120)

  if reason then
    log(vim.log.levels.INFO, string.format("Manual restart requested (%s)", reason))
  end
end

local function stop_client(root_dir)
  local client_id = state.clients[root_dir]
  if client_id then
    local client = vim.lsp.get_client_by_id(client_id)
    if client then
      client.stop(true)
    end
    state.clients[root_dir] = nil
  end
  clear_timer(root_dir)
  local watchers = state.watchers[root_dir]
  if watchers then
    for _, handle in ipairs(watchers) do
      close_handle(handle)
    end
    state.watchers[root_dir] = nil
  end
end

local function cleanup()
  local roots = {}
  for root in pairs(state.clients) do
    table.insert(roots, root)
  end
  for _, root in ipairs(roots) do
    stop_client(root)
  end
  if state.autocmd_group then
    pcall(vim.api.nvim_del_augroup_by_id, state.autocmd_group)
    state.autocmd_group = nil
  end
end

local function register_autocmd()
  if state.autocmd_group then
    pcall(vim.api.nvim_del_augroup_by_id, state.autocmd_group)
  end
  state.autocmd_group = api.nvim_create_augroup("WcLanguageServerAutoStart", { clear = true })
  api.nvim_create_autocmd("FileType", {
    group = state.autocmd_group,
    callback = function(ev)
      if should_attach(ev.buf) then
        start_client(ev.buf)
      end
    end,
  })
end

local function register_commands()
  if state.commands_registered then
    return
  end
  api.nvim_create_user_command("WcLanguageServerRestart", function()
    restart_client(nil, "User command")
  end, { desc = "Restart the Web Components Language Server" })

  api.nvim_create_user_command("WcLanguageServerStop", function()
    local root = resolve_root(api.nvim_get_current_buf())
    if root then
      stop_client(root)
    end
  end, { desc = "Stop the Web Components Language Server for the current root" })

  api.nvim_create_user_command("WcLanguageServerStart", function()
    start_client(api.nvim_get_current_buf())
  end, { desc = "Start the Web Components Language Server" })

  state.commands_registered = true
end

local function register_exit_handler()
  if state.exit_autocmd then
    return
  end
  state.exit_autocmd = api.nvim_create_autocmd("VimLeavePre", {
    callback = cleanup,
  })
end

local M = {}

function M.setup(opts)
  opts = opts or {}
  config = vim.tbl_deep_extend("force", vim.deepcopy(defaults), opts)

  if config.diagnostics then
    vim.diagnostic.config(config.diagnostics)
  end

  register_commands()
  register_exit_handler()

  if config.autostart then
    register_autocmd()
    for _, buf in ipairs(api.nvim_list_bufs()) do
      if should_attach(buf) then
        start_client(buf)
      end
    end
  end

  return M
end

function M.start(bufnr)
  return start_client(bufnr)
end

function M.restart(root_dir)
  restart_client(root_dir, "API request")
end

function M.stop(root_dir)
  if root_dir then
    stop_client(root_dir)
    return
  end
  cleanup()
end

function M.status()
  local status = {}
  for root, client_id in pairs(state.clients) do
    local client = vim.lsp.get_client_by_id(client_id)
    status[root] = {
      client_id = client_id,
      name = client and client.name or config.name,
      is_active = client and not (client.is_stopped and client:is_stopped()),
    }
  end
  return status
end

function M.client_ids()
  local ids = {}
  for _, id in pairs(state.clients) do
    table.insert(ids, id)
  end
  return ids
end

function M.attach(bufnr)
  return start_client(bufnr)
end

return M
