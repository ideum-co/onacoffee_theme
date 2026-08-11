# frozen_string_literal: true

ROOT = File.expand_path('..', __dir__)

def read_repo(path)
  File.read(File.join(ROOT, path))
end

def assert(condition, message)
  raise "FAIL: #{message}" unless condition
end

cart = read_repo('sections/ona-cart-template.liquid')
source = read_repo('assets/script.js')
minified = read_repo('assets/script.min.js')

assert(!source.include?('function customCartRemove'), 'legacy customCartRemove function remains in script.js')
assert(!source.match?(/\bcustomCartRemove\s*\(\s*\)/), 'legacy customCartRemove startup call remains in script.js')
assert(!minified.include?('customCartRemove'), 'legacy customCartRemove remains in script.min.js')
assert(!source.include?("url:'/cart/change.js'"), 'legacy jQuery cart/change request remains')

remove_buttons = cart.scan(%r{<button[^>]+on:click="/onLineItemRemove/\{\{ item\.index \| plus: 1 \}\}"[^>]*>})
assert(remove_buttons.length == 1, 'cart must expose exactly one native remove-button action template')
assert(!cart.include?('data-item-id="{{ item.id }}"'), 'cart row still exposes variant ID for legacy removal')

assert(!cart.include?('assign preorder_count'), 'inferred preorder counter remains')
assert(!cart.include?('assign normal_count'), 'mixed-cart normal counter remains')
assert(!cart.match?(/<input\s+disabled\s+type="submit"\s+name="checkout"/), 'checkout can still be hard-disabled')
assert(!cart.include?('preorder-tips-popup'), 'obsolete preorder popup remains')
assert(!source.include?('function preorderProduct'), 'obsolete preorder popup JavaScript remains')
assert(!minified.include?('preorderProduct'), 'obsolete preorder popup JavaScript remains minified')

assert(!cart.include?('40126200709311'), 'gift behavior still depends on a fixed variant ID')
assert(!cart.include?('assign is_gift'), 'fixed gift classification remains')
assert(!cart.match?(/if\s+is_gift.*?Free/m), 'theme still forces a cart line to display Free')

checkout_controls = cart.scan(/<input\s+type="submit"\s+name="checkout"/)
assert(checkout_controls.length == 1, 'cart must render exactly one enabled checkout control template')

puts 'PASS: cart theme integration regressions'
