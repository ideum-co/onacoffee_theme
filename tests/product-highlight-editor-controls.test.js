const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const section = read('sections/featured-product.liquid');
const productBlock = read('blocks/_featured-product.liquid');
const priceBlock = read('blocks/_featured-product-price.liquid');

assert.match(
  productBlock,
  /content_for 'block', type: 'text', id: 'featured-product-heading'/,
  'Product highlight must compose a native text block for its section heading',
);
assert.match(productBlock, /featured-product-heading-region/);
assert.match(
  productBlock,
  /capture featured_product_heading[\s\S]*?content_for 'block', type: 'text', id: 'featured-product-heading'[\s\S]*?endcapture/,
  'Heading output must be captured before deriving its presence',
);
assert.match(
  productBlock,
  /featured_product_heading\s*\|\s*strip[\s\S]*?featured_product_heading_present/,
  'Heading presence must be derived from stripped Liquid output',
);
assert.match(
  productBlock,
  /featured-product-heading-region--(?:present|empty)/,
  'Heading wrapper must carry an explicit Liquid-derived presence class',
);
assert.match(productBlock, /featured-product-details-region/);
assert.match(productBlock, /featured-product-card-layout/);

assert.match(
  section,
  /"featured-product-heading"\s*:\s*\{[\s\S]*?"type"\s*:\s*"text"/,
  'The preset must define the static heading block',
);
assert.match(section, /\.featured-product-card-layout\s*\{[\s\S]*?display:\s*flex/);
assert.match(section, /justify-content:\s*space-between/);
assert.match(
  section,
  /\.featured-product-heading-region--empty\s*\{[\s\S]*?display:\s*none/,
  'Blank headings must not reserve space',
);
assert.match(
  section,
  /:has\(\.featured-product-heading-region--present\)/,
  'Desktop distribution must require the Liquid-derived presence class',
);
