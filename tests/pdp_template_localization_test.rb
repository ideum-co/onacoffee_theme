# frozen_string_literal: true

require 'json'

ROOT = File.expand_path('..', __dir__)

def assert(condition, message)
  raise "FAIL: #{message}" unless condition
end

active_templates = Dir[File.join(ROOT, 'templates/product*.json')].sort.each_with_object([]) do |path, result|
  template = JSON.parse(File.read(path))
  main = template.fetch('sections', {}).values.find { |section| section['type'] == 'ona-product-information' }
  result << [path, main] if main
end

assert(active_templates.map { |path, _| File.basename(path) } == %w[product.default.json product.json], 'unexpected active ona-product-information template set')

active_templates.each do |path, main|
  details = main.fetch('blocks').fetch('product-details')
  blocks = details.fetch('blocks')
  order = details.fetch('block_order')
  description = blocks.fetch('text_aEtTtq').fetch('settings').fetch('text')

  assert(description.include?('truncatewords: 45'), "#{File.basename(path)} lacks the compact summary")
  assert(description.include?("'accessibility.product_details' | t"), "#{File.basename(path)} full-details link is not localized")
  assert(description != '{{ closest.product.description }}', "#{File.basename(path)} duplicates the full description above the controls")
  assert(blocks.fetch('ona_subscription_reserve').fetch('type') == 'ona-subscription-reserve', "#{File.basename(path)} lacks the reserve block")
  assert(order.index('group_dm4fkV') < order.index('ona_subscription_reserve'), "#{File.basename(path)} reserve precedes controls")
  assert(order.index('ona_subscription_reserve') < order.index('buy_buttons_eYQEYi'), "#{File.basename(path)} reserve follows buy buttons")
end

product_section = File.read(File.join(ROOT, 'sections/ona-product-information.liquid'))
assert(product_section.include?("{{ 'accessibility.product_details' | t }}"), 'long-form details heading is not localized')

reserve_block = File.read(File.join(ROOT, 'blocks/ona-subscription-reserve.liquid'))
script_index = reserve_block.index("'ona-subscription-reserve.js' | asset_url")
conditional_end = reserve_block.index('{% endif %}')
assert(script_index && conditional_end && script_index > conditional_end, 'reserve module is not loaded for initially ineligible products')
assert(reserve_block.include?("'products.product.loading_subscription_options' | t"), 'reserve loading label is not localized')
assert(reserve_block.include?("'products.product.subscription_options_unavailable' | t"), 'reserve failure label is not localized')

reserve_js = File.read(File.join(ROOT, 'assets/ona-subscription-reserve.js'))
assert(!reserve_js.include?('Subscription options are temporarily unavailable'), 'reserve JS contains an English failure label')
assert(reserve_js.include?('document.documentElement'), 'reserve controller does not observe product morphs')

locale_paths = Dir[File.join(ROOT, 'locales/*.json')].reject { |path| path.end_with?('.schema.json') }.sort
assert(locale_paths.length == 31, 'unexpected supported locale count')
translations = locale_paths.to_h do |path|
  product = JSON.parse(File.read(path)).fetch('products').fetch('product')
  pair = [product.fetch('loading_subscription_options'), product.fetch('subscription_options_unavailable')]
  assert(pair.all? { |value| value.is_a?(String) && !value.empty? }, "#{File.basename(path)} has blank subscription translations")
  [File.basename(path, '.json'), pair]
end

english = translations.fetch('en.default')
translations.each do |locale, pair|
  next if locale == 'en.default'
  assert(pair != english, "#{locale} copies both English subscription translations")
end
assert(translations.fetch('es') == ['Cargando opciones de suscripción…', 'Las opciones de suscripción no están disponibles temporalmente.'], 'Spanish subscription translations changed')
assert(translations.fetch('fr') == ['Chargement des options d’abonnement…', 'Les options d’abonnement sont temporairement indisponibles.'], 'French subscription translations changed')

puts 'PASS: active PDP templates and localized subscription contracts'
