# frozen_string_literal: true

require 'json'

ROOT = File.expand_path('..', __dir__)

def read(path)
  File.read(File.join(ROOT, path))
end

def assert(condition, message)
  raise "FAIL: #{message}" unless condition
end

card = read('snippets/ona-product-card.liquid')
card_css = read('assets/ona-product-card.css')
card_js = read('assets/ona-product-card.js')
ona_recommendations = read('sections/ona-product-recommendations.liquid')
consumers = %w[
  sections/ona-featured-collection.liquid
  sections/ona-collection-template.liquid
  sections/ona-search-results.liquid
  sections/product-recommendations.liquid
  sections/ona-product-recommendations.liquid
].to_h { |path| [path, read(path)] }

assert(!card.include?("'ona-product-card.css' | asset_url"), 'card renderer repeats its stylesheet per product')
assert(!card.include?("'ona-product-card.js' | asset_url"), 'card renderer repeats its module per product')
consumers.each do |path, source|
  assert(source.scan("'ona-product-card.css' | asset_url").length == 1, "#{path} must load card CSS exactly once")
  assert(source.scan("'ona-product-card.js' | asset_url").length == 1, "#{path} must load card JS exactly once")
end

assert(card.include?('type="radio"') && card.include?('data-card-radio'), 'card variants do not use native radios')
assert(!card.include?('role="radiogroup"') && !card.include?('role="radio"'), 'card retains incomplete ARIA radio behavior')
native_form_variant = %r{<input\s+[^>]*type="radio"[^>]*name="id"[^>]*form="\{\{ card_form_id \}\}"[^>]*>}m
assert(card.match?(native_form_variant), 'card radios are not native id controls owned by the add form')
assert(card.include?('id="{{ card_form_id }}"'), 'card add form lacks the stable id referenced by native variant radios')
assert(!card.include?('name="ona-card-variant-{{ card_uid }}"'), 'card radios retain a JS-only field name')
simple_hidden_id = %r{unless has_native_variant_selector.*?<input type="hidden" name="id" value="\{\{ selected_variant\.id \}\}" data-card-variant-input>}m
assert(card.match?(simple_hidden_id), 'single-variant cards do not retain a non-duplicated native id field')
assert(card.include?('data-card-current-price'), 'card lacks a stable current-price node')
assert(card.include?('data-variant-available="{{ selected_variant.available }}"'), 'card lacks initial availability state')
assert(card.include?('data-card-compare-price') && card.include?('data-card-compare-value'), 'card lacks stable compare-at nodes')
assert(card.include?('data-variant-compare-at-price') && card.include?('data-variant-on-sale'), 'variant data lacks compare-at state')
assert(card.include?('role="alert"') && card.include?('data-card-error'), 'card lacks an accessible error target')
assert(card.include?("'products.product.add_to_cart' | t"), 'card add label is not localized')
assert(card.include?("'actions.show_all_options' | t"), 'card choose-options label is not localized')
assert(!card_js.match?(/['"](?:Add to cart|Adding…|Sold out|Unable to add this item to the cart\.)['"]/), 'card JS contains English UI labels')

complex_from_price = %r{if product\.options\.size >= 2 and product\.price_varies.*?assign show_from_price = true.*?product\.price_min \| money.*?'products\.product\.from_lowest_price_html' \| t: lowest_price: product_min_price}m
assert(card.match?(complex_from_price), 'complex variable-price cards do not render the localized minimum From price')
simple_variant_price = %r{if show_from_price.*?from_lowest_price_html.*?else.*?data-card-current-price.*?data-card-compare-price}m
assert(card.match?(simple_variant_price), 'simple cards no longer retain variant current/compare-at price nodes')

assert(card.match?(/if featured_image.*?<img/m), 'card image is not conditional')
assert(card.include?('placeholder_svg_tag'), 'card lacks a stable no-image placeholder')
assert(card_css.include?('grid-template-rows:') && card_css.match?(/grid-template-rows:[^;]*\b1fr\b/), 'card grid lacks a flexible action-alignment track')
assert(card_css.include?('-webkit-line-clamp: 2'), 'card title is not visually clamped to two lines')
assert(card_css.match?(/\.ona-card__media img\s*\{[^}]*padding:\s*0;[^}]*max-width:\s*none;/m), 'card image does not neutralize legacy geometry')
assert(card_css.include?('.ona-card__placeholder'), 'card placeholder lacks shared geometry styles')

assert(ona_recommendations.include?("render 'ona-product-card'"), 'active ONA recommendations retain the legacy card')
asset_index = ona_recommendations.index("'ona-product-card.css' | asset_url")
root_index = ona_recommendations.index('<product-recommendations')
assert(asset_index && root_index && asset_index < root_index, 'ONA recommendation assets load inside/after the hydrated subtree')

Dir[File.join(ROOT, 'templates/product*.json')].sort.each do |path|
  template = JSON.parse(File.read(path))
  next unless template.fetch('sections', {}).values.any? { |section| section['type'] == 'ona-product-information' }

  recommendations = template.fetch('sections').values.find { |section| section['type'] == 'ona-product-recommendations' }
  assert(recommendations, "#{File.basename(path)} does not retain the active ONA recommendations section")
end

puts 'PASS: product card and consumer contracts'
