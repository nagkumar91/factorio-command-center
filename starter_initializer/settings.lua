data:extend({
  {
    type = "string-setting",
    name = "starter-init-mode",
    setting_type = "runtime-global",
    default_value = "all-producible",
    allowed_values = { "all-producible", "custom-only", "all-and-custom" },
    order = "a"
  },
  {
    type = "int-setting",
    name = "starter-init-all-item-count",
    setting_type = "runtime-global",
    default_value = 100,
    minimum_value = 1,
    maximum_value = 100000,
    order = "b"
  },
  {
    type = "int-setting",
    name = "starter-init-all-fluid-amount",
    setting_type = "runtime-global",
    default_value = 25000,
    minimum_value = 1,
    maximum_value = 1000000,
    order = "c"
  },
  {
    type = "int-setting",
    name = "starter-init-custom-default-count",
    setting_type = "runtime-global",
    default_value = 100,
    minimum_value = 1,
    maximum_value = 100000,
    order = "d"
  },
  {
    type = "string-setting",
    name = "starter-init-custom-items",
    setting_type = "runtime-global",
    default_value = "iron-plate=1000,copper-plate=1000,steel-plate=500,transport-belt=400,inserter=100,assembling-machine-1=20",
    allow_blank = true,
    order = "e"
  },
  {
    type = "bool-setting",
    name = "starter-init-auto-grant-on-join",
    setting_type = "runtime-global",
    default_value = false,
    order = "f"
  },
  {
    type = "bool-setting",
    name = "starter-init-include-hidden-recipes",
    setting_type = "runtime-global",
    default_value = false,
    order = "g"
  }
})
