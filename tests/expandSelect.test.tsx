import { describe, expect, it } from "vitest";
import { Fragment, createElement as h } from "react";
import { optionsFromChildren, splitClasses } from "@/components/ui/ExpandSelect";

describe("optionsFromChildren", () => {
  it("reads options, groups, fragments and mapped lists, with descriptions", () => {
    const opts = optionsFromChildren([
      h("option", { key: "a", value: "" }, "All"),
      h(Fragment, { key: "f" }, h("option", { value: "x", "data-description": "Does x" }, "Ex")),
      [h("option", { key: "n", value: 7 }, "Seven ", 7)],
      h("optgroup", { key: "g", label: "More" }, h("option", { value: "m", disabled: true }, "Em")),
    ]);
    expect(opts).toEqual([
      { value: "", label: "All", description: undefined, disabled: undefined, group: undefined },
      { value: "x", label: "Ex", description: "Does x", disabled: undefined, group: undefined },
      { value: "7", label: "Seven 7", description: undefined, disabled: undefined, group: undefined },
      { value: "m", label: "Em", description: undefined, disabled: true, group: "More" },
    ]);
  });
  it("uses the text as the value when there is no value", () => {
    expect(optionsFromChildren(h("option", null, "Ghana"))[0].value).toBe("Ghana");
  });
});

describe("splitClasses", () => {
  it("sends width and margin to the wrapper, radius to the box, and drops borders and colours", () => {
    expect(splitClasses("mt-1 block min-h-[44px] w-full rounded-full border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink")).toEqual({
      wrapper: "lg:mt-1 lg:w-full", radius: "rounded-full", head: "min-h-[44px] px-3 text-base text-brand-ink",
    });
  });
  it("copes with nothing", () => { expect(splitClasses(undefined)).toEqual({ wrapper: "", radius: "", head: "" }); });
});
