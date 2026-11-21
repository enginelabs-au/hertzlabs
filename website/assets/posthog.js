!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_CRrgfTYPHUkzLmFKLLv7LrgMYqqcerN7KjimHChDGibm', {
    api_host: 'https://e.hertzlabs.com.au',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-08-30',
    person_profiles: 'always',
})

document.addEventListener('click', function (event) {
    var node = event.target && event.target.closest ? event.target.closest('a, button') : null
    if (!node) return
    var href = node.getAttribute('href') || ''
    if (href.indexOf('apps.apple.com') !== -1 || href.indexOf('play.google.com') !== -1) {
        posthog.capture('store_badge_clicked', {
            store: href.indexOf('play.google.com') !== -1 ? 'google_play' : (node.getAttribute('aria-label') || '').indexOf('Mac') !== -1 ? 'mac_app_store' : 'app_store',
        })
    } else if (href.indexOf('mailto:') === 0) {
        posthog.capture('contact_clicked', {
            channel: href.indexOf('hello@') !== -1 ? 'partnerships' : 'support',
        })
    } else if (node.id === 'sound' || node.id === 'ui-play') {
        posthog.capture('sound_preview_toggled', {
            playing: node.getAttribute('aria-pressed') !== 'true',
        })
    }
}, true)
