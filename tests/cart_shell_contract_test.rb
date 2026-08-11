# frozen_string_literal: true

ROOT = File.expand_path('..', __dir__)
header = File.read(File.join(ROOT, 'sections/ona-header.liquid'))
cart = File.read(File.join(ROOT, 'sections/ona-cart-template.liquid'))
main_css = File.read(File.join(ROOT, 'assets/main.css'))
main_min_css = File.read(File.join(ROOT, 'assets/main.min.css'))

def assert(condition, message)
  raise "FAIL: #{message}" unless condition
end

assert(header.match?(/\.ona-cart-trigger\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/m), 'header cart trigger lacks a 44px hit target')
wrapper_target = /header \.icon-list li > cart-drawer-component\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;/m
assert(main_css.match?(wrapper_target), 'header cart wrapper still reserves less than a 44px layout slot')
assert(main_min_css.include?('header .icon-list li>cart-drawer-component{width:44px;min-width:44px}'), 'served CSS does not reserve the 44px cart-wrapper slot')
can_remove_guard = %r{assign can_remove = item\.instructions\.can_remove\s*\| default: true, allow_false: true.*?if can_remove.*?<button[^>]+on:click="/onLineItemRemove/\{\{ item\.index \| plus: 1 \}\}"}m
assert(cart.match?(can_remove_guard), 'ONA cart remove action ignores item.instructions.can_remove')

puts 'PASS: cart shell contracts'
