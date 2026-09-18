-- Saved runtime settings retain their old values when defaults change.
-- Apply the user's manual-only preference once when upgrading an existing map.
if settings.global["starter-init-auto-grant-on-join"] then
  settings.global["starter-init-auto-grant-on-join"] = { value = false }
end
