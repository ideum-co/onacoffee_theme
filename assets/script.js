// === Round 44 / Phase A2 — IntersectionObserver replaces WOW.js ======================
// WOW.js CDN (~10K) + animate.css subset removed. This IIFE provides the same fade-in-
// on-scroll behavior using native IntersectionObserver. Reads data-wow-duration /
// data-wow-delay / data-wow-iteration into inline animation-* style, then adds
// .animated to trigger CSS @keyframes (see main.css R44 block). Shopify section:load
// re-scans for newly-rendered .wowo elements. Reduced-motion handled in CSS.
(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    function revealAll() {
        var els = document.querySelectorAll('.wowo:not(.animated)');
        for (var i = 0; i < els.length; i++) els[i].classList.add('animated');
    }

    if (typeof IntersectionObserver === 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', revealAll);
        } else {
            revealAll();
        }
        window.wowo = revealAll;
        return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry.isIntersecting) continue;
            var el = entry.target;
            var dur = el.getAttribute('data-wow-duration');
            var del = el.getAttribute('data-wow-delay');
            var iter = el.getAttribute('data-wow-iteration');
            if (dur)  el.style.animationDuration = dur;
            if (del)  el.style.animationDelay = del;
            if (iter) el.style.animationIterationCount = iter;
            el.classList.add('animated');
            obs.unobserve(el);
        }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    function init() {
        var els = document.querySelectorAll('.wowo:not(.animated)');
        for (var i = 0; i < els.length; i++) observer.observe(els[i]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    document.addEventListener('shopify:section:load', init);
    window.wowo = init; // legacy alias — old wowo() function removed below
})();

// Idempotently stub missing jQuery plugins on the CURRENT window.jQuery.
// Safe to call repeatedly; cheap. Must be called before any .slick() /
// .matchHeight() / $.cookie() because apps may asynchronously swap
// window.jQuery AFTER DOM ready (Shopify review / upsell / popup apps often
// do `jQuery.noConflict(true)` + inject their own jQuery). When that happens
// the original stubbed instance is orphaned and the new window.jQuery has
// neither the real plugin nor the stub — so any top-level function whose
// `jQuery` identifier resolves to global (slider / video_titleFilter) will
// throw "jQuery(...).slick is not a function". Calling this helper at each
// entry point catches the new instance before the first plugin call.
// See MODIFICATION_NOTES.md #22.
//
// R44 / Phase A1: jQuery.cookie is now a real mini implementation (was a
// no-op stub returning undefined while jquery.cookie.js carried the real
// impl). jquery.cookie.js removed from theme.liquid; this inline impl
// covers the only two call sites (popUp() L978/L984: read + write the
// 'open-modal-form' cookie). Mirrors jquery.cookie 1.x signature:
//   read:  jQuery.cookie('name')                              -> string|undefined
//   write: jQuery.cookie('name', val, { expires: days, path }) -> void
function onaEnsureJqStubs() {
    if (typeof jQuery === 'undefined' || !jQuery.fn) return;
    if (typeof jQuery.fn.slick !== 'function') jQuery.fn.slick = function () { return this; };
    if (typeof jQuery.fn.matchHeight !== 'function') jQuery.fn.matchHeight = function () { return this; };
    if (typeof jQuery.cookie !== 'function') {
        jQuery.cookie = function (name, value, opts) {
            if (arguments.length < 2) {
                var re = new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\\/+^]/g, '\\$&') + '=([^;]*)');
                var m = document.cookie.match(re);
                return m ? decodeURIComponent(m[1]) : undefined;
            }
            opts = opts || {};
            var parts = [name + '=' + encodeURIComponent(value)];
            if (typeof opts.expires === 'number') {
                parts.push('expires=' + new Date(Date.now() + opts.expires * 86400000).toUTCString());
            } else if (opts.expires instanceof Date) {
                parts.push('expires=' + opts.expires.toUTCString());
            }
            if (opts.path) parts.push('path=' + opts.path);
            if (opts.domain) parts.push('domain=' + opts.domain);
            if (opts.secure) parts.push('secure');
            document.cookie = parts.join('; ');
        };
    }
}
onaEnsureJqStubs();

