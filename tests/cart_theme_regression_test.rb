# frozen_string_literal: true

ROOT = File.expand_path('..', __dir__)

def read_repo(path)
  full_path = File.join(ROOT, path)
  File.exist?(full_path) ? File.read(full_path) : ''
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

header = read_repo('sections/ona-header.liquid')
card = read_repo('snippets/ona-product-card.liquid')
featured = read_repo('sections/ona-featured-collection.liquid')
collection = read_repo('sections/ona-collection-template.liquid')
search = read_repo('sections/ona-search-results.liquid')
recommendations = read_repo('sections/product-recommendations.liquid')
card_css = read_repo('assets/ona-product-card.css')
card_js = read_repo('assets/ona-product-card.js')
slideshow = read_repo('sections/ona-slideshow.liquid')
slideshow_css = read_repo('assets/ona-fixes.css')
product_template = read_repo('templates/product.default.json')
subscription_block = read_repo('blocks/ona-subscription-reserve.liquid')
subscription_js = read_repo('assets/ona-subscription-reserve.js')

assert(header.include?('data-testid="cart-drawer-trigger"'), 'header lacks native drawer trigger contract')
assert(header.include?('on:click="cart-drawer-component/open"'), 'header cart link does not open native drawer')
assert(header.include?('href="{{ routes.cart_url }}"'), 'header cart trigger lacks /cart fallback')

