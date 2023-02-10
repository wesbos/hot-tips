(function() {
  "use strict";
  function run(fn) {
    return fn();
  }
  function blank_object() {
    return /* @__PURE__ */ Object.create(null);
  }
  function run_all(fns) {
    fns.forEach(run);
  }
  let current_component;
  function set_current_component(component) {
    current_component = component;
  }
  Promise.resolve();
  const ATTR_REGEX = /[&"]/g;
  const CONTENT_REGEX = /[&<]/g;
  function escape(value, is_attr = false) {
    const str = String(value);
    const pattern = is_attr ? ATTR_REGEX : CONTENT_REGEX;
    pattern.lastIndex = 0;
    let escaped = "";
    let last = 0;
    while (pattern.test(str)) {
      const i = pattern.lastIndex - 1;
      const ch = str[i];
      escaped += str.substring(last, i) + (ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : "&lt;");
      last = i + 1;
    }
    return escaped + str.substring(last);
  }
  function each(items, fn) {
    let str = "";
    for (let i = 0; i < items.length; i += 1) {
      str += fn(items[i], i);
    }
    return str;
  }
  function validate_component(component, name) {
    if (!component || !component.$$render) {
      if (name === "svelte:component")
        name += " this={...}";
      throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules. Otherwise you may need to fix a <${name}>.`);
    }
    return component;
  }
  let on_destroy;
  function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots, context) {
      const parent_component = current_component;
      const $$ = {
        on_destroy,
        context: new Map(context || (parent_component ? parent_component.$$.context : [])),
        // these will be immediately discarded
        on_mount: [],
        before_update: [],
        after_update: [],
        callbacks: blank_object()
      };
      set_current_component({ $$ });
      const html = fn(result, props, bindings, slots);
      set_current_component(parent_component);
      return html;
    }
    return {
      render: (props = {}, { $$slots = {}, context = /* @__PURE__ */ new Map() } = {}) => {
        on_destroy = [];
        const result = { title: "", head: "", css: /* @__PURE__ */ new Set() };
        const html = $$render(result, props, {}, $$slots, context);
        run_all(on_destroy);
        return {
          html,
          css: {
            code: Array.from(result.css).map((css) => css.code).join("\n"),
            map: null
            // TODO
          },
          head: result.title + result.head
        };
      },
      $$render
    };
  }
  const Card = create_ssr_component(($$result, $$props, $$bindings, slots) => {
    return `<p>I am a card from another file</p>`;
  });
  const Svelte = create_ssr_component(($$result, $$props, $$bindings, slots) => {
    let { title } = $$props;
    let { message } = $$props;
    let { people = ["scott", "wes"] } = $$props;
    if ($$props.title === void 0 && $$bindings.title && title !== void 0)
      $$bindings.title(title);
    if ($$props.message === void 0 && $$bindings.message && message !== void 0)
      $$bindings.message(message);
    if ($$props.people === void 0 && $$bindings.people && people !== void 0)
      $$bindings.people(people);
    return `<p>${escape(title)} - ${escape(message)}</p>

${each(people, (person) => {
      return `<p>${escape(person)}</p>`;
    })}

${validate_component(Card, "Card").$$render($$result, {}, {}, {})}`;
  });
  return Svelte;
})();
