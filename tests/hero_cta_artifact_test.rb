# frozen_string_literal: true

ROOT = File.expand_path('..', __dir__)

def read(path)
  File.read(File.join(ROOT, path))
end

def assert(condition, message)
  raise "FAIL: #{message}" unless condition
end

sources = %w[assets/ona-fixes.css assets/main.css].to_h { |path| [path, read(path)] }
served = read('assets/main.min.css')
banner = read('sections/ona-banner-slider.liquid')
served_block = served[/\[data-section-type=ona-slideshow\] \.slideshow__btn,[\s\S]*?@media only screen and \(max-width:749px\)/]

sources.each do |path, css|
  block = css[/\[data-section-type="ona-slideshow"\] \.slideshow__btn,[\s\S]*?@media only screen and \(max-width: 749px\)/]
  assert(block, "#{path} lacks the shared slideshow CTA block")
  assert(block.include?('--color-primary-button-background'), "#{path} lacks the real primary-button background token")
  assert(block.include?('--color-primary-button-text'), "#{path} lacks the real primary-button text token")
  assert(block.include?('--color-primary-button-border'), "#{path} lacks the real primary-button border token")
  assert(!block.include?('--color-btn-primary'), "#{path} retains undefined legacy button tokens")
  assert(css.match?(/slideshow__btn:focus-visible[\s\S]{0,400}outline:\s*3px solid[\s\S]{0,250}box-shadow:/), "#{path} lacks a visible dual-ring focus treatment")
end

assert(served_block, 'served CSS lacks the shared slideshow CTA block')
assert(served_block.include?('--color-primary-button-background'), 'served CSS lacks the real primary-button background token')
assert(served_block.include?('--color-primary-button-hover-background'), 'served CSS lacks the real primary-button hover token')
assert(served_block.match?(/slideshow__btn:focus-visible[^}]*outline:3px solid[^}]*box-shadow:/), 'served CSS lacks the focus-visible treatment')
assert(!served_block.include?('--color-btn-primary'), 'served CTA retains undefined legacy button tokens')

assert(banner.include?('class="slider-button ona-hero-cta'), 'actual homepage hero CTA lacks its component hook')
assert(banner.match?(/\.ona-hero-cta\s*\{[^}]*min-height:\s*48px;[^}]*padding:\s*12px 24px;/m), 'actual homepage hero CTA lacks visible padding and height')

puts 'PASS: hero CTA source and served artifacts'