assert(card.include?('<article class="ona-card"'), 'shared ONA card root is not a semantic article')
assert(card.include?('data-ona-card'), 'shared card behavior hook missing')
assert(card.include?('ona-card__media') && card.include?('ona-card__title') && card.include?('ona-card__action'), 'shared card semantic regions missing')
assert(card.include?("'ona-product-card.css' | asset_url | stylesheet_tag"), 'shared card stylesheet is not loaded')
assert(card.include?("'ona-product-card.js' | asset_url"), 'shared card controller is not loaded')
assert(card.include?('product.options.size >= 2'), 'complex products lack a choose-options fallback')
assert(card.include?('class="ona-card__choose"'), 'complex-product fallback lacks the shared CTA')
assert(card.include?('data-card-variant-input') && card.include?('name="quantity"'), 'simple card form lacks required hidden fields')
assert(card.include?('aria-disabled="true"'), 'sold-out variant pills lack an accessible disabled state')
assert(card.include?('{% unless variant.available %}disabled aria-disabled="true"{% endunless %}'), 'sold-out variant pills remain operable')
assert(!card_css.match?(/\.ona-card\s*\{[^}]*\b(?:border|box-shadow|background(?:-color)?)\s*:/m), 'shared card adds a visible container')
assert(card_css.include?('min-height: 44px'), 'card controls lack 44px target')
assert(card_css.include?('min-height: 48px'), 'card CTA lacks 48px target')
assert(card_css.include?('@media (prefers-reduced-motion: reduce)'), 'card motion ignores reduced-motion preference')
assert(card_js.include?("document.addEventListener('click'"), 'shared card pill controller is not delegated')
assert(card_js.include?("document.addEventListener('submit'"), 'shared card controller is not delegated')
assert(card_js.include?("closest('[data-ona-card]')"), 'card interactions are not scoped to their own card')
assert(card_js.include?('event.defaultPrevented'), 'shared card can duplicate a cart mutation handled upstream')
assert(card_js.include?("pill.getAttribute('aria-disabled') === 'true'"), 'shared card activates aria-disabled variant pills')
assert(card_js.include?('window.Shopify.routes.root'), 'shared card add route ignores the Shopify root')
assert(card_js.include?("document.querySelector('cart-items-component[data-drawer]')"), 'shared card does not resolve the active drawer section')
assert(card_js.include?("drawerCartItems?.dataset.sectionId || 'ona_header'"), 'shared card lacks the documented drawer-section fallback')
assert(card_js.include?("formData.set('sections', drawerSectionId)"), 'shared card add does not request the resolved drawer section')
assert(!card_js.include?("new CustomEvent('cart:add'"), 'shared card emits a non-native cart:add event')
assert(card_js.scan(/new CustomEvent\('cart:update'/).length == 1, 'shared card must emit exactly one native cart update event')
assert(card_js.include?("sections[drawerSectionId]"), 'shared card does not validate returned drawer section HTML')
assert(card_js.include?("querySelector('[ref=\"cartItemCount\"]')"), 'shared card does not derive the cart total from returned HTML')
assert(card_js.include?('item_count: itemCount'), 'shared card resource lacks the native cart total')
assert(card_js.include?("source: 'ona-product-card'"), 'shared card update lacks a native event source')
assert(card_js.include?('itemCount,'), 'shared card update data lacks the native cart total')
assert(card_js.include?('sections,'), 'shared card update event lacks section HTML')
assert(card_js.include?('submittedVariantId = variantInput.value'), 'shared card events can report a variant changed in flight')
assert(card_js.scan(/sourceId: submittedVariantId/).length == 1, 'shared card event does not preserve the submitted variant ID')
assert(card_js.scan(/\bfetch\s*\(/).length == 1, 'shared card controller can issue duplicate cart mutations')

[featured, collection, search, recommendations].each_with_index do |source, index|
  assert(source.include?("render 'ona-product-card'"), "card consumer #{index + 1} does not render shared card")
end
recommendations_root = recommendations.index('<product-recommendations')
recommendations_card_css = recommendations.index("'ona-product-card.css' | asset_url | stylesheet_tag")
recommendations_card_js = recommendations.index("'ona-product-card.js' | asset_url")
assert(recommendations_card_css && recommendations_card_css < recommendations_root, 'recommendations can hydrate cards before shared card CSS loads')
assert(recommendations_card_js && recommendations_card_js < recommendations_root, 'recommendations can hydrate cards before shared card controller loads')
collection_card_wrapper = %r{<div class="list">\s*\{% render 'ona-product-card', product: product, index: [^ ]+ %\}\s*</div>}
search_card_wrapper = %r{<div class="list">\s*\{% render 'ona-product-card', product: item, index: [^ ]+ %\}\s*</div>}
assert(collection.match?(collection_card_wrapper), 'collection card bypasses the responsive grid item hook')
assert(search.match?(search_card_wrapper), 'search product card bypasses the responsive grid item hook')
featured_exclusion = %r{unless p\.handle == 'ona-tote'.*<li class="ona-fc__item">.*render 'ona-product-card', product: p, index: card_index.*</li>.*endunless}m
collection_exclusion = %r{unless product\.handle == 'ona-tote'.*<div class="list">.*render 'ona-product-card', product: product, index: card_index.*</div>.*endunless}m
search_exclusion = %r{if item\.object_type == 'product'.*unless item\.handle == 'ona-tote'.*<div class="list">.*render 'ona-product-card', product: item, index: card_index.*</div>.*endunless.*else}m
recommendations_exclusion = %r{if product == blank or product\.handle != 'ona-tote'.*<div class="resource-list__item">.*if product != blank.*render 'ona-product-card', product: product, index: rendered_item_count.*</div>.*endif}m
assert(featured.match?(featured_exclusion), 'featured collection can render an empty list item for an excluded product')
assert(collection.match?(collection_exclusion), 'collection can render an empty grid item for an excluded product')
assert(search.match?(search_exclusion), 'search can render an empty grid item for an excluded product')
assert(recommendations.match?(recommendations_exclusion), 'recommendations can render an empty item for an excluded product')
assert(recommendations.scan(/slide_count: rendered_item_count/).length == 2, 'recommendation carousel counts excluded products as slides')
assert(!featured.include?('ona-fc__pill'), 'featured collection retains duplicate card UI')
assert(!featured.include?("fetch('/cart/add.js'"), 'featured collection retains duplicate cart controller')
assert(!collection.include?("fetch('/cart/add.js'"), 'collection retains duplicate cart controller')

assert(slideshow.include?('slideshow__btn'), 'slideshow CTA hook missing')
assert(slideshow.include?('class="btn slideshow__btn"'), 'desktop slideshow CTA does not share the CTA hook')
assert(slideshow_css.match?(/\.slideshow__btn[\s\S]{0,400}min-height:\s*48px/), 'hero CTA lacks 48px minimum height')
assert(slideshow_css.match?(/\.slideshow__btn[\s\S]{0,400}padding:/), 'hero CTA lacks component padding')
assert(slideshow_css.include?('[data-section-type="ona-slideshow"] .slideshow__btn,'), 'hero CTA treatment is not scoped to the ONA slideshow')
assert(!slideshow_css.match?(/\.slideshow__btn\s*\{[\s\S]{0,300}line-height:\s*2\.2/), 'hero CTA retains the conflicting line height')

assert(product_template.include?('truncatewords: 45'), 'PDP compact summary is not capped at 45 words')
summary_with_link = %r{\{% if closest\.product\.description != blank %\}.*truncatewords: 45.*href=\\?"#ona-product-full-details\\?".*\{% endif %\}}
assert(product_template.match?(summary_with_link), 'PDP renders a full-details link for a blank description')
assert(product_template.include?('ona_subscription_reserve'), 'PDP lacks subscription reservation block')
assert(subscription_block.include?('closest.product.selling_plan_groups'), 'subscription reserve is not product-aware')
assert(subscription_js.include?('8000'), 'Appstle failure timeout is not eight seconds')
assert(subscription_js.include?('MutationObserver'), 'Appstle reservation does not observe vendor rendering')

puts 'PASS: storefront theme regressions'
