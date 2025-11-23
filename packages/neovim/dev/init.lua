---@diagnostic disable: undefined-global
local fn = vim.fn
local script = debug.getinfo(1, "S").source:sub(2)
local dev_dir = fn.fnamemodify(script, ":p:h")
local repo_root = fn.fnamemodify(dev_dir .. "/../../..", ":p")
local plugin_root = repo_root .. "/packages/neovim"
local demos_root = repo_root .. "/demos/html"

vim.opt.runtimepath:prepend(plugin_root)
vim.opt.packpath:prepend(plugin_root)
vim.cmd("cd " .. fn.fnameescape(demos_root))

vim.cmd("filetype plugin indent on")
vim.cmd("syntax on")

vim.o.termguicolors = true
vim.o.number = true
local ok_theme = pcall(vim.cmd, "colorscheme habamax")
if not ok_theme then
  vim.notify("Failed to load habamax colorscheme; using default UI colors", vim.log.levels.WARN)
end

local ok, plugin = pcall(require, "wc_language_server")
if ok then
  plugin.setup({
    autostart = true,
    log_level = vim.log.levels.INFO,
  })
else
  vim.notify("Failed to load wc_language_server: " .. plugin, vim.log.levels.ERROR)
end

local demo_file = demos_root .. "/test.html"
if fn.filereadable(demo_file) == 1 then
  local success, err = pcall(vim.cmd, "edit " .. fn.fnameescape(demo_file))
  if not success then
    local swapname = vim.fn.swapname(fn.fnameescape(demo_file))
    vim.notify(
      table.concat({
        "Unable to open demo file due to swap/lock:",
        demo_file,
        "swap: " .. (swapname ~= "" and swapname or "<unknown>"),
        "Press 'R' to open readonly, 'E' to recover, or delete the swap file.",
      }, "\n"),
      vim.log.levels.WARN
    )
    vim.cmd("enew")
    vim.api.nvim_buf_set_lines(0, 0, -1, false, {
      "wc-language-server dev profile",
      "",
      "Failed to open demo file: " .. demo_file,
      "",
      "Details: " .. tostring(err),
    })
  end
else
  vim.cmd("enew")
  vim.api.nvim_buf_set_lines(0, 0, -1, false, {
    "wc-language-server dev profile",
    "",
    "demo file not found at: " .. demo_file,
  })
end