function menuHamburger(){
    jQuery('.hamburger').off('click.ona-hamburger').on('click.ona-hamburger', function (e) {
        e.preventDefault();
        jQuery(this).toggleClass('active');
        jQuery('nav').toggleClass('is-show');
        jQuery('header').toggleClass('nav-show');
        jQuery('body').toggleClass('overflow-hidden');
        jQuery('.layer-out').toggleClass('show');
    });
    // Append icon only once (idempotent across shopify:section:load reruns).
    // Level 2/3 links inside the dropdown get the arrow; level 1 intentionally
    // does NOT (mobile expands level-2 by tapping the <a> itself — 2026-04-23).
    jQuery('nav .menu-list .site-nav__dropdown ul li').each(function() {
        var $a = jQuery(this).children('a').first();
        if (!$a.find('.icon-arrow-smaller').length) {
            $a.append('<i class="icon-arrow-smaller"></i>');
        }
    });
    // Cleanup: remove any icon previously appended to level 1 main links
    // (was added in a prior revision; no longer wanted per 2026-04-23 spec).
    jQuery('nav .menu-list > .site-nav--has-dropdown > a.site-nav__link--main > .icon-arrow-smaller').remove();

    // Dropdown trigger:
    //   Desktop (>=992px): hover open on <li> + mouseleave close (matches live).
    //   Mobile  (<992px):  tap .site-nav__link--main: first tap preventDefault
    //                      + expand level-2 dropdown, second tap navigates.
    //                      tap .site-nav__child-link--parent: always
    //                      preventDefault, toggle level-3. Hover expansion of
    //                      level-3 is disabled in ona-fixes.css @≤991.98.
    // Breakpoint matches the 991.98px boundary used everywhere in main.css.
    // Classes driving visuals:
    //   - <li>.is-open → dropdown panel visible (main.css @≤991.98 mobile block)
    //   - .header-right.hover → nav + icon-list flip to brand purple (desktop)
    var navIsMobile = function () { return window.innerWidth < 992; };

    jQuery('nav .menu-list').off('mouseenter.ona-nav mouseleave.ona-nav', '.site-nav--has-dropdown');
    jQuery('nav .menu-list').on('mouseenter.ona-nav', '.site-nav--has-dropdown', function () {
        if (navIsMobile()) return;
        var $li = jQuery(this);
        jQuery('nav .menu-list .site-nav--has-dropdown').not($li).removeClass('is-open thisHover');
        $li.addClass('is-open thisHover');
        jQuery('.header-right').addClass('hover');
    });
    jQuery('nav .menu-list').on('mouseleave.ona-nav', '.site-nav--has-dropdown', function () {
        if (navIsMobile()) return;
        jQuery(this).removeClass('is-open thisHover');
        jQuery('.header-right').removeClass('hover');
    });

    // Mobile level-1: first tap opens dropdown (preventDefault), second tap
    // on an already-open link navigates normally.
    jQuery('nav .menu-list').off('click.ona-nav', '.site-nav--has-dropdown > a.site-nav__link--main');
    jQuery('nav .menu-list').on('click.ona-nav', '.site-nav--has-dropdown > a.site-nav__link--main', function (e) {
        if (!navIsMobile()) return;
        var $li = jQuery(this).parent();
        if (!$li.hasClass('is-open')) {
            e.preventDefault();
            jQuery('nav .menu-list .site-nav--has-dropdown').not($li).removeClass('is-open thisHover');
            $li.addClass('is-open thisHover');
        }
    });

    // Mobile L2 parent: toggleClass on .is-open syncs arrow direction (rotate(-90deg)
    // <-> rotate(0)); slideToggle expands/collapses L3 ul. .stop() (no clearQueue,
    // no jumpToEnd) lets rapid taps queue smoothly without flicker. CSS only sets
    // default display:none; slide takes over from there.
    jQuery('nav .menu-list').off('click.ona-nav-l2', '.site-nav__child-link--parent');
    jQuery('nav .menu-list').on('click.ona-nav-l2', '.site-nav__child-link--parent', function (e) {
        if (!navIsMobile()) return;
        e.preventDefault();
        e.stopPropagation();
        var $li = jQuery(this).closest('.site-nav__childlist-item');
        var $ul = $li.children('ul');
        if (!$ul.length) return;
        $li.toggleClass('is-open');
        $ul.stop().slideToggle(300);
    });

    // Drop the legacy .icon-arrow-smaller click handler from the earlier
    // icon-driven revision (its Android tap propagation also blocked <a>).
    jQuery('nav .menu-list').off('click.ona-nav-icon', '.icon-arrow-smaller');

    // Resize cleanup: slideToggle leaves inline `display:block/none` on the L3 <ul>.
    // When the viewport crosses into desktop, that inline style overrides the PC
    // hover-to-show behavior. Clear inline display + .is-open on every transition
    // out of mobile.
    var wasMobile = navIsMobile();
    jQuery(window).off('resize.ona-nav-l3-cleanup').on('resize.ona-nav-l3-cleanup', function () {
        var nowMobile = navIsMobile();
        if (wasMobile && !nowMobile) {
            jQuery('nav .menu-list .site-nav__childlist-item > ul').stop(true, true).css('display', '');
            jQuery('nav .menu-list .site-nav__childlist-item.is-open').removeClass('is-open');
        }
        wasMobile = nowMobile;
    });

    // Close when clicking outside any has-dropdown or pressing Esc.
    jQuery(document).off('click.ona-nav-close').on('click.ona-nav-close', function (e) {
        if (jQuery(e.target).closest('.site-nav--has-dropdown').length) return;
        jQuery('nav .menu-list .site-nav--has-dropdown').removeClass('is-open thisHover');
        jQuery('.header-right').removeClass('hover');
    });
    jQuery(document).off('keydown.ona-nav-close').on('keydown.ona-nav-close', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            jQuery('nav .menu-list .site-nav--has-dropdown').removeClass('is-open thisHover');
            jQuery('.header-right').removeClass('hover');
        }
    });
}
// ONA DEV (2026-04-23): Desktop (>=992px) aligns dropdown's left edge to .header-right's left edge.
// dropdown is position:absolute relative to the initial containing block (no positioned
// ancestor in the header chain), so .header-right.getBoundingClientRect().left is the px
// value to write into the --ona-dropdown-left CSS var; <992px clears the var and falls
// back to the per-breakpoint percentages in main.css. Pairs with main.css L1571+:
// left: var(--ona-dropdown-left, N%).
function syncOnaDropdown() {
    var MQ_DESKTOP = 992;
    function apply() {
        try {
            var root = document.documentElement;
            var hr = document.querySelector('.header-right');
            if (!hr || window.innerWidth < MQ_DESKTOP) {
                root.style.removeProperty('--ona-dropdown-left');
                return;
            }
            root.style.setProperty('--ona-dropdown-left', hr.getBoundingClientRect().left + 'px');
        } catch (e) { /* non-fatal */ }
    }
    apply();
    jQuery(window).off('resize.ona-dropdown').on('resize.ona-dropdown', apply);
    document.removeEventListener('shopify:section:load', apply);
    document.addEventListener('shopify:section:load', apply);
}
function navscroll() {
    // Single source of truth for applying/removing the sticky class. Previously
    // only wired to window.scroll — when Shopify editor replaced <header> via
    // shopify:section:load, the new element had no sticky class until the user
    // scrolled, producing "sticky sometimes fails" after a section edit or
    // Horizon Web Components finishing async hydration.
    function apply() {
        // Horizon's header.js uses document.scrollingElement.scrollTop for the
        // same computation — follow suit. jQuery(window).scrollTop() returns
        // the same value but scroll *events* on Horizon pages fire on `document`
        // (not `window`), so we need the document listener below to react.
        var scrollTop = (document.scrollingElement || document.documentElement).scrollTop;
        if (scrollTop >= 30) {
            jQuery('header').addClass('smaller-header');
        } else {
            jQuery('header').removeClass('smaller-header');
        }
    }
    apply();
    // Bind on BOTH window (legacy live theme behaviour) AND document (Horizon).
    // Horizon's layout chain — body { display:flex }, html[scroll-lock] overflow
    // management, and Web Component lifecycle — means scroll events don't always
    // bubble to window. Symptom was: jQuery(window).scrollTop() returns the right
    // value, but jQuery(window).on('scroll', ...) never fires → sticky never
    // triggers. document-level scroll always fires (it's the capture target).
    jQuery(window).off('scroll.navscroll').on('scroll.navscroll', apply);
    document.removeEventListener('scroll', apply);
    document.addEventListener('scroll', apply, { passive: true });
    // Re-apply on every Horizon section (re)render so a freshly-injected
    // <header> inherits the current scroll state.
    document.removeEventListener('shopify:section:load', apply);
    document.addEventListener('shopify:section:load', apply);
}
function getScrollbarWidth() {
    var odiv = document.createElement('div'),
        styles = {
            width: '100px',
            height: '100px',
            overflowY: 'scroll'
        },
        i, scrollbarWidth;
    for(i in styles) odiv.style[i] = styles[i];
    document.body.appendChild(odiv);
    scrollbarWidth = odiv.offsetWidth - odiv.clientWidth;
    jQuery(odiv).remove();
    return scrollbarWidth;
}
// R44 / Phase A2: legacy scroll-based wowo() removed. window.wowo now points to the
// IntersectionObserver init defined at the top of this file (see L1 IIFE).
function slider(){
    // Re-stub current window.jQuery before any .slick() below. slider() is
    // called from L1453 ready (initial) + L1490 resize handler; a third-party
    // app can swap window.jQuery between ready and resize, so ready-time
    // re-stub on the captured param jQuery doesn't reach the new instance.
    onaEnsureJqStubs();
    // Previously hid every .slick-dots whose <li> count was <=1 at T+10ms.
    // That races slick init: empty <ul class="slick-dots"> containers (populated
    // later by slick) got display:none and never recovered — symptom: dots
    // disappear on mobile / some sliders. Now only hide a dots container if it
    // was actually populated with <=1 real dot AFTER slick finished its init.
    setTimeout(function () {
        jQuery('.slick-dots').each(function () {
            var $ul = jQuery(this);
            var $slider = $ul.closest('.slick-initialized');
            if (!$slider.length) return;
            if ($ul.children('li').length <= 1) {
                $ul.css('display', 'none');
            }
        });
    }, 800);

  if(jQuery(document.body).find('.wholesale-brands .brand-thumb .brand-item').length > 0){
         if(window.innerWidth > 575) {
           jQuery('.wholesale-brands .brand-thumb').slick({
            slidesToShow: 5,
            slidesToScroll: 1,
            autoplay: false,
            autoplaySpeed: 2000,
            infinite: false,
            arrows: false,
            focusOnSelect: true,
            responsive: [
                {
                    breakpoint: 991.9,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 767.9,
                    settings: {
                        slidesToShow: 2,
                    }
                },
                {
                    breakpoint: 575.9,
                    settings: {
                        slidesToShow: 1,
                        arrows: true,
                    }
                }
            ]
          });
         }
    
  }
	
	
if(jQuery(document.body).find('.mobile-shop-slider').length > 0){	
	jQuery('.mobile-shop-slider').slick({
		slidesToShow: 4,
		slidesToScroll: 1,
		autoplay: false,
		autoplaySpeed: 2000,
		infinite: false,
		arrows: false,
		focusOnSelect: true,
		responsive: [
			{
				breakpoint: 991.9,
				settings: {
					slidesToShow: 3,
				}
			},
			{
				breakpoint: 767.9,
				settings: {
					slidesToShow: 2,
				}
			},
			{
				breakpoint: 575.9,
				settings: {
					slidesToShow: 1,
					arrows: true,
				}
			}
		]
    });
}
    jQuery('.add-images-slider').slick({
		slidesToShow: 3,
		slidesToScroll: 1,
		autoplay: true,
		autoplaySpeed: 2000,
		infinite: true,
		arrows: false,
		dots:true,
		focusOnSelect: true,
		autoplaySpeed: 8000,
		responsive: [
			{
				breakpoint: 992.9,
				settings: {
					slidesToShow: 1,
				}
			},
            {
					breakpoint: 1200.1,
					settings: {
						slidesToShow: 2,
				
					}
			},
			
		]
    });
    jQuery(".add-faqs .block .faqs-title").click(function(event){
			event.stopPropagation();
			jQuery(this).toggleClass("is-active");

			jQuery(this).siblings(".faqs-text").slideToggle(200);
			
			jQuery(this).parents(".block").siblings().find(".faqs-title").removeClass("is-active");

			jQuery(this).parents(".block").siblings().find(".faqs-text").slideUp(200);
			
		
		});

  

   
   if(jQuery(document.body).find('.imgs-slider-unique').length >  0){
     
      jQuery('.imgs-slider-unique').slick({
		slidesToShow: 1,
		slidesToScroll: 1,
		autoplay: false,
		autoplaySpeed: 2000,
		infinite: false,
		arrows: false,
		dots:false,
		focusOnSelect: true,
        centerMode: false,
        fade: true,        
        cssEase: 'ease-in-out',
        adaptiveHeight: true,
    });   

     
     jQuery('.unique-coffee-block .slider-handle').click(function(e){
       e.preventDefault();
       var index = jQuery(this).data('item');      
       $('.imgs-slider-unique').slick('slickGoTo', index);       
     });  
   }

  if(jQuery(document.body).find('.imgs-slider').length >  0){
    jQuery('.imgs-slider').each(function(){
      var _auto = jQuery(this).attr('data-auto');
      var auto_scroll = true;
      if(typeof _auto != 'undefined' && _auto == 'false')
          auto_scroll = false;      
      jQuery(this).slick({
    		slidesToShow: 1,
    		slidesToScroll: 1,
    		autoplay: auto_scroll,
    		autoplaySpeed: 5000, 
    		infinite: true,
    		arrows: false,
    		dots:true,
    		focusOnSelect: true,
    
        }); 
      $(this).on('beforeChange', function(event, slick, currentSlide, nextSlide){
          var slick_id = '#'+slick.$slider[0]['attributes']['id']['value'];                    
          //var dataId = $(slick.$slides[currentSlide]).data('index');  
          var current = $(slick_id).find('.slider-block[data-slick-index=' + currentSlide + ']');
          var next_item = $(slick_id).find('.slider-block[data-slick-index=' + nextSlide + ']'); 
          if(current.find('.scale-video').length > 0 && current.find('.scale-video').hasClass('video-playing')){
            var _video = current.find('a.play-video').attr('data-id');            
            var _type = current.find('a.play-video').attr('data-type');  
            var source = next_item.find('a.play-video').attr('data-url');           
            if(typeof(source) != 'undefined' && source.indexOf('vimeo') > -1)
                _type = 'vimeo';            
            // R71/P0.4 cleanup: console.log("VIDEO CHANGE HERE")
            stopCurrentVideo(_video,_type);
            
          }
          if(next_item.find('.scale-video').length > 0){
            var _video = next_item.find('a.play-video').attr('data-id');            
            var _type = next_item.find('a.play-video').attr('data-type');            
            var source = next_item.find('a.play-video').attr('data-url');
            if(typeof(source) != 'undefined' && source.indexOf('vimeo') > -1)
                _type = 'vimeo';
            play_video_element(_video,_type,source);
          }
      });
    });
  } 

  if(jQuery(document.body).find('.imgs-slider-testimonial').length >  0){
    jQuery('.imgs-slider-testimonial').each(function(){
      var _auto = jQuery(this).attr('data-auto');
      var auto_scroll = true;
      if(typeof _auto != 'undefined' && _auto == 'false')
          auto_scroll = false;      
      jQuery(this).slick({
    		slidesToShow: 1,
    		slidesToScroll: 1,
    		autoplay: false,
    		infinite: true,
    		arrows: false,
    		dots:false,
    		focusOnSelect: true,
            draggable: false,
    
        }); 
      $(this).on('beforeChange', function(event, slick, currentSlide, nextSlide){
          var slick_id = '#'+slick.$slider[0]['attributes']['id']['value'];                    
          //var dataId = $(slick.$slides[currentSlide]).data('index');  
          var current = $(slick_id).find('.slider-block[data-slick-index=' + currentSlide + ']');
          var next_item = $(slick_id).find('.slider-block[data-slick-index=' + nextSlide + ']'); 
          if(current.find('.scale-video').length > 0 && current.find('.scale-video').hasClass('video-playing')){
            var _video = current.find('a.play-video').attr('data-id');            
            var _type = current.find('a.play-video').attr('data-type');  
            var source = next_item.find('a.play-video').attr('data-url');           
            if(typeof(source) != 'undefined' && source.indexOf('vimeo') > -1)
                _type = 'embed';            
            stopCurrentVideo(_video,_type);
          }
          if(next_item.find('.scale-video').length > 0){
            var _video = next_item.find('a.play-video').attr('data-id');            
            var _type = next_item.find('a.play-video').attr('data-type');            
            var source = next_item.find('a.play-video').attr('data-url');
            if(typeof(source) != 'undefined' && source.indexOf('vimeo') > -1)
                _type = 'embed';
            play_video_element(_video,_type,source);
          }
      });
    });
  }
 
    
    jQuery('.col-4-icons .content .block .box').click(function (e) {
			e.preventDefault();
			var href = jQuery(this).attr("href"); 
        	var target = href.split("#")[1];
			jQuery("section").each(function(){
				var this_c=jQuery(this);
				var this_data=jQuery(this).attr("id");
				if(this_data == target){
					jQuery('html,body').stop().animate({scrollTop:this_c.offset().top - 130},600);
				}
			});

	    });
	if (jQuery('.add-new-15-years-slider').length > 0) {
		jQuery('.add-new-15-years-slider').slick({
			dots: false,
			arrows: true,
			infinite: false,
			fade: false,
			speed: 800,
			slidesToShow: 15,
			slidesToScroll: 1,
			autoplay: false,
			pauseOnHover: false,
			autoplaySpeed: 6000,
			draggable:true,
			//variableWidth: true,

			responsive: [
				{
					breakpoint: 1200.1,
					settings: {
						slidesToShow: 10,
				
					}
				},
				{
					breakpoint: 768.1,
					settings: {
						slidesToShow: 5,
                        centerMode:true,
              			centerPadding: '0px',
						
					}
				},
				{
					breakpoint: 556.1,
					settings: {
						slidesToShow: 3,
                        centerMode:true,
            			centerPadding: '0px',
					}
				},
			]
		});
		jQuery('.add-new-15-years-text-slider').slick({
			dots: false,
			arrows: false,
			infinite: false,
			fade: true,
			speed: 800,
			slidesToShow: 1,
			slidesToScroll: 1,
			autoplay: false,
			pauseOnHover: false,
			autoplaySpeed: 6000,
			draggable:true,
			adaptiveHeight:true,
		});
		
	}
	jQuery(".add-new-15-years .content .slider-block").click(function(){
		jQuery(this).addClass('is-active');
		jQuery(this).siblings().removeClass('is-active');
		var index_c=jQuery(this).index();
		jQuery('.add-new-15-years-text-slider').slick('slickGoTo',index_c);
		jQuery('.add-new-15-years .content-two .logo-15').addClass('is-hide');
		setTimeout(function(){
		jQuery('.add-new-15-years .content-two-box').addClass('is-show');
		},400);
	});
	jQuery('.add-new-15-years-slider').on('beforeChange', function(event, slick, currentSlide, nextSlide) {
		jQuery(".add-new-15-years-slider .slider-block").removeClass('span-is-show');
		jQuery(".add-new-15-years-slider .slider-block").eq(nextSlide - 2).addClass('span-is-show');
		
	});
	var width_window=window.innerWidth;
	if (width_window < 1200.5 & width_window > 768.5) {
		jQuery('.add-new-15-years-slider').slick('slickGoTo', 8);
	}
	if (window.innerWidth < 768.5) {
		jQuery('.add-new-15-years-slider').slick('slickGoTo', 8);
		jQuery(".add-new-15-years .content .slider-block").click(function(){
	
			var index_c=jQuery(this).index();
			jQuery('.add-new-15-years-slider').slick('slickGoTo',index_c);
		});
		jQuery(".add-new-15-years .slick-arrow").click(function(){
			jQuery('.add-new-15-years .content-two .logo-15').addClass('is-hide');
			setTimeout(function(){
			jQuery('.add-new-15-years .content-two-box').addClass('is-show');
			},400);
			
			
			
			var ss=jQuery(".add-new-15-years .slick-current").index();
			jQuery(".add-new-15-years-slider .slider-block").eq(ss).addClass('is-active');
			jQuery(".add-new-15-years-slider .slider-block").eq(ss).siblings().removeClass('is-active');
			
			jQuery('.add-new-15-years-text-slider').slick('slickGoTo',ss);
			
			if(ss == 1){
				jQuery(".add-new-15-years-slider .slider-block").eq(0).addClass('first-child');
			}else{
				jQuery(".add-new-15-years-slider .slider-block").eq(0).removeClass('first-child');
			}
			//first-child
		});
        jQuery('.add-new-15-years-slider').on('beforeChange', function(event, slick, currentSlide, nextSlide) {
			jQuery(".add-new-15-years-slider .slider-block").removeClass('is-active');
			jQuery(".add-new-15-years-slider .slider-block").eq(nextSlide).addClass('is-active');
		});
//		setTimeout(function(){
//			jQuery('.add-new-15-years-slider').on('beforeChange', function(event, slick, currentSlide, nextSlide) {
//				jQuery('.add-new-15-years-text-slider').slick('slickGoTo',nextSlide);
//				jQuery(".add-new-15-years .content .slider-block").removeClass('is-active');
//				jQuery(".add-new-15-years .content .slider-block").eq(nextSlide).addClass('is-active');
//			});
//		},1000);
		
	}
	
	
    // banner-top-slider init moved to sections/ona-banner-slider.liquid {% javascript %} block
    // to support theme-editor section reloads and avoid duplicate arrow appends.

   if(jQuery(document.body).find('.sustainability-top .product-slider').length > 0){	
      jQuery('.sustainability-top .product-slider:not(".slick-initialized")').slick({
          centerMode: false,
          variableWidth: true,
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: true,
          dots: false,
          fade: false,
          speed: 800,
          infinite: true,
          // autoplay: true,
          autoplaySpeed: 5000,
          focusOnSelect: false,
          responsive: [
              {
                  breakpoint: 991.98,
                  settings: {
                      variableWidth: false,
                      slidesToShow: 1,
                  }
              },
              {
                  breakpoint: 767.98,
                  settings: {
                      variableWidth: false,
                      slidesToShow: 2,
                  }
              },
              {
                  breakpoint: 575.98,
                  settings: {
                      variableWidth: false,
                      slidesToShow: 1,
                  }
              }
          ]
      });
   }

  if(jQuery(document.body).find('.product-slider').length > 0){	
      jQuery('.product-slider:not(".slick-initialized")').slick({
          centerMode: false,
          variableWidth: true,
          slidesToShow: 1,
          slidesToScroll: 1,
          arrows: true,
          dots: false,
          fade: false,
          speed: 800,
          infinite: true,
          centerMode: true,
          centerPadding: '0',
          autoplay: false,
          autoplaySpeed: 5000,
          focusOnSelect: false,
  		pauseOnHover:false,
          responsive: [
              {
                  breakpoint: 991.98,
                  settings: {
                      variableWidth: false,
                      slidesToShow: 1,
                  }
              },
              {
                  breakpoint: 575.98,
                  settings: {
                      variableWidth: false,
                      slidesToShow: 1,
                  }
              }
          ]
      });
  }
  if(jQuery(document.body).find('.shop-list-slider').length > 0){		
    jQuery('.shop-list-slider:not(".slick-initialized")').slick({
        slidesToShow: 4,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 2000,
        infinite: false,
        arrows: false,
        focusOnSelect: true,
        responsive: [
            {
                breakpoint: 991.9,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 767.9,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 575.9,
                settings: {
                    slidesToShow: 1,
                    arrows: true,
                }
            }
        ]
    });
  }
if(jQuery(document.body).find('.location-slider').length > 0){	
    jQuery('.location-slider:not(".slick-initialized")').slick({
        centerMode: true,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 2000,
        infinite: true,
        arrows: false,
        focusOnSelect: true
    });
}

  
	
if(jQuery(document.body).find('.store-photo-mobile-slider').length > 0){		
    jQuery('.store-photo-mobile-slider').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 2000,
        infinite: true,
        arrows: true,
        focusOnSelect: true,
    });
    jQuery('.locations-content .left-box .locations-list h2').on('click', function () {
        var sw = document.body.scrollWidth;
        var scrollBar = getScrollbarWidth();
        if(sw + scrollBar < 768){
            if(!jQuery(this).hasClass('active')){
                setTimeout(function() {
                    jQuery('html,body').stop().animate({scrollTop:me.offset().top - 95},500);
                }, 210);
            }
            var me = jQuery(this).parents('.locations-list');
            jQuery(this).toggleClass('active').parents('.locations-list').siblings().find('h2').removeClass('active');
            jQuery(this).siblings('.list-item').slideToggle(200);
            jQuery(this).parents('.locations-list').siblings().children('.list-item').slideUp(200);
            
            
            jQuery('.store-photo-mobile-slider').slick('refresh');
            // jQuery(this).siblings('.list-item').find('.store-photo-mobile-slider').slick({
            // 	slidesToShow: 1,
            // 	slidesToScroll: 1,
            // 	autoplay: false,
            // 	autoplaySpeed: 2000,
            // 	infinite: true,
            // 	arrows: true,
            // 	focusOnSelect: true,
            // });
            // jQuery(this).parents('.locations-list').siblings().children('.list-item').find('.slick-slider').slick('unslick');

        }
    });
}
  // R71/P0.4 cleanup: console.log("Loading slider here");
  if(jQuery(document.body).find('.store-photo-slider').length > 0){	
		jQuery('.store-photo-slider').slick({
			slidesToShow: 3,
			centerMode:true,
			slidesToScroll: 1,
			autoplay: false,
			autoplaySpeed: 2000,
			infinite: true,
			arrows: true,
			focusOnSelect: true,
		});
				
        jQuery('.locations-content .locations-list').on('click', function () {
			var index = jQuery(this).index();
			if(!jQuery(this).hasClass('active')){
				jQuery(this).siblings().removeClass('active');
				jQuery(this).addClass('active');
				jQuery('.locations-content-image .slider-list').eq(index).siblings().hide();
				jQuery('.locations-content-image .slider-list').eq(index).fadeIn();
				jQuery('.store-photo-slider').slick('refresh');
				// jQuery('.locations-content-image .slider-list').eq(index).siblings().find('.slick-slider').slick('unslick');
				// jQuery('.locations-content-image .slider-list').eq(index).find('.store-photo-slider').slick({
				// 	slidesToShow: 3,
				// 	centerMode:true,
				// 	slidesToScroll: 1,
				// 	autoplay: false,
				// 	autoplaySpeed: 2000,
				// 	infinite: true,
				// 	arrows: true,
				// 	focusOnSelect: true,
				// });
				
				jQuery('.locations-content-text .tab-content').eq(index).siblings().hide();
				jQuery('.locations-content-text .tab-content').eq(index).fadeIn();
			}
        })
  }
if(jQuery(document.body).find('.wholesale-slider').length > 0){		
	jQuery('.wholesale-slider').slick({
	    slidesToShow: 1,
	    slidesToScroll: 1,
	    autoplay: false,
	    autoplaySpeed: 2000,
	    infinite: true,
	    arrows: true,
	    dots: false,
	});
}
if(jQuery(document.body).find('.image-slider').length > 0){		  
    jQuery('.image-slider:not(".slick-initialized")').slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 5000,
        infinite: true,
        arrows: true,
        dots: true,
        focusOnSelect: true
    });
    
}

  if(jQuery('.product-detail-slider').length>0){
        jQuery('.slider-for').on('init', function(slick) {
          jQuery('.slider-for').addClass('show');
          jQuery('.slider-nav').addClass('show');
        });
        jQuery('.slider-for:not(".slick-initialized")').slick({
            slidesToShow: 1,
            slidesToScroll: 1,
            arrows: false,
            fade: true,
            draggable: false,
            asNavFor: '.slider-nav'
        });
        jQuery('.slider-nav:not(".slick-initialized")').slick({
            slidesToShow: 5,
            slidesToScroll: 1,
            asNavFor: '.slider-for',
            arrows: false,
            dots: false,
            centerMode: false,
            focusOnSelect: true,
            centerPadding: '0',
            // verticalSwiping: true,
            // vertical: true,
        });
    }
}
function video(){
    jQuery(".video-link.mp4").click(function(event){
        event.preventDefault();
        jQuery(document).bind("mousewheel DOMMouseScroll",function(event){event.preventDefault()});
        jQuery(document).bind("touchmove",function(event){event.preventDefault()});
        var video_url = jQuery(this).find('.data-video').html();
        jQuery('.video-light-box').find('.play-iframe-video').append('<video controls="controls" autoplay="autoplay"><source src="'+video_url+'" type="video/mp4"></video>');
        jQuery('.video-light-box').fadeIn(300);
    });
    jQuery(".video-link.file").click(function(event){
        event.preventDefault();
        jQuery(document).bind("mousewheel DOMMouseScroll",function(event){event.preventDefault()});
        jQuery(document).bind("touchmove",function(event){event.preventDefault()});
        var video_url = jQuery(this).find('.data-video').html();
        jQuery('.video-light-box').find('.play-iframe-video').append('<video controls="controls" autoplay="autoplay"><source src="'+video_url+'" type="video/mp4"></video>');
        jQuery('.video-light-box').fadeIn(300);
    });
    jQuery(".video-link.embed").click(function(event){
        event.preventDefault();
        jQuery(document).bind("mousewheel DOMMouseScroll",function(event){event.preventDefault()});
        jQuery(document).bind("touchmove",function(event){event.preventDefault()});
        jQuery('.video-light-box').fadeIn(300);
        var html = jQuery(this).find('.data-video').html();
        jQuery('.video-light-box').find('.play-iframe-video').html(html);
    });
    jQuery('.video-light-box .close').click(function(){
        jQuery(document).unbind("mousewheel DOMMouseScroll");
        jQuery(document).unbind("touchmove");
        jQuery('.video-light-box').fadeOut(300);
        setTimeout(function(){
            jQuery('.video-light-box').find('.play-iframe-video').html('');
        },300);
    });
    jQuery('.video-light-box').click(function(){
        jQuery(document).unbind("mousewheel DOMMouseScroll");
        jQuery(document).unbind("touchmove");
        jQuery('.video-light-box').fadeOut(300);
        setTimeout(function(){
            jQuery('.video-light-box').find('.play-iframe-video').html('');
        },300);
    });
    jQuery('.video-light-box .video-box').click(function(event){
        event.stopPropagation();
    });
}
function accordion(){
    if(jQuery(".accordion").length > 0) {
        /* R61: widen mutex scope from siblings()-only (R58) to nearest grouping
           ancestor when present. R58 fix kept items inside ONE .accordion container
           mutually exclusive but FAQ page wraps each category in its own .accordion
           (see blocks/_faq-category.liquid:5) → cross-category items never closed.
           Resolution: if click target is inside .faq or .accordiondiv, scope mutex
           to that wrapper (closes ALL accordion-list across categories on the FAQ
           page or product accordion). Otherwise fall back to R58 sibling-only
           behavior so unrelated accordions in other sections stay untouched. */
        jQuery(".accordion .accordion-title")
          .off('click.onaAccordion')
          .on('click.onaAccordion', function(e) {
            e.preventDefault();
            var me = jQuery(this),
                parent = me.parents(".accordion-list"),
                wasActive = parent.hasClass("is-active"),
                $scope = parent.closest(".faq, .accordiondiv"),
                $others = $scope.length
                    ? $scope.find(".accordion-list").not(parent)
                    : parent.siblings(".accordion-list");
            $others
              .removeClass("is-active")
              .find(".accordion-content").stop(true, true).slideUp();
            if (!wasActive) {
                parent.addClass("is-active");
                me.next(".accordion-content").stop(true, true).slideDown();
            } else {
                parent.removeClass("is-active");
                me.next(".accordion-content").stop(true, true).slideUp();
            }
            setTimeout(function() {
                jQuery('html,body').stop().animate({scrollTop:me.offset().top - 95},500);
            }, 400);
        });
        jQuery(".faq .right-box .shopify-section:nth-child(1) .accordion .accordion-list").eq(0).addClass("is-active");
        jQuery(".faq .right-box .shopify-section:nth-child(1) .accordion .accordion-list:nth-child(1) .accordion-content").css('display','block');
    }
}
function shopHeight(){
    var heightA = [];
    var heightA2 = [];
    jQuery('.shop-list .list').each(function () {
        heightA.push(jQuery(this).find('.img img').innerHeight());
    });
    jQuery('.shop-list-slider .list').each(function () {
        heightA2.push(jQuery(this).find('.img img').innerHeight());
    });
    var maxH = Math.max(...heightA);
    var maxH2 = Math.max(...heightA2);
    jQuery('.shop-list .list .img').css('min-height', maxH);
    jQuery('.shop-list-slider .list .img').css('min-height', maxH2);
}
function shopNumber(){
    //product +-
    jQuery('body').on('click', '.product-form__controls-group .minus', function (e) {
        e.preventDefault();
        var val = Number(jQuery(this).siblings('input[type="number"]').val());
        if(val <= 1){

        }else {
            var valEnd = val -= 1;
            jQuery(this).siblings('input[type="number"]').val(valEnd);
        }
    })
    jQuery('body').on('click', '.product-form__controls-group .plus', function (e) {
        e.preventDefault();
        var val = Number(jQuery(this).siblings('input[type="number"]').val());
        var valEnd = val += 1;
        jQuery(this).siblings('input[type="number"]').val(valEnd);
    });
    //cart +-
    jQuery('body.template-cart').on('click', '.cart .cart__row .minus', function (e) {
        e.preventDefault();
        var val = Number(jQuery(this).siblings('input[type="number"]').val());
        if(val <= 1){
            jQuery('.cart .cart__footer .btn--loader').trigger('click');
        }else {
            var valEnd = val -= 1;
            jQuery(this).siblings('input[type="number"]').val(valEnd);
            jQuery('.cart .cart__footer .btn--loader').trigger('click');
        }
    })
    jQuery('body.template-cart').on('click', '.cart .cart__row .plus', function (e) {
        e.preventDefault();
        var val = Number(jQuery(this).siblings('input[type="number"]').val());
        var valEnd = val += 1;
        jQuery(this).siblings('input[type="number"]').val(valEnd);
        jQuery('.cart .cart__footer .btn--loader').trigger('click');
    });
}
function form(){
    jQuery('.pop-up-form form .globo-form-control ul li .checkbox-label').on('click', function () {
        jQuery(this).siblings('input[type="checkbox"]').trigger('click');
    });
}
function popUp(){

	var cookie_t = jQuery('header .toolbar').html();
	var modal_t = jQuery.cookie('open-modal-form');
	if (modal_t != cookie_t) {
		jQuery('.toolbar').hide().slideDown();
	}
	jQuery('header .toolbar .close-btn').click(function(event) {
		event.preventDefault();
		jQuery.cookie('open-modal-form', cookie_t, { expires: 30, path: '/' });
		jQuery('.toolbar').slideUp();
	});
	
	
		
    jQuery('.wholesale-form-btn').on('click', function (e) {
        e.preventDefault();
        jQuery('.wholesale-form').fadeIn(300);
        jQuery('.wholesale-form').addClass('up');
        // if(jQuery('.wholesale-form form .content .form-submit').length>0){

        // }else{
        //     jQuery('.wholesale-form form .block-container').append('<div class="form-submit"><input type="submit" value="SEND"></div>');
        //     jQuery('body').on('click', '.wholesale-form form .block-container .form-submit input', function () {
        //         jQuery('.footer button').trigger('click');
        //     })
        // }
        jQuery('.pop-up-form .pop-up-form-close').on('click', function (e) {
            e.preventDefault();
            jQuery('.pop-up-form').fadeOut(300);
            jQuery('.wholesale-form').removeClass('up');
            jQuery('.wholesale-roaster-form').removeClass('up');
        })
        jQuery('.pop-up-form form .message').on('click', function () {
            jQuery(this).fadeOut(300);
        });
        /* var email1 = ['','matthewlewin@onacoffee.com.au','matthewlewin@onacoffee.com.au','matthewlewin@onacoffee.com.au','matthewlewin@onacoffee.com.au','rhys@onacoffee.com.au','rhys@onacoffee.com.au','matthewlewin@onacoffee.com.au','matthewlewin@onacoffee.com.au','hester@onacoffee.com.au'];
        jQuery('.wholesale-form form .globo-form-control select.classic-input').change(function () {
            var index = jQuery('option:selected', '.wholesale-form form .globo-form-control select.classic-input').index();
            var val = email1[index];
            jQuery('.wholesale-form form .block-container .globo-form-control').eq(0).find('input').val(val);
          
        }); */
    })
    jQuery('.wholesale-roaster-form-btn').on('click', function (e) {
        e.preventDefault();
        jQuery('.wholesale-roaster-form').fadeIn(300);
        jQuery('.wholesale-roaster-form').addClass('up');
        // if(jQuery('.wholesale-roaster-form form .block-container .form-submit').length>0){

        // }else{
        //     jQuery('.wholesale-roaster-form form .block-container').append('<div class="form-submit"><input type="submit" value="SEND"></div>');
        //     jQuery('body').on('click', '.wholesale-roaster-for form .content .form-submit input', function () {
        //         jQuery('.footer button').trigger('click');
        //     })
        // }
        jQuery('.pop-up-form .pop-up-form-close').on('click', function (e) {
            e.preventDefault();
            jQuery('.pop-up-form').fadeOut(300);
            jQuery('.wholesale-form').removeClass('up');
            jQuery('.wholesale-roaster-form').removeClass('up');
            jQuery('.pop-up-form form .message').fadeOut(300);
        })
        jQuery('.pop-up-form form .message').on('click', function () {
            jQuery(this).fadeOut(300);
        })
        /* var email2 = ['','hany@onacoffee.com.au','hany@onacoffee.com.au'];
        jQuery('.wholesale-roaster-form form .globo-form-control select.classic-input').change(function () {
            var index = jQuery('option:selected', '.wholesale-roaster-form form .globo-form-control select.classic-input').index();
            var val = email2[index];
            jQuery('.wholesale-roaster-form form .block-container .globo-form-control').eq(0).find('input').val(val);
        }); */
    })
	
	var email3 = ['','admin@onacoffee.com.au','marketing@onacoffee.com.au'];
	jQuery("body").on("change",".get-in-touch select.classic-input",function(){
		var index = jQuery('option:selected', '.get-in-touch form .globo-form-control select.classic-input').index();
		for(var i=0;i<email3.length;i++){
			var val = email3[index];
			jQuery('.get-in-touch form .block-container .globo-form-control:nth-child(1)').children('input').val(val);
		}
	});
	
	jQuery('body').on('click', function () {
	    jQuery('.get-in-touch form .message').fadeOut(300);
	});
	jQuery('body').on('click', function () {
	    jQuery('.training-form form .message').fadeOut(300);
	});
	
    jQuery('.pop-up-form').on('click', function () {
        jQuery('.pop-up-form').fadeOut(300);
        jQuery('.wholesale-form').removeClass('up');
        jQuery('.wholesale-roaster-form').removeClass('up');
        jQuery('.pop-up-form form .message').fadeOut(300);
    });
    jQuery('.pop-up-form .form-box .box').click(function(e){
        e.stopPropagation();
    });
}
function animated(){
    lines_0();
    lines_1();
    lines_2();
    lines_3();
    lines_4();
    lines_5();
    lines_6();
    lines_7();

    line_1();
    line_2();
    line_3();
    line_4();
    line_5();
    line_6();
    line_7();
    var nowTime = 0;
    var lastTime = Date.now();
    var diffTime = 12000;
    (function animloop() {
        nowTime = Date.now()
        if(nowTime-lastTime > diffTime){
            lastTime = nowTime
            lines_0();
            lines_1();
            lines_2();
            lines_3();
            lines_4();
            lines_5();
            lines_6();
            lines_7();

            line_1();
            line_2();
            line_3();
            line_4();
            line_5();
            line_6();
            line_7();
        }
        window.requestAnimationFrame(animloop);
    })();
    function lines_0() {
        jQuery('svg path.starts-0').each(function(){
            TweenMax.to(".starts-0", 5, {morphSVG:".mediums-0" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-0').each(function(){
                TweenMax.to(".starts-0", 5, {morphSVG:".ends-0" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-0').each(function(){
                    TweenMax.to(".starts-0", 5, {morphSVG:".starts-01" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_1() {
        jQuery('svg path.starts-1').each(function(){
            TweenMax.to(".starts-1", 5, {morphSVG:".mediums-1" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-1').each(function(){
                TweenMax.to(".starts-1", 5, {morphSVG:".ends-1" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-1').each(function(){
                    TweenMax.to(".starts-1", 5, {morphSVG:".starts-1" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_2() {
        jQuery('svg path.starts-2').each(function(){
            TweenMax.to(".starts-2", 5, {morphSVG:".mediums-2" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-2').each(function(){
                TweenMax.to(".starts-2", 5, {morphSVG:".ends-2" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-2').each(function(){
                    TweenMax.to(".starts-2", 5, {morphSVG:".starts-2" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_3() {
        jQuery('svg path.starts-3').each(function(){
            TweenMax.to(".starts-3", 5, {morphSVG:".mediums-3" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-3').each(function(){
                TweenMax.to(".starts-3", 5, {morphSVG:".ends-3" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-3').each(function(){
                    TweenMax.to(".starts-3", 5, {morphSVG:".starts-3" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_4() {
        jQuery('svg path.starts-4').each(function(){
            TweenMax.to(".starts-4", 5, {morphSVG:".mediums-4" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-4').each(function(){
                TweenMax.to(".starts-4", 5, {morphSVG:".ends-4" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-4').each(function(){
                    TweenMax.to(".starts-4", 5, {morphSVG:".starts-4" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_5() {
        jQuery('svg path.starts-5').each(function(){
            TweenMax.to(".starts-5", 5, {morphSVG:".mediums-5" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-5').each(function(){
                TweenMax.to(".starts-5", 5, {morphSVG:".ends-5" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-5').each(function(){
                    TweenMax.to(".starts-5", 5, {morphSVG:".starts-5" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_6() {
        jQuery('svg path.starts-6').each(function(){
            TweenMax.to(".starts-6", 5, {morphSVG:".mediums-6" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-6').each(function(){
                TweenMax.to(".starts-6", 5, {morphSVG:".ends-6" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-6').each(function(){
                    TweenMax.to(".starts-6", 5, {morphSVG:".starts-6" });
                });
            }, 4000);
        }, 4000);

    }
    function lines_7() {
        jQuery('svg path.starts-7').each(function(){
            TweenMax.to(".starts-7", 5, {morphSVG:".mediums-7" });
        });
        setTimeout(function () {
            jQuery('svg path.starts-7').each(function(){
                TweenMax.to(".starts-7", 5, {morphSVG:".ends-7" });
            });
            setTimeout(function () {
                jQuery('svg path.starts-7').each(function(){
                    TweenMax.to(".starts-7", 5, {morphSVG:".starts-7" });
                });
            }, 4000);
        }, 4000);

    }

    function line_1() {
        jQuery('svg path.start').each(function(){
            TweenMax.to(".start", 5, {morphSVG:".medium" });
        });
        setTimeout(function () {
            jQuery('svg path.start').each(function(){
                TweenMax.to(".start", 5, {morphSVG:".end" });
            });
            setTimeout(function () {
                jQuery('svg path.start').each(function(){
                    TweenMax.to(".start", 5, {morphSVG:".start" });
                });
            }, 4000);
        }, 4000);

    }
    function line_2() {
        jQuery('svg path.start-2').each(function(){
            TweenMax.to(".start-2", 5, {morphSVG:".medium-2" });
        });
        setTimeout(function () {
            jQuery('svg path.start-2').each(function(){
                TweenMax.to(".start-2", 5, {morphSVG:".end-2" });
            });
            setTimeout(function () {
                jQuery('svg path.start-2').each(function(){
                    TweenMax.to(".start-2", 5, {morphSVG:".start-2" });
                });
            }, 4000);
        }, 4000);

    }
    function line_3() {
        jQuery('svg path.start-3').each(function(){
            TweenMax.to(".start-3", 5, {morphSVG:".medium-3" });
        });
        setTimeout(function () {
            jQuery('svg path.start-3').each(function(){
                TweenMax.to(".start-3", 5, {morphSVG:".end-3" });
            });
            setTimeout(function () {
                jQuery('svg path.start-3').each(function(){
                    TweenMax.to(".start-3", 5, {morphSVG:".start-3" });
                });
            }, 4000);
        }, 4000);

    }
    function line_4() {
        jQuery('svg path.start-4').each(function(){
            TweenMax.to(".start-4", 5, {morphSVG:".medium-4" });
        });
        setTimeout(function () {
            jQuery('svg path.start-4').each(function(){
                TweenMax.to(".start-4", 5, {morphSVG:".end-4" });
            });
            setTimeout(function () {
                jQuery('svg path.start-4').each(function(){
                    TweenMax.to(".start-4", 5, {morphSVG:".start-4" });
                });
            }, 4000);
        }, 4000);

    }
    function line_5() {
        jQuery('svg path.start-5').each(function(){
            TweenMax.to(".start-5", 5, {morphSVG:".medium-5" });
        });
        setTimeout(function () {
            jQuery('svg path.start-5').each(function(){
                TweenMax.to(".start-5", 5, {morphSVG:".end-5" });
            });
            setTimeout(function () {
                jQuery('svg path.start-5').each(function(){
                    TweenMax.to(".start-5", 5, {morphSVG:".start-5" });
                });
            }, 4000);
        }, 4000);

    }
    function line_6() {
        jQuery('svg path.start-6').each(function(){
            TweenMax.to(".start-6", 5, {morphSVG:".medium-6" });
        });
        setTimeout(function () {
            jQuery('svg path.start-6').each(function(){
                TweenMax.to(".start-6", 5, {morphSVG:".end-6" });
            });
            setTimeout(function () {
                jQuery('svg path.start-6').each(function(){
                    TweenMax.to(".start-6", 5, {morphSVG:".start-6" });
                });
            }, 4000);
        }, 4000);

    }
    function line_7() {
        jQuery('svg path.start-7').each(function(){
            TweenMax.to(".start-7", 5, {morphSVG:".medium-7" });
        });
        setTimeout(function () {
            jQuery('svg path.start-7').each(function(){
                TweenMax.to(".start-7", 5, {morphSVG:".end-7" });
            });
            setTimeout(function () {
                jQuery('svg path.start-7').each(function(){
                    TweenMax.to(".start-7", 5, {morphSVG:".start-7" });
                });
            }, 4000);
        }, 4000);

    }
}
function preorderProduct() {
// 	jQuery('.product-form__cart-submit').click(function() {
// 	  var text = jQuery(this).text();
// 	  if(text=='Preorder Now'){
// 		console.log('popup!');
// 		jQuery('.preorder-tips-popup').addClass('show-popup');
// 	  }
// 	});
	jQuery('.preorder-tips-popup .close-btn').click(function(event) {
		event.stopPropagation();
		jQuery('.preorder-tips-popup').removeClass('show-popup');
	});
	jQuery('.preorder-tips-popup').click(function(event) {
		event.stopPropagation();
		jQuery('.preorder-tips-popup').removeClass('show-popup');
	});
	jQuery('.preorder-tips-popup .popup-box').click(function(event) {
		event.stopPropagation();
	});
	
}

function customCartRemove() {



  
  	jQuery('.custom-cart-remove-line').click(function() {
      	var item_id = jQuery(this).parents('.cart__row').attr('data-item-id');
        jQuery.ajax({
            url:'/cart/change.js',
            type: 'post',
            dataType: 'json',
            data: { quantity:0, id:item_id },
            success: function(msg) {
               location.reload();
            }
        });
	});
}

function productTab() {
	jQuery('.coffee-tab ul li button').click(function() {
		jQuery(this).parent().siblings().removeClass('active');
		jQuery(this).parent().addClass('active');
		var index = jQuery(this).parent().index();
		jQuery(this).parents('.coffee-tab').siblings('.coffee-tab-content').find('.coffee-table').hide();
		jQuery(this).parents('.coffee-tab').siblings('.coffee-tab-content').find('.coffee-table').eq(index).fadeIn();
	});
}
function productTabHeight() {
	var height = 0;
	jQuery('.coffee-table').css('min-height',0);
	jQuery('.coffee-table').each(function() {
		// R71/P0.4 cleanup: console.log(jQuery(this).innerHeight());
		if(jQuery(this).innerHeight()>height){
			height = jQuery(this).innerHeight();
		}
	});
	jQuery('.coffee-table').css('min-height',height);
}

function productGoToBrew() {
	jQuery('.profile .blogs-link').click(function() {
		var top = jQuery('section.guide').offset().top;
		var header_h = jQuery('header').innerHeight();
		jQuery('html,body').stop().animate({scrollTop:top-header_h},800);
	});
}

function newsFilter(){
    jQuery('body').on('click','.news-list-wrap .filter-select ul button',function(){
        var btnText = jQuery(this).text();
        var btnVal = jQuery(this).attr('data-tag');
        jQuery('.news-list-wrap .filter-select .current-value').text(btnText).attr('data-current-tag',btnVal);
        jQuery(this).parents('ul').fadeOut(300);
    })
    
    jQuery('body').on('click','.news-list-wrap .filter-select .current-value',function(e){
        jQuery(this).siblings('ul').fadeToggle(300);
        e.stopPropagation();
    })

    jQuery('body').on('click',function(){
        jQuery('.news-list-wrap .filter-select ul').fadeOut(300);
    })
}
function video_titleFilter(){

   /* if($(document.body).find('.filter-select').length > 0){
     var _btn = jQuery('.filter-select ul li.selected button');
     jQuery('.video_select_wrap .filter-select .current-value').text(_btn.text()).attr('data-current-tag',_btn.attr('data-tag'));
   } */
    jQuery('body').on('click','.video_select_wrap .filter-select ul button',function(){
      onaEnsureJqStubs();
      jQuery('.filter-select ul li.selected').removeClass('selected');
        var btnText = jQuery(this).text();
        var btnVal = jQuery(this).attr('data-tag');
        /* jQuery('.video_select_wrap .filter-select .current-value').text(btnText).attr('data-current-tag',btnVal); */
        jQuery(this).parents('ul').fadeOut(300);
        var slideClassarr = jQuery(this).data('tag');
        var slidClass = slideClassarr.split('_');
        jQuery('.imgs-slider-testimonial').slick('slickGoTo', parseInt(slidClass[1]) - 1);
        jQuery(this).parent().addClass('selected'); 
    })
    
    jQuery('body').on('click','.video_select_wrap .filter-select .current-value',function(e){
        jQuery(this).siblings('ul').fadeToggle(300);
        e.stopPropagation();
    })

    jQuery('body').on('click',function(){
        jQuery('.video_select_wrap .filter-select ul').fadeOut(300);
    })
}

jQuery(document).ready(function(jQuery) {
    // Ensure stubs on ready-time window.jQuery. slider() / video_titleFilter()
    // have their own entry-point ensure calls that catch later app swaps.
    onaEnsureJqStubs();
    // R44 fix: removed jQuery('html').addClass("show-c"). The legacy show-c
    // mechanism force-revealed all .wowo at jQuery ready while the R44
    // IntersectionObserver-driven .animated animation was still running,
    // causing a visible double-flash. CSS rules in main.css L238-251 are
    // also removed.
    jQuery('.w-webflow-badge').remove();
    // wowo();
    customCartRemove();
	preorderProduct();
    menuHamburger();
    syncOnaDropdown();
    getScrollbarWidth();
    slider();
    video();
    navscroll();
    accordion();
    shopHeight();
    shopNumber();
    form();
   popUp();
    animated();
	productTab();
	productTabHeight();
	productGoToBrew();
    newsFilter();
    video_titleFilter();

  jQuery(window).resize(function(e){
    if(window.innerWidth < 576) {
      if(jQuery('.wholesale-brands .brand-thumb').hasClass('slick-initialized')){
        jQuery('.wholesale-brands .brand-thumb').slick('unslick');
      }
    } else{
        if(!jQuery('.wholesale-brands .brand-thumb').hasClass('slick-initialized')){
          slider();
        }
    }
  });
  
  if(jQuery(document.body).find('.match-height').length > 0){
    $('.match-height').matchHeight({byRow: true,property: 'height'});
  }

  if(jQuery(document.body).find('.equal-height').length > 0){
    $('.equal-height').matchHeight({byRow: true,property: 'height'});
  }
  
  jQuery('.filter-form .ajax-filter-btn').click(function() {
    var tag = jQuery('.filter-form .current-value').attr('data-current-tag');
    if(tag == 'all'){
      var baseUrl = '/blogs/news?page=1';
      jQuery('.ajax-load-more-news-btn').attr('data-post-type','/blogs/news?page=');
    }else{
      var baseUrl = '/blogs/news/tagged/'+tag+'?page=1';
      jQuery('.ajax-load-more-news-btn').attr('data-post-type','/blogs/news/tagged/'+tag+'?page=');
    }
    // R71/P0.4 cleanup: console.log(baseUrl);
    jQuery('.ajax-load-more-news-btn').attr('data-current-page','1');
    jQuery('.news-list').addClass('loading');
    jQuery.ajax({
      url: baseUrl,
      type: 'GET',
      dataType: 'html',
      success: function(responseHTML){
        jQuery('.news-list').html(jQuery(responseHTML).find('.news-list').html());
        jQuery('.news-list').removeClass('loading');
        if(jQuery(responseHTML).find('.ajax-load-more-news-btn').length){
          var max = jQuery(responseHTML).find('.ajax-load-more-news-btn').attr('data-max-page');
        }else{
          var max = 1;
        }
        if(max<2){
          jQuery('.ajax-load-more-news-btn').hide();
        }else{
          jQuery('.ajax-load-more-news-btn').show();
        }
      },
      complete: function() {
      
      }
    });

    
  });


  
  jQuery('.ajax-load-more-news-btn').click(function() {
    var page = parseInt(jQuery(this).attr('data-current-page'))+1;
    var baseUrl = jQuery(this).attr('data-post-type')+page;
    jQuery(this).attr('data-current-page',page);
    jQuery(this).addClass('loading');
    var jQuerythis = jQuery(this);
    jQuery.ajax({
      url: baseUrl,
      type: 'GET',
      dataType: 'html',
      success: function(responseHTML){
        // R71/P0.4 cleanup: console.log(jQuery(responseHTML).find('.news-list').html());
        jQuerythis.removeClass('loading');
        var max = parseInt(jQuerythis.attr('data-max-page'));
        var afterpage =  parseInt(jQuerythis.attr('data-current-page'));
        jQuery('.news-list').append(jQuery(responseHTML).find('.news-list').html());
        if(afterpage>=max){
          jQuerythis.hide();
        }
      },
      complete: function() {
      
      }
    });
  });

  
    // setTimeout(function () {
    //     jQuery('form.product-form').show();
    // }, 3000);
	jQuery(".back-to-top").click(function(){
		jQuery('html,body').stop().animate({scrollTop:0},500);
	});
    jQuery(".form-group.country-input input").click(function(event){
        event.stopPropagation();
        jQuery(this).siblings(".typeahead__result").css("display","block");
        jQuery(this).parent(".form-group").siblings().children("ul").slideUp(300);
        jQuery(".overflow-c").mCustomScrollbar({
            axis:"y",
        });
    });
    jQuery(".form-group.country-input input").keyup(function(event){
        jQuery(".overflow-c").mCustomScrollbar({
            axis:"y",
        });
    });
    jQuery("body").click(function(event){
//         event.stopPropagation();
        jQuery(".typeahead__result").css("display","none");
        jQuery(".form-group.select-input ul").fadeOut(3);
    });




//jquery.typeahead
    var data=new Array();
    jQuery('.form-group.typeahead__container ul li').each(function(){
        var me=jQuery(this);
        data.push(me.text());
    })

    typeof jQuery.typeahead === 'function' && jQuery.typeahead({
        input: ".typeahead",
        minLength: 0,
        maxItem: 20,
        maxItemPerGroup: 20,
        order: "asc",
        searchOnFocus: true,

        source: {
            teams: {
                data: data
            }
        },
        emptyTemplate: 'No result for "{{query}}"',
        callback: {
            onClickAfter: function (node, a, item, event) {
                event.preventDefault();

                var txt=a.text();
                // node.parents('.screen').find('.names span').text(txt);
                // jQuery('.typeahead__cancel-button').trigger('click')
            },

        },
    });

    jQuery('.filters-footer .see-all').attr('target','_self');
    jQuery('.filters-content .list ul li a').click(function (e) {
        e.preventDefault();
        if(jQuery(this).parent().index()==0){
            jQuery(this).parent().addClass('active');
            jQuery(this).parent().siblings().removeClass('active');
        }else{
            jQuery(this).parent().toggleClass('active');
            if(jQuery(this).parents('ul').find('.active').length>0){
                jQuery(this).parents('ul').children().eq(0).removeClass('active');
            }else{
                jQuery(this).parents('ul').children().eq(0).addClass('active');
            }
        }
        var filter = '';
        var x = 0;
        jQuery('.filters-content .list ul li.active').each(function () {
            if(jQuery(this).index()!=0){
                if(x==0){
                    filter = jQuery(this).children().attr('data-handle');
                }else{
                    filter = jQuery(this).children().attr('data-handle') + '+' + filter;
                }
                x++;
            }
        });

        var cat = '';
        if(jQuery('.tab-filter').hasClass('blog-tab')){
            cat = jQuery('.blog-tab').find('li.active').attr('data-tag');
            var url = cat;
        }

        if(filter == ''){
            var url = jQuery('.filters-content').attr('data-back-url')+filter+cat;
        }else{
            if(cat == ''){
                var url = jQuery('.filters-content').attr('data-url')+filter;
            }else{
                var url = jQuery('.filters-content').attr('data-url')+cat+'+'+filter;
            }
        }



        jQuery.ajax(
            {
                url:url,
                type:'GET',
                dataType:'html'
            }
        ).done(function(next_page){
            var new_products = jQuery(next_page).find('.shop-list');
            var count = new_products.attr('data-count');
            if(count>1){
                jQuery('.ajax-count').text('SEE '+count+' RESULTS');
            }else if(count==1){
                jQuery('.ajax-count').text('SEE '+count+' RESULT');
            }else{
                jQuery('.ajax-count').text('NO RESULTS');
            }
        });


        jQuery('.filters-footer .see-all').attr('href',url);

    });


    jQuery('.filters-footer .clear-filter').click(function (e) {
        e.preventDefault();
        jQuery('.filters-content .list').each(function () {
            jQuery(this).find('ul').find('li').removeClass('active');
            jQuery(this).find('ul').find('li').eq(0).addClass('active');
        });
        var url = jQuery('.filters-content').attr('data-back-url');
        jQuery.ajax(
            {
                url:url,
                type:'GET',
                dataType:'html'
            }
        ).done(function(next_page){
            var new_products = jQuery(next_page).find('.shop-list');
            var count = new_products.attr('data-count');
            if(count>1){
                jQuery('.ajax-count').text('SEE '+count+' RESULTS');
            }else if(count==1){
                jQuery('.ajax-count').text('SEE '+count+' RESULT');
            }else{
                jQuery('.ajax-count').text('NO RESULTS');
            }
        });
        jQuery('.filters-footer .see-all').attr('href',url);
    });

    jQuery('header .header-right .icon-list .icon-search').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        jQuery('#SearchDrawer').addClass('is-show');
        jQuery('#SearchDrawer .search-bar__form input[type="text"]').focus();
    });
    jQuery('#SearchDrawer').on('click', function (e) {
        e.stopPropagation();
    });
    jQuery('.shop-top .filter').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        jQuery('.filters-wrapper').addClass('is-show');
    })
    jQuery('.filters-header .icon-close').on('click', function (e) {
        e.stopPropagation();
        jQuery(this).parents('.filters-wrapper').removeClass('is-show');
    });
    jQuery('.filters-wrapper').on('click', function (e) {
        e.stopPropagation();
        jQuery(this).addClass('is-show');
    });
    jQuery('body').on('click', function () {
        jQuery('#SearchDrawer .search-bar__form input[type="text"]').val('');
        jQuery('#SearchDrawer').removeClass('is-show');
        jQuery('.filters-wrapper').removeClass('is-show');
    });
    jQuery("#SearchDrawer .search-bar__actions .search-bar__close").on('click', function () {
        jQuery('#SearchDrawer .search-bar__form input[type="text"]').val('');
        jQuery('#SearchDrawer').removeClass('is-show');
    })
    //shop hover
    jQuery('.blog-detail-top .go-to-next-modules a').on('click', function (e) {
        e.preventDefault();
        var moduleH = jQuery(this).parents('.blog-detail-top').siblings('.guide').offset().top;
        var headerH = jQuery('header').innerHeight();
        jQuery('html,body').stop().animate({scrollTop:moduleH - headerH},500);
    })
    jQuery('.shop-list .list .add-to-cart a').hover(function () {
        jQuery(this).parents('.add-to-cart').siblings('.list-box').addClass('hover');
    },function () {
        jQuery('.shop-list .list .list-box').removeClass('hover');
    })
    jQuery('.shop-list .list .list-box').hover(function () {
        jQuery(this).siblings('.add-to-cart').children('a').addClass('hover');
    },function () {
        jQuery('.shop-list .list .add-to-cart a').removeClass('hover');
    });
    //our range
    jQuery('.our-range .shop-filter ul li:nth-child(1)').addClass('active');
    jQuery('.our-range .main .main-list:nth-child(1)').addClass('show');
    jQuery('.our-range .shop-filter ul li').on('click', function(e){
        e.preventDefault();
        //switch
        jQuery(this).addClass('active').siblings().removeClass('active');
        var $i=jQuery(this).index();
        jQuery('.our-range .main').children('.main-list').eq($i).show();
        // setTimeout(function(){
        //     jQuery('.main').find('.main-list').eq($i).siblings().hide()
        // },500);
        setTimeout(function(){
            jQuery('.our-range .main .main-list').eq($i).addClass('show');
        },450);
        jQuery('.our-range .main').children('.main-list').eq($i).css({
            position: 'static',
            width: '100%',
        });
        jQuery('.our-range .main').children('.main-list').eq($i).siblings().css({
            position: 'absolute',
            top: 0
        });
        jQuery('.our-range .main').children('.main-list').eq($i).siblings().removeClass('show');
    });

    //instafeed
    if(jQuery("#instafeed").length>0){
        var dataUrl = jQuery(".follow-us").attr('data-url');
        var feed = new Instafeed({
            accessToken: InstagramToken,
            limit: 4,
            template: '<div class="instagram-list"><a class="instagram-c" href=" '+ dataUrl +' " target="_blank" style="background-image:url({{image}});"></a></div>',
            after: function () {},
        });
        feed.run();
    }

    //load more
    jQuery('.awards .right-box table tr').each(function () {
        if(jQuery(this).index()<6){
            jQuery(this).addClass('is-show');
            jQuery(this).css('display','table-row');
        }
    });
    if(jQuery('.awards .right-box table tr').length == jQuery('.awards .right-box table tr.is-show').length){
        jQuery('.awards .right-box .more-btn').css('display','none');
    }
    jQuery(".awards .right-box .more-btn").on("click", function(e){
        e.preventDefault();
        var a = jQuery('.awards .right-box table tr.is-show').length+6;
        jQuery('.awards .right-box table tr').each(function () {
            if(jQuery(this).index()<a){
                jQuery(this).addClass('is-show').fadeIn();
            }
        });
        if(jQuery('.awards .right-box table tr').length == jQuery('.awards .right-box table tr.is-show').length){
            jQuery('.awards .right-box .more-btn').css('display','none');
        }
    });

    jQuery('.site-nav--active ul li a').on('click', function () {
        if(jQuery(this).children('span').text() == 'Stockists'){
            setTimeout(function () {
                var urlId = window.location.hash;
                var thatId = jQuery('.store-finder').attr('data-id');
                var thisId = urlId.substr(1);
                if(thisId == thatId){
                    var moduleH = jQuery('.store-finder').offset().top;
                    var headerH = jQuery('header').innerHeight();
                    jQuery('html,body').stop().animate({scrollTop:moduleH - headerH},500);
                }
            },10)
        }
    });
    jQuery(".add-pop-up .add-pop-up-box .content .colse").on('click', function (e) {
        e.preventDefault();
        jQuery(".add-pop-up").fadeOut(400);
    });
	jQuery(".add-pop-up").on('click', function (e) {
	        e.stopPropagation();
        jQuery(".add-pop-up").fadeOut(400);
    });
    jQuery(".add-pop-up .add-pop-up-box .content").on('click', function (e) {
	        e.stopPropagation();
    });

    // Autoplay loop disabled: cover image + play icon are shown by default,
    // the video only plays when the user clicks (handled by the click handler below).
    // Vimeo loop-resume kept for sliders that may already be playing.
    setTimeout(function(){
        $('.video-playing.video-vimeo').each(function(){
          if($(this).find('iframe.vimeo-paused').length > 0){
             var play_id = $(this).find('iframe').attr('id');
              var Pauseiframe = jQuery('#'+play_id);
              var pause_player = new Vimeo.Player(Pauseiframe);
              pause_player.setVolume(0);
              pause_player.play();
          }
        });
    },5000);
    jQuery('a.play-video').click(function(){
      var player_id = $(this).data('id');
      var type = $(this).data('type');
      var video_id = $(this).data('video'); 
      var videoUrl = $(this).data('url'); 
      
      if(videoUrl.indexOf('vimeo') > -1)
          type = 'vimeo';
      if (type === 'embed' && (typeof video_id !== 'string' || video_id.length !== 11)) {
        var _vid = getYouTubeVideoID(videoUrl || '');
        if (_vid) video_id = _vid;
      }
      play_video_element(player_id,type,video_id);
  });

  if(jQuery(document.body).find('.video-vimeo').length > 0){
        jQuery(document.body).find('.video-vimeo').each(function(){
            var _src = jQuery(this).find('iframe').attr('src');
            // R71/P0.4 cleanup: console.log("Source",_src);
        });
  }

  jQuery('a.icon-box-anchor').hover(function(){
       var _img = $(this).find('.icon-c img');
       if(_img.hasClass('animate__heartBeat')){
         _img.removeAttr('style').removeClass('animate__heartBeat').addClass('animate__bounceIn');
       }else{
         _img.removeAttr('style').addClass('animate__heartBeat').removeClass('animate__bounceIn');
       }      
   },function(){
         var _img = $(this).find('.icon-c img');
         _img.removeAttr('style').removeClass('animate__bounceIn');     
   });
  hide_single_dots();
  
});
//jQuery(window).on('load', function () {
jQuery(document).ready(function (jQuery) {
    // Ensure stubs before the .slick() call on .recommendations-list .shop-list below.
    onaEnsureJqStubs();
    // wowo();
    shopHeight();
  if(jQuery(document.body).find('.shopify-section').length > 0){
     jQuery('.shopify-section').imagesLoaded( function() {//kai
         var urlId = window.location.hash;
         var thatId = jQuery('.store-finder').attr('data-id');
         var thisId = urlId.substr(1);
         if(thisId == thatId){
             var moduleH = jQuery('.store-finder').offset().top;
             var headerH = jQuery('header').innerHeight();
             jQuery('html,body').stop().animate({scrollTop:moduleH - headerH},500);
         }
     });
  }

  if(jQuery(document.body).find('.recommendations-list .shop-list').length > 0){
	jQuery('.recommendations-list .shop-list').slick({
		slidesToShow: 4,
		slidesToScroll: 1,
		autoplay: false,
		autoplaySpeed: 2000,
		infinite: false,
		arrows: false,
		focusOnSelect: true,
		responsive: [
			{
				breakpoint: 991.9,
				settings: {
					slidesToShow: 3,
				}
			},
			{
				breakpoint: 767.9,
				settings: {
					slidesToShow: 2,
				}
			},
			{
				breakpoint: 575.9,
				settings: {
					slidesToShow: 1,
					arrows: true,
				}
			}
		]
    });
  }
	
});

jQuery(window).scroll(function() {
    // wowo();
    hide_single_dots();
});
jQuery(window).on('resize',function() {
    shopHeight();
	productTabHeight();
    hide_single_dots();
});

function hide_single_dots(){
  jQuery(document.body).find('.slick-dots').each(function(){
      if(jQuery(this).find('li').length <= 1){
        $(this).remove();
      }
  });
}
var player = {};
function play_video_element(player_id,video_type,video_id){
    /* $('.scale-video.video-playing').each(function(){
        var player_id = $(this).parent().find('a.play-video').attr('data-id');       
        var type = $(this).parent().find('a.play-video').attr('data-type');
        var source = $(this).parent().find('a.play-video').attr('data-url');
        if(source.indexOf('vimeo') > -1)
          type = 'vimeo';       
        stopCurrentVideo(player_id,type);
     });*/
  
     var curren_item = $('#'+player_id);
     curren_item.parent().addClass('video-playing').show();
     curren_item.parent().parent().find('.scale-cover-video').hide(); 
     curren_item.parent().parent().find('.scale-cover-image').hide(); 

     curren_item.parent().addClass('video-playing').addClass('video-'+video_type).addClass('player-'+player_id); 
     if(video_type == 'upload'){			
		var _video = document.getElementById(player_id);
        if(video_id.indexOf('.m3u8') > -1 && Hls.isSupported()){
          var hls = new Hls();
          hls.loadSource(video_id);
          hls.attachMedia(_video);   
          _video.play();
        }else{
          _video.src = video_id;          
        } 
         _video.muted = true; 
       // _video.controls = false; 
       $("#"+player_id).bind("ended", function() {

             var loop_video = document.getElementById(player_id);
             loop_video.play();
             loop_video.muted = true; 
            // loop_video.controls = false; 
           /* $("#"+player_id).parent().removeClass('video-playing').hide();
            $("#"+player_id).parent().parent().find('.scale-cover-video').show();    
            $("#"+player_id).parent().parent().find('.scale-cover-image').show();    */
       });
	}else if(video_type == 'vimeo'){
		var iframe = jQuery('#'+player_id);
        //$('#'+player_id).attr('src','https://vimeo.com/'+video_id);
        //var _src = "https://player.vimeo.com/video/"+video_id+"?controls=0"; 
        //$('#'+player_id).attr('src','https://vimeo.com/'+video_id);
        //iframe.attr('src',_src);                
		var vimeo_player = new Vimeo.Player(iframe);
        vimeo_player.setVolume(0); 
  		vimeo_player.play();
        vimeo_player.getPaused().then(function(paused) {
            if(paused){
                $('#'+vimeo_player.element.id).addClass('vimeo-paused');              
            }else{
               // R71/P0.4 cleanup: console.log("API LAYED");
            }        
        });
        //vimeo_player.setControl(0);
		/*vimeo_player.on('play', function(){
			vimeo_player.off('play')
			vimeo_player.loadVideo(video_id).then(function(){
				vimeo_player.setAutopause(false).then(function(autopause) {
				  // wait 1 second then play  
				  //setTimeout(play2,1000);
			   });
			});
		});*/
        vimeo_player.on('ended', function(event) {          
            $('.video-playing.video-vimeo').each(function(){
                /*var play_id = $(this).find('iframe').attr('id');
                if($(this).hasClass('player-'+play_id)){
                  $(this).removeClass('video-playing').hide();
                  $(this).parent().find('.scale-cover-video').show();
                  $(this).parent().find('.scale-cover-image').show();
                }*/
                var play_id = $(this).find('iframe').attr('id');
                var Loopiframe = jQuery('#'+play_id);
                var loop_player = new Vimeo.Player(Loopiframe);
                loop_player.setVolume(0);
        		loop_player.play();
                
            });            
        });			
	}else{
       if(video_id && video_id.indexOf('http') > -1){
         video_id = getYouTubeVideoID(video_id);
       }
       // Fallback: when the liquid-derived video_id is garbage like "watch",
       // extract the real 11-char id from the trigger anchor's data-url.
       if (!video_id || video_id.length !== 11) {
         var _anchor = jQuery('a.play-video[data-id="' + player_id + '"]');
         var _url = _anchor.attr('data-url');
         if (_url) {
           var _vid = getYouTubeVideoID(_url);
           if (_vid) { video_id = _vid; }
         }
       }
       // R71/P0.4 cleanup: console.log('youtube video_id',video_id);
       jQuery('#'+player_id).replaceWith('<div id="'+player_id+'"></div>');
		OnaonYouTubeIframeAPIReady(video_id,player_id);
	}
}

function stopCurrentVideo(player_id,type){  
  // return false;
  if(type == 'upload'){
     var _video = document.getElementById(player_id);
     _video.pause();
    // R71/P0.4 cleanup: console.log("vidoe stop");
  }else if(type == 'vimeo'){    
      var iframe = jQuery('#'+player_id);
      var stopplayer = new Vimeo.Player(iframe);     
      stopplayer.pause();
     //stopplayer.pause();
     //$('#'+player_id).attr('src','');
     //player.api("pause");
     
  } else if (type === 'embed') {
       if (youtubePlayers[player_id]) {
          youtubePlayers[player_id].pauseVideo();
       }
  }
  else{	
     jQuery('#'+player_id).replaceWith('<div id="'+player_id+'"></div>');
  }
  $("#"+player_id).parent().removeClass('video-playing').hide();
  $("#"+player_id).parent().parent().find('.scale-cover-video').show();    
  $("#"+player_id).parent().parent().find('.scale-cover-image').show();  
}

var youtubePlayers = {};
function OnaonYouTubeIframeAPIReady(video_id,player_id) {
   // If YT IFrame API isn't available (blocked / slow / not loaded), fall back to a
   // direct embed iframe. Autoplay via URL params works without the API.
   if (typeof YT === 'undefined' || typeof YT.Player !== 'function') {
     if (video_id && typeof video_id === 'string' && video_id.length === 11) {
       var src = 'https://www.youtube.com/embed/' + video_id +
                 '?autoplay=1&mute=1&loop=1&playlist=' + video_id +
                 '&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1';
       jQuery('#'+player_id).replaceWith(
         '<iframe id="'+player_id+'" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture" title="YouTube video player" src="'+src+'"></iframe>'
       );
     }
     return;
   }
	if(typeof video_id != 'undefined'){
		player = new YT.Player(player_id,{
		videoId: video_id,
		rel:0,
		showinfo:0,
      //  controls:0,
        loop:1,
        mute:0,  
        playerVars: {
          html5: 1,
          'wmode': 'opaque',
      //    'controls': 0,
          'origin': 'https://www.youtube.com'
        },
		events: {
			'onReady': onPlayerReady,
            'onStateChange': function(event){
                  onPlayerStateChange(event, player_id);
                }			
		  }
		});
        youtubePlayers[player_id] = player;
	}
 }  
function onPlayerReady(event) {
    event.target.playVideo();
    event.target.mute();
	
	/*iframe = $('#player');
	var requestFullScreen = iframe.requestFullScreen || iframe.mozRequestFullScreen || iframe.webkitRequestFullScreen;
	if (requestFullScreen) {
		requestFullScreen.bind(iframe)();
	}*/
}
var done = false;
function onPlayerStateChange(event,player_id) {
	if(event.data === 0) {
        event.target.playVideo();
        event.target.mute();
        /*$("#"+player_id).parent().removeClass('video-playing').hide();
        $("#"+player_id).parent().parent().find('.scale-cover-video').show(); 
        $("#"+player_id).parent().parent().find('.scale-cover-image').show(); */
	}
}

function stopVideo(){
    
}

function getYouTubeVideoID(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
/* cart page qikify shipping goal bold changes */
jQuery(document).ready(function () {
   setTimeout(function () {
      jQuery('.qbk-order-goal .qbk-order-goal__title').each(function () {
          // Check if the text contains 'Express Shipping'
          if (jQuery(this).text().includes('Express Shipping')) {
              // Replace 'Express Shipping' with a wrapped version
              const updatedText = $(this).html().replace(
                  'Express Shipping',
                  '<span style="font-weight: bold;">Express Shipping</span>'
              );
              jQuery(this).html(updatedText);
          }
      });
    }, 2000);
});
